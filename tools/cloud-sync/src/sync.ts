import type { Env } from "./index";
import type { MicrosoftClaims } from "./auth";
import {
  computeLevel,
  computeStacksAndTitles,
  computeStreak,
  DEFAULT_MASTERPLAN,
  DEFAULT_MODE,
  DEFAULT_RUN,
  DEFAULT_STACK,
  MODES,
} from "./rules";
import { json } from "./http";

/** Mirrors progress/sessions/session-NN.json (see progress/DASHBOARD-SPEC.md). */
export interface SessionRecord {
  session: number;
  day: number;
  project: string;
  date: string;
  xp_earned: number;
  verification?: { all_passed: boolean };
  /** v2; absent on pre-v2 records and then read as loan-servicing / java / hands-on / run 1. */
  masterplan?: string;
  stack?: string;
  mode?: string;
  run?: number;
  [key: string]: unknown;
}

export interface SyncPayload {
  sessions: SessionRecord[];
  unlocked_achievements?: Array<{
    id: string;
    unlocked_at: string;
    session_id: string;
    evidence: string;
    /** v2; null/absent for common + polyglot achievements and for pre-v2 records. */
    stack?: string | null;
    run?: number;
  }>;
  leaderboard_opt_in?: boolean;
}


const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** v2 fields with the defaults that describe pre-v2 records. Returns an error string for invalid values. */
export function normalizeSession(s: SessionRecord) {
  const masterplan = s.masterplan ?? DEFAULT_MASTERPLAN;
  const stack = s.stack ?? DEFAULT_STACK;
  const mode = s.mode ?? DEFAULT_MODE;
  const run = s.run ?? DEFAULT_RUN;
  if (typeof masterplan !== "string" || !ID_RE.test(masterplan)) return { error: "invalid masterplan" as const };
  if (typeof stack !== "string" || !ID_RE.test(stack)) return { error: "invalid stack" as const };
  if (typeof mode !== "string" || !(MODES as readonly string[]).includes(mode)) return { error: "invalid mode" as const };
  if (!Number.isInteger(run) || run < 1) return { error: "invalid run" as const };
  return { masterplan, stack, mode, run };
}

/** Returns a validation error message for the payload's v2 fields, or null. */
export function validatePayload(payload: SyncPayload): string | null {
  for (const s of payload.sessions) {
    const n = normalizeSession(s);
    if ("error" in n) return `session ${s.session}: ${n.error}`;
  }
  for (const a of payload.unlocked_achievements ?? []) {
    if (a.stack != null && (typeof a.stack !== "string" || !ID_RE.test(a.stack))) return `unlock ${a.id}: invalid stack`;
    if (a.run !== undefined && (!Number.isInteger(a.run) || a.run < 1)) return `unlock ${a.id}: invalid run`;
  }
  return null;
}

/** Free-text fields that stay on the learner's machine. */
const PRIVATE_SESSION_FIELDS = ["reflection", "buddy_questions_asked", "notes"];


export async function handleSync(
  claims: MicrosoftClaims,
  payload: SyncPayload,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const invalid = validatePayload(payload);
  if (invalid) return json({ error: invalid }, 400, corsHeaders);

  const email = claims.preferred_username ?? "unknown";
  const displayName = claims.name ?? email.split("@")[0];
  const nowIso = new Date().toISOString();
  const optIn = payload.leaderboard_opt_in === undefined ? null : payload.leaderboard_opt_in ? 1 : 0;

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO learners (id, tenant_id, email, display_name, leaderboard_opt_in, last_synced_at)
       VALUES (?1, ?2, ?3, ?4, COALESCE(?5, 0), ?6)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         leaderboard_opt_in = COALESCE(?5, learners.leaderboard_opt_in),
         last_synced_at = excluded.last_synced_at`
    ).bind(claims.oid, claims.tid, email, displayName, optIn, nowIso),
  ];

  for (const ach of payload.unlocked_achievements ?? []) {
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO achievement_unlocks (learner_id, achievement_id, session_id, unlocked_at, evidence, stack, run)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(claims.oid, ach.id, ach.session_id, ach.unlocked_at, ach.evidence, ach.stack ?? "", ach.run ?? DEFAULT_RUN)
    );
  }

  // A session row is replaced wholesale, and only by a version with more XP —
  // so its columns and session_json never describe two different runs.
  for (const s of payload.sessions) {
    const publicSession = Object.fromEntries(
      Object.entries(s).filter(([k]) => !PRIVATE_SESSION_FIELDS.includes(k))
    );
    const v2 = normalizeSession(s) as { masterplan: string; stack: string; mode: string; run: number };
    stmts.push(
      env.DB.prepare(
        `INSERT INTO sessions (learner_id, session_no, day, date, project, xp_earned, all_passed, session_json,
                               masterplan, stack, mode, run)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(learner_id, run, session_no) DO UPDATE SET
           day = excluded.day, date = excluded.date, project = excluded.project,
           xp_earned = excluded.xp_earned, all_passed = excluded.all_passed,
           session_json = excluded.session_json,
           masterplan = excluded.masterplan, stack = excluded.stack, mode = excluded.mode
         WHERE excluded.xp_earned > sessions.xp_earned`
      ).bind(
        claims.oid,
        s.session,
        s.day,
        s.date,
        s.project,
        s.xp_earned,
        s.verification?.all_passed ? 1 : 0,
        JSON.stringify(publicSession),
        v2.masterplan,
        v2.stack,
        v2.mode,
        v2.run
      )
    );
  }

  await env.DB.batch(stmts);

  const profile = await rebuildProfile(claims.oid, env);
  return json(
    { status: "synchronized", synced_at: nowIso, learner: { id: claims.oid, email, display_name: displayName }, profile },
    200,
    corsHeaders
  );
}

/** Derives the profile from the ledgers and caches it in `profiles`. */
export async function rebuildProfile(learnerId: string, env: Env) {
  const sessions =
    (
      await env.DB.prepare(
        `SELECT day, date, project, xp_earned, session_no, stack, mode, run, session_json
         FROM sessions WHERE learner_id = ?1 ORDER BY run ASC, session_no ASC`
      )
        .bind(learnerId)
        .all<{
          day: number;
          date: string;
          project: string;
          xp_earned: number;
          session_no: number;
          stack: string;
          mode: string;
          run: number;
          session_json: string;
        }>()
    ).results ?? [];

  const unlockCount =
    (
      await env.DB.prepare(
        `SELECT COUNT(*) AS cnt FROM achievement_unlocks
         WHERE learner_id = ?1 AND run = (SELECT COALESCE(MAX(run), 1) FROM sessions WHERE learner_id = ?1)`
      )
        .bind(learnerId)
        .first<{ cnt: number }>()
    )?.cnt ?? 0;

  const v2 = computeStacksAndTitles(sessions);
  const current = sessions.filter((s) => s.run === v2.run);
  const latest = current.reduce<(typeof sessions)[number] | undefined>(
    (best, s) => (!best || s.day >= best.day ? s : best),
    undefined
  );
  // The streak is a habit, not a run: it folds over every session date, all stacks and runs.
  const dates = [...new Set(sessions.map((s) => s.date.slice(0, 10)))].sort();

  const profile = {
    schema_version: 2,
    current_day: latest?.day ?? 1,
    current_project: latest?.project ?? "p1-loan-core-java8",
    xp_total: v2.xp_total,
    // alias of the active stack's level on the stack ladder (the v1 dashboard keeps reading this)
    level: v2.stacks[v2.active_stack]?.level ?? computeLevel(0),
    ...computeStreak(dates),
    started_at: dates[0] ?? null,
    last_session_at: dates[dates.length - 1] ?? null,
    achievements_unlocked: unlockCount,
    run: v2.run,
    prestige: v2.prestige,
    lifetime_xp: v2.lifetime_xp,
    global_level: v2.global_level,
    stacks: v2.stacks,
    titles: v2.titles,
  };

  await env.DB.prepare(
    `INSERT INTO profiles (
       learner_id, current_day, current_project, xp_total, level_id, level_name,
       streak_days, streak_shields, achievements_unlocked, started_at, last_session_at, profile_json,
       headline_title, global_level_id, lifetime_xp, prestige
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
     ON CONFLICT(learner_id) DO UPDATE SET
       current_day = excluded.current_day, current_project = excluded.current_project,
       xp_total = excluded.xp_total, level_id = excluded.level_id, level_name = excluded.level_name,
       streak_days = excluded.streak_days, streak_shields = excluded.streak_shields,
       achievements_unlocked = excluded.achievements_unlocked,
       started_at = excluded.started_at, last_session_at = excluded.last_session_at,
       profile_json = excluded.profile_json,
       headline_title = excluded.headline_title, global_level_id = excluded.global_level_id,
       lifetime_xp = excluded.lifetime_xp, prestige = excluded.prestige`
  )
    .bind(
      learnerId,
      profile.current_day,
      profile.current_project,
      profile.xp_total,
      profile.level.id,
      profile.level.name,
      profile.streak_days,
      profile.streak_shields,
      profile.achievements_unlocked,
      profile.started_at,
      profile.last_session_at,
      JSON.stringify(profile),
      profile.titles.headline ?? "",
      profile.global_level.id,
      profile.lifetime_xp,
      profile.prestige
    )
    .run();

  return profile;
}

/**
 * Returns the ledgers so `award-xp` can merge missing sessions into progress/ on a new
 * machine. The dashboard never writes them to disk itself.
 */
export async function handleGetState(
  claims: MicrosoftClaims,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const profileRow = await env.DB.prepare(`SELECT profile_json FROM profiles WHERE learner_id = ?1`)
    .bind(claims.oid)
    .first<{ profile_json: string }>();

  if (!profileRow) {
    return json({ status: "empty", profile: null, unlocked_achievements: [], sessions: [] }, 200, corsHeaders);
  }

  const unlocks = await env.DB.prepare(
    `SELECT achievement_id AS id, NULLIF(stack, '') AS stack, run, session_id, unlocked_at, evidence
     FROM achievement_unlocks WHERE learner_id = ?1 ORDER BY unlocked_at ASC, achievement_id ASC, stack ASC`
  )
    .bind(claims.oid)
    .all();

  const sessions = await env.DB.prepare(
    `SELECT session_json FROM sessions WHERE learner_id = ?1 ORDER BY run ASC, session_no ASC`
  )
    .bind(claims.oid)
    .all<{ session_json: string }>();

  return json(
    {
      status: "hydrated",
      profile: JSON.parse(profileRow.profile_json),
      unlocked_achievements: unlocks.results ?? [],
      sessions: (sessions.results ?? []).map((r) => JSON.parse(r.session_json)),
    },
    200,
    corsHeaders
  );
}

/** Tenant-scoped, opt-in only. Learners who have not opted in are never listed. */
export async function handleGetLeaderboard(
  claims: MicrosoftClaims,
  env: Env,
  corsHeaders: Record<string, string>,
  rank: "run" | "lifetime" = "run"
): Promise<Response> {
  const order = rank === "lifetime" ? "p.lifetime_xp DESC, p.xp_total DESC" : "p.xp_total DESC, p.current_day DESC";
  const cohort = await env.DB.prepare(
    `SELECT l.display_name, p.current_day, p.current_project, p.xp_total,
            p.level_id, p.level_name, p.achievements_unlocked, l.last_synced_at,
            p.headline_title, p.global_level_id, p.lifetime_xp, p.prestige
     FROM profiles p
     JOIN learners l ON l.id = p.learner_id
     WHERE l.tenant_id = ?1 AND l.leaderboard_opt_in = 1
     ORDER BY ${order}
     LIMIT 50`
  )
    .bind(claims.tid)
    .all();

  return json({ tenant_id: claims.tid, rank, cohort: cohort.results ?? [] }, 200, corsHeaders);
}
