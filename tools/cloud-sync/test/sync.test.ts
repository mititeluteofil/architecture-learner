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
    // pre-v2 unlock: the server reports the defaults explicitly (stack null, run 1)
    expect(body.unlocked_achievements).toEqual([{ ...unlock, stack: null, run: 1 }]);
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

describe("polyglot v2", () => {
  const v2 = (n: number, xp: number, date: string, stack: string, extra: Record<string, unknown> = {}) =>
    session(n, xp, date, { masterplan: "loan-servicing", stack, mode: "hands-on", run: 1, ...extra });

  it("old records default to java / hands-on / run 1 / loan-servicing in the columns, session_json stays as sent", async () => {
    await call(ADA, "/api/sync", { sessions: [session(1, 175, "2026-06-01")] });
    const row = await env.DB.prepare("SELECT masterplan, stack, mode, run, session_json FROM sessions").first<any>();
    expect(row).toMatchObject({ masterplan: "loan-servicing", stack: "java", mode: "hands-on", run: 1 });
    for (const k of ["masterplan", "stack", "mode", "run"]) expect(JSON.parse(row.session_json)).not.toHaveProperty(k);

    const { profile } = (await (await call(ADA, "/api/state")).json()) as any;
    expect(profile.xp_total).toBe(175);
    expect(profile.level.id).toBe("L1");
    expect(profile.global_level.id).toBe("L1");
    expect(profile.stacks.java).toMatchObject({ xp: 175, mode: "hands-on" });
    expect(profile.titles.headline).toBe("Apprentice · Java");
    expect(profile.run).toBe(1);
    expect(profile.prestige).toBe(0);
    expect(profile.lifetime_xp).toBe(175);
  });

  it("Java + Python fixture yields Bilingual Apprentice, per-stack levels and cached profile columns", async () => {
    const res = await call(ADA, "/api/sync", {
      sessions: [v2(1, 175, "2026-06-01", "java"), v2(2, 120, "2026-06-02", "python")],
      unlocked_achievements: [
        { id: "pure-core", stack: "python", run: 1, unlocked_at: "2026-06-02T10:00:00Z", session_id: "session-02", evidence: "e" },
        { id: "decision-anchor", unlocked_at: "2026-06-02T10:00:00Z", session_id: "session-02", evidence: "e" },
      ],
    });
    const { profile } = (await res.json()) as any;
    expect(profile.xp_total).toBe(295);
    expect(profile.stacks.java.level.id).toBe("L1");
    expect(profile.stacks.python.level.id).toBe("L1");
    expect(profile.titles.headline).toBe("Bilingual Apprentice");
    expect(profile.titles.best_single).toBe("Apprentice · Java");
    expect(profile.level.id).toBe("L1"); // alias of the active (latest) stack
    expect(profile.achievements_unlocked).toBe(2);

    const row = await env.DB.prepare("SELECT headline_title, global_level_id, lifetime_xp, prestige FROM profiles").first<any>();
    expect(row).toEqual({ headline_title: "Bilingual Apprentice", global_level_id: "L1", lifetime_xp: 295, prestige: 0 });
  });

  it("unlocks are keyed by (id, stack, run): same id in two stacks is two rows, a replay is a no-op", async () => {
    const unlock = (stack: string | null) => ({
      id: "hex-vex",
      stack,
      unlocked_at: "2026-06-02T10:00:00Z",
      session_id: "session-02",
      evidence: "e",
    });
    const body = { sessions: [v2(1, 10, "2026-06-01", "java")], unlocked_achievements: [unlock("java"), unlock("python")] };
    await call(ADA, "/api/sync", body);
    await call(ADA, "/api/sync", body);
    const rows = await env.DB.prepare("SELECT stack, run FROM achievement_unlocks ORDER BY stack").all<any>();
    expect(rows.results).toEqual([
      { stack: "java", run: 1 },
      { stack: "python", run: 1 },
    ]);

    const state = (await (await call(ADA, "/api/state")).json()) as any;
    expect(state.unlocked_achievements.map((u: any) => u.stack)).toEqual(["java", "python"]);
  });

  it("assisted stack is capped at L3 and does not feed the title prefix", async () => {
    const { profile } = (await (
      await call(ADA, "/api/sync", {
        sessions: [
          v2(1, 3300, "2026-06-01", "java"),
          v2(2, 5000, "2026-06-02", "ruby", { mode: "assisted" }),
          v2(3, 700, "2026-06-03", "python"),
        ],
      })
    ).json()) as any;
    expect(profile.stacks.ruby.level).toMatchObject({ id: "L3", capped: true });
    expect(profile.titles.headline).toBe("Bilingual Journeyman");
    expect(profile.titles.best_single).toBe("Senior · Java");
  });

  it("a fresh-start run restarts session numbers without colliding, keeps lifetime XP, adds stars", async () => {
    await call(ADA, "/api/sync", { sessions: [v2(1, 5000, "2026-06-01", "java", { run: 1 })] });
    const { profile } = (await (
      await call(ADA, "/api/sync", {
        sessions: [v2(1, 700, "2026-06-02", "java", { run: 2 }), v2(2, 700, "2026-06-03", "python", { run: 2 })],
      })
    ).json()) as any;
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions").first<any>()).n).toBe(3);
    expect(profile).toMatchObject({ run: 2, prestige: 1, xp_total: 1400, lifetime_xp: 6400 });
    expect(profile.titles.headline).toBe("★ Bilingual Journeyman");
    expect(profile.streak_days).toBe(3); // streak is a habit across runs
  });

  it.each([
    [{ stack: "Py Thon" }, "invalid stack"],
    [{ mode: "turbo" }, "invalid mode"],
    [{ run: 0 }, "invalid run"],
    [{ masterplan: "../x" }, "invalid masterplan"],
  ])("rejects %j with 400 and writes nothing", async (bad, msg) => {
    const res = await call(ADA, "/api/sync", { sessions: [session(1, 10, "2026-06-01", bad)] });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toContain(msg);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions").first<any>()).n).toBe(0);
  });

  it("leaderboard exposes the v2 columns and can rank by lifetime XP", async () => {
    await call(ADA, "/api/sync", {
      sessions: [v2(1, 5000, "2026-05-01", "java", { run: 1 }), v2(1, 100, "2026-06-01", "java", { run: 2 })],
      leaderboard_opt_in: true,
    });
    await call(BOB, "/api/sync", { sessions: [v2(1, 900, "2026-06-01", "java")], leaderboard_opt_in: true });

    const byRun = (await (await call(BOB, "/api/leaderboard")).json()) as any;
    expect(byRun.rank).toBe("run");
    expect(byRun.cohort.map((c: any) => c.display_name)).toEqual(["Bob Builder", "Ada Lovelace"]);

    const byLife = (await (await call(BOB, "/api/leaderboard?rank=lifetime")).json()) as any;
    expect(byLife.cohort.map((c: any) => c.display_name)).toEqual(["Ada Lovelace", "Bob Builder"]);
    expect(byLife.cohort[0]).toMatchObject({ lifetime_xp: 5100, prestige: 1, global_level_id: "L1" });
    expect(byLife.cohort[0].headline_title).toBeTruthy();
  });
});
