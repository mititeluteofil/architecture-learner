/**
 * Architecture Learner — Cloudflare Edge Sync Worker
 * Zero external dependencies. Runs on Cloudflare Workers Free Tier + D1 SQLite.
 *
 * Merge model: sessions and achievement unlocks are ledgers (union). Everything in the
 * profile is re-derived from them after each sync, so two machines that each recorded
 * different sessions both keep their XP.
 */

export interface Env {
  DB: D1Database;
  AZURE_TENANT_ID: string;      // a tenant GUID, or "organizations"
  AZURE_CLIENT_ID: string;      // the API app registration's client ID
  ALLOWED_TENANT_IDS?: string;  // comma-separated; required when AZURE_TENANT_ID is not a GUID
  REQUIRED_SCOPE?: string;      // delegated scope the access token must carry, e.g. "Progress.Sync"
  ALLOWED_ORIGIN: string;
}

export interface MicrosoftClaims {
  oid: string;
  tid: string;
  preferred_username?: string;
  name?: string;
  scp?: string;
  aud: string;
  iss: string;
  exp: number;
  nbf?: number;
}

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

/** Keep in sync with .claude/skills/award-xp/SKILL.md "Levels". */
const LEVELS = [
  { id: "L1", name: "Apprentice", min: 0, max: 600 },
  { id: "L2", name: "Journeyman", min: 601, max: 1600 },
  { id: "L3", name: "Engineer", min: 1601, max: 3200 },
  { id: "L4", name: "Senior", min: 3201, max: 5600 },
  { id: "L5", name: "Staff", min: 5601, max: 9000 },
  { id: "L6", name: "Architect", min: 9001, max: Infinity },
] as const;

const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOCK_SKEW_SEC = 300;

function computeLevel(xpTotal: number) {
  const lvl = LEVELS.find((l) => xpTotal <= l.max) ?? LEVELS[LEVELS.length - 1];
  return {
    id: lvl.id,
    name: lvl.name,
    xp_in_level: xpTotal - lvl.min,
    xp_to_next: lvl.max === Infinity ? 0 : lvl.max + 1 - xpTotal,
  };
}

/** Same fold as award-xp's "Streak & Shield rule". */
function computeStreak(sortedDates: string[]) {
  let streak = 0;
  let shields = 0;
  let prev: number | null = null;
  for (const iso of sortedDates) {
    const d = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000;
    if (prev === null) {
      streak = 1;
    } else {
      const missed = d - prev - 1;
      if (missed === 0) {
        streak += 1;
      } else if (missed <= shields) {
        shields -= missed;
        streak += 1;
      } else {
        streak = 1;
      }
    }
    if (streak % 3 === 0) shields = Math.min(3, shields + 1);
    prev = d;
  }
  return { streak_days: streak, streak_shields: shields };
}

function isConfigured(env: Env): boolean {
  if (!env.AZURE_CLIENT_ID || env.AZURE_CLIENT_ID === PLACEHOLDER_ID) return false;
  return GUID.test(env.AZURE_TENANT_ID) || !!env.ALLOWED_TENANT_IDS?.trim();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ status: "ok", configured: isConfigured(env) }, 200, corsHeaders);
    }

    // Fail closed: never accept tokens while the app registration is unset.
    if (!isConfigured(env)) {
      return json({ error: "Worker not configured: set AZURE_CLIENT_ID and a tenant allowlist" }, 503, corsHeaders);
    }

    const claims = await verifyMicrosoftJwt(request.headers.get("Authorization"), env);
    if (!claims) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    try {
      if (url.pathname === "/api/sync" && request.method === "POST") {
        const body = (await request.json()) as SyncPayload;
        if (!Array.isArray(body?.sessions)) {
          return json({ error: "sessions[] is required" }, 400, corsHeaders);
        }
        return await handleSync(claims, body, env, corsHeaders);
      }

      if (url.pathname === "/api/state" && request.method === "GET") {
        return await handleGetState(claims, env, corsHeaders);
      }

      if (url.pathname === "/api/leaderboard" && request.method === "GET") {
        return await handleGetLeaderboard(claims, env, corsHeaders);
      }

      return json({ error: "Not Found" }, 404, corsHeaders);
    } catch (err: unknown) {
      console.error(err);
      return json({ error: "Internal Worker Error" }, 500, corsHeaders);
    }
  },
};

async function handleSync(
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
async function rebuildProfile(learnerId: string, env: Env) {
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
async function handleGetState(
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
async function handleGetLeaderboard(
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

/**
 * Verifies an Entra ID v2.0 *access token* issued for this API (not an ID token):
 * RS256 signature against the JWKS, exp/nbf, audience, issuer, tenant allowlist, scope.
 */
async function verifyMicrosoftJwt(authHeader: string | null, env: Env): Promise<MicrosoftClaims | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const parts = authHeader.slice(7).trim().split(".");
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(base64UrlDecodeString(parts[0])) as { kid: string; alg: string };
    const claims = JSON.parse(base64UrlDecodeString(parts[1])) as MicrosoftClaims;
    if (header.alg !== "RS256") return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SEC < nowSec) return null;
    if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_SEC > nowSec) return null;

    const audiences = [env.AZURE_CLIENT_ID, `api://${env.AZURE_CLIENT_ID}`];
    if (!audiences.includes(claims.aud)) return null;

    if (!claims.tid || !claims.oid) return null;
    const allowedTenants = GUID.test(env.AZURE_TENANT_ID)
      ? [env.AZURE_TENANT_ID]
      : (env.ALLOWED_TENANT_IDS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    if (!allowedTenants.includes(claims.tid)) return null;
    if (claims.iss !== `https://login.microsoftonline.com/${claims.tid}/v2.0`) return null;

    if (env.REQUIRED_SCOPE && !(claims.scp ?? "").split(" ").includes(env.REQUIRED_SCOPE)) return null;

    const jwksRes = await fetch(`https://login.microsoftonline.com/${claims.tid}/discovery/v2.0/keys`, {
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!jwksRes.ok) return null;

    const jwks = (await jwksRes.json()) as { keys: Array<JsonWebKey & { kid: string }> };
    const matchingKey = jwks.keys.find((k) => k.kid === header.kid);
    if (!matchingKey) return null;

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      matchingKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      base64UrlDecodeBytes(parts[2]),
      signedData
    );

    return isValid ? claims : null;
  } catch {
    return null;
  }
}

function base64UrlDecodeBytes(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeString(base64Url: string): string {
  return new TextDecoder().decode(base64UrlDecodeBytes(base64Url));
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}
