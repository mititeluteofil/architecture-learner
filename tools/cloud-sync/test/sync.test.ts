import { SELF, env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type TestKey, authHeader, generateKey, signToken, stubJwks, validClaims } from "./helpers";

let key: TestKey;
beforeAll(async () => {
  key = await generateKey();
});

beforeEach(async () => {
  stubJwks(key);
  await env.DB.batch(
    ["achievement_unlocks", "sessions", "profiles", "learners"].map((t) => env.DB.prepare(`DELETE FROM ${t}`))
  );
});
afterEach(() => vi.restoreAllMocks());

const ADA = { oid: "aaaaaaaa-0000-4000-8000-000000000001", name: "Ada Lovelace", preferred_username: "ada@example.test" };
const BOB = { oid: "bbbbbbbb-0000-4000-8000-000000000002", name: "Bob Builder", preferred_username: "bob@example.test" };

async function call(user: typeof ADA, path: string, body?: unknown) {
  const token = await signToken(key, validClaims(user));
  return SELF.fetch(`https://worker.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...authHeader(token), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const session = (n: number, xp: number, date: string, extra: Record<string, unknown> = {}) => ({
  session: n,
  day: n,
  project: "p1-loan-core-java8",
  date,
  xp_earned: xp,
  verification: { all_passed: true },
  ...extra,
});

describe("POST /api/sync", () => {
  it("sums XP across pushes with disjoint sessions", async () => {
    await call(ADA, "/api/sync", { sessions: [session(1, 100, "2026-06-01")] });
    const res = await call(ADA, "/api/sync", { sessions: [session(2, 250, "2026-06-02")] });
    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(body.profile.xp_total).toBe(350);
    expect(body.profile.current_day).toBe(2);
    expect(body.profile.streak_days).toBe(2);
  });

  it("does not overwrite a session with a re-push that has lower xp_earned", async () => {
    await call(ADA, "/api/sync", { sessions: [session(1, 200, "2026-06-01", { marker: "original" })] });
    const before = await env.DB.prepare("SELECT * FROM sessions WHERE session_no = 1").first();

    const res = await call(ADA, "/api/sync", { sessions: [session(1, 50, "2026-06-01", { marker: "stale" })] });
    expect(((await res.json()) as any).profile.xp_total).toBe(200);

    const after = await env.DB.prepare("SELECT * FROM sessions WHERE session_no = 1").first();
    expect(after).toEqual(before);
    expect(JSON.parse(after!.session_json as string).marker).toBe("original");
  });

  it("replaces a session wholesale when the re-push has more xp_earned", async () => {
    await call(ADA, "/api/sync", { sessions: [session(1, 50, "2026-06-01", { marker: "old" })] });
    await call(ADA, "/api/sync", { sessions: [session(1, 90, "2026-06-01", { marker: "new" })] });
    const row = await env.DB.prepare("SELECT xp_earned, session_json FROM sessions WHERE session_no = 1").first();
    expect(row!.xp_earned).toBe(90);
    expect(JSON.parse(row!.session_json as string).marker).toBe("new");
  });

  it("counts two sessions on the same date once for the streak (dedupe in rebuildProfile)", async () => {
    const res = await call(ADA, "/api/sync", {
      sessions: [session(1, 10, "2026-06-01"), session(2, 10, "2026-06-01T18:00:00Z")],
    });
    const { profile } = (await res.json()) as any;
    expect(profile.streak_days).toBe(1);
    expect(profile.xp_total).toBe(20);
  });

  it("strips reflection, buddy_questions_asked and notes from storage and state", async () => {
    await call(ADA, "/api/sync", {
      sessions: [
        session(1, 100, "2026-06-01", {
          reflection: "SECRET-REFLECTION",
          buddy_questions_asked: ["SECRET-QUESTION"],
          notes: "SECRET-NOTE",
        }),
      ],
    });
    const row = await env.DB.prepare("SELECT session_json FROM sessions").first<{ session_json: string }>();
    for (const field of ["reflection", "buddy_questions_asked", "notes"]) {
      expect(JSON.parse(row!.session_json)).not.toHaveProperty(field);
    }
    expect(row!.session_json).not.toContain("SECRET");

    const state = await (await call(ADA, "/api/state")).text();
    expect(state).not.toContain("SECRET");
    expect(state).not.toContain("reflection");
    expect(state).not.toContain("buddy_questions_asked");
  });

  it("returns 400 when sessions[] is missing", async () => {
    const res = await call(ADA, "/api/sync", { unlocked_achievements: [] });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/state", () => {
  it("is empty before the first sync", async () => {
    const body = (await (await call(ADA, "/api/state")).json()) as any;
    expect(body).toEqual({ status: "empty", profile: null, unlocked_achievements: [], sessions: [] });
  });

  it("round-trips sessions and achievements", async () => {
    const sessions = [
      session(1, 100, "2026-06-01", { xp_breakdown: { daily_acceptance: 100 } }),
      session(2, 40, "2026-06-02"),
    ];
    const unlock = { id: "first-blood", unlocked_at: "2026-06-01T10:00:00Z", session_id: "session-01", evidence: "e" };
    await call(ADA, "/api/sync", { sessions, unlocked_achievements: [unlock] });

    const body = (await (await call(ADA, "/api/state")).json()) as any;
    expect(body.status).toBe("hydrated");
    expect(body.sessions).toEqual(sessions);
    expect(body.unlocked_achievements).toEqual([unlock]);
    expect(body.profile.achievements_unlocked).toBe(1);
    expect(body.profile.xp_total).toBe(140);
  });

  it("never returns another learner's data", async () => {
    await call(ADA, "/api/sync", { sessions: [session(1, 100, "2026-06-01")] });
    const body = (await (await call(BOB, "/api/state")).json()) as any;
    expect(body.status).toBe("empty");
  });
});

describe("GET /api/leaderboard", () => {
  it("lists only learners who opted in", async () => {
    await call(ADA, "/api/sync", { sessions: [session(1, 300, "2026-06-01")], leaderboard_opt_in: true });
    await call(BOB, "/api/sync", { sessions: [session(1, 500, "2026-06-01")] });

    const body = (await (await call(BOB, "/api/leaderboard")).json()) as any;
    expect(body.cohort.map((c: any) => c.display_name)).toEqual(["Ada Lovelace"]);
    expect(body.cohort[0].xp_total).toBe(300);
    expect(JSON.stringify(body)).not.toContain("example.test");
  });

  it("omits a learner who opts back out, and a later sync without the flag keeps the choice", async () => {
    await call(ADA, "/api/sync", { sessions: [session(1, 300, "2026-06-01")], leaderboard_opt_in: true });
    await call(ADA, "/api/sync", { sessions: [session(2, 10, "2026-06-02")] }); // flag absent: unchanged
    let body = (await (await call(ADA, "/api/leaderboard")).json()) as any;
    expect(body.cohort).toHaveLength(1);

    await call(ADA, "/api/sync", { sessions: [], leaderboard_opt_in: false });
    body = (await (await call(ADA, "/api/leaderboard")).json()) as any;
    expect(body.cohort).toHaveLength(0);
  });
});

describe("routing", () => {
  it("answers CORS preflight and 404s unknown routes", async () => {
    const pre = await SELF.fetch("https://worker.test/api/sync", { method: "OPTIONS" });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe("https://dashboard.test");
    expect((await call(ADA, "/api/nope")).status).toBe(404);
  });
});
