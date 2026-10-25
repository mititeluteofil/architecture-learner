import type { Env } from "./index";
import type { MicrosoftClaims } from "./auth";
import { computeLevel, computeStreak } from "./rules";
import { json } from "./http";

/** Mirrors progress/sessions/session-NN.json (see progress/DASHBOARD-SPEC.md). */
export interface SessionRecord {
  session: number;
  day: number;
  project: string;
  date: string;
  xp_earned: number;
  verification?: { all_passed: boolean };
  [key: string]: unknown;
}

export interface SyncPayload {
  sessions: SessionRecord[];
  unlocked_achievements?: Array<{
    id: string;
    unlocked_at: string;
    session_id: string;
    evidence: string;
  }>;
  leaderboard_opt_in?: boolean;
}


/** Free-text fields that stay on the learner's machine. */
const PRIVATE_SESSION_FIELDS = ["reflection", "buddy_questions_asked", "notes"];


export async function handleSync(
  claims: MicrosoftClaims,
  payload: SyncPayload,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
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
        `INSERT OR IGNORE INTO achievement_unlocks (learner_id, achievement_id, session_id, unlocked_at, evidence)
         VALUES (?1, ?2, ?3, ?4, ?5)`
      ).bind(claims.oid, ach.id, ach.session_id, ach.unlocked_at, ach.evidence)
    );
  }

  // A session row is replaced wholesale, and only by a version with more XP —
  // so its columns and session_json never describe two different runs.
  for (const s of payload.sessions) {
    const publicSession = Object.fromEntries(
      Object.entries(s).filter(([k]) => !PRIVATE_SESSION_FIELDS.includes(k))
    );
    stmts.push(
      env.DB.prepare(
        `INSERT INTO sessions (learner_id, session_no, day, date, project, xp_earned, all_passed, session_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(learner_id, session_no) DO UPDATE SET
           day = excluded.day, date = excluded.date, project = excluded.project,
           xp_earned = excluded.xp_earned, all_passed = excluded.all_passed,
           session_json = excluded.session_json
         WHERE excluded.xp_earned > sessions.xp_earned`
      ).bind(
        claims.oid,
        s.session,
        s.day,
        s.date,
        s.project,
        s.xp_earned,
        s.verification?.all_passed ? 1 : 0,
        JSON.stringify(publicSession)
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
        `SELECT day, date, project, xp_earned FROM sessions WHERE learner_id = ?1 ORDER BY date ASC, session_no ASC`
      )
        .bind(learnerId)
        .all<{ day: number; date: string; project: string; xp_earned: number }>()
    ).results ?? [];

  const unlockCount =
    (
      await env.DB.prepare(`SELECT COUNT(*) AS cnt FROM achievement_unlocks WHERE learner_id = ?1`)
        .bind(learnerId)
        .first<{ cnt: number }>()
    )?.cnt ?? 0;

  const xpTotal = sessions.reduce((sum, s) => sum + s.xp_earned, 0);
  const latest = sessions.reduce<(typeof sessions)[number] | undefined>(
    (best, s) => (!best || s.day >= best.day ? s : best),
    undefined
  );
  const dates = [...new Set(sessions.map((s) => s.date.slice(0, 10)))];

  const profile = {
    current_day: latest?.day ?? 1,
    current_project: latest?.project ?? "p1-loan-core-java8",
    xp_total: xpTotal,
    level: computeLevel(xpTotal),
    ...computeStreak(dates),
    started_at: dates[0] ?? null,
    last_session_at: dates[dates.length - 1] ?? null,
    achievements_unlocked: unlockCount,
  };

  await env.DB.prepare(
    `INSERT INTO profiles (
       learner_id, current_day, current_project, xp_total, level_id, level_name,
       streak_days, streak_shields, achievements_unlocked, started_at, last_session_at, profile_json
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
     ON CONFLICT(learner_id) DO UPDATE SET
       current_day = excluded.current_day, current_project = excluded.current_project,
       xp_total = excluded.xp_total, level_id = excluded.level_id, level_name = excluded.level_name,
       streak_days = excluded.streak_days, streak_shields = excluded.streak_shields,
       achievements_unlocked = excluded.achievements_unlocked,
       started_at = excluded.started_at, last_session_at = excluded.last_session_at,
       profile_json = excluded.profile_json`
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
      JSON.stringify(profile)
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
    `SELECT achievement_id AS id, session_id, unlocked_at, evidence
     FROM achievement_unlocks WHERE learner_id = ?1 ORDER BY unlocked_at ASC`
  )
    .bind(claims.oid)
    .all();

  const sessions = await env.DB.prepare(
    `SELECT session_json FROM sessions WHERE learner_id = ?1 ORDER BY session_no ASC`
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
  corsHeaders: Record<string, string>
): Promise<Response> {
  const cohort = await env.DB.prepare(
    `SELECT l.display_name, p.current_day, p.current_project, p.xp_total,
            p.level_id, p.level_name, p.achievements_unlocked, l.last_synced_at
     FROM profiles p
     JOIN learners l ON l.id = p.learner_id
     WHERE l.tenant_id = ?1 AND l.leaderboard_opt_in = 1
     ORDER BY p.xp_total DESC, p.current_day DESC
     LIMIT 50`
  )
    .bind(claims.tid)
    .all();

  return json({ tenant_id: claims.tid, cohort: cohort.results ?? [] }, 200, corsHeaders);
}
