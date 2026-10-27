import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const script = join(dirname(fileURLToPath(import.meta.url)), "build-payload.mjs");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bp-"));
  mkdirSync(join(root, "progress", "sessions"), { recursive: true });
  writeFileSync(
    join(root, "progress", "sessions", "session-01.json"),
    JSON.stringify({
      session: 1, day: 1, project: "p1", date: "2026-06-01", xp_earned: 100,
      verification: { all_passed: true },
      reflection: "secret", buddy_questions_asked: ["q"], notes: "n",
    })
  );
  writeFileSync(
    join(root, "progress", "achievements.json"),
    JSON.stringify({
      definitions: [],
      unlocked: [{ id: "a", unlocked_at: "2026-06-01", session_id: "session-01", evidence: "e" }],
    })
  );
  return root;
}
const run = (root, ...f) => JSON.parse(execFileSync("node", [script, root, ...f], { encoding: "utf8" }));

test("strips private fields and keeps shape", () => {
  const p = run(fixture());
  assert.equal(p.sessions.length, 1);
  for (const k of ["reflection", "buddy_questions_asked", "notes"]) assert.ok(!(k in p.sessions[0]));
  assert.equal(p.sessions[0].xp_earned, 100);
  assert.equal(p.sessions[0].verification.all_passed, true);
  assert.equal(p.unlocked_achievements[0].id, "a");
  assert.ok(!("leaderboard_opt_in" in p));
});

test("opt flags", () => {
  const r = fixture();
  assert.equal(run(r, "--opt-in").leaderboard_opt_in, true);
  assert.equal(run(r, "--opt-out").leaderboard_opt_in, false);
});

function fixtureWith(sessions, unlocked = []) {
  const root = mkdtempSync(join(tmpdir(), "bp2-"));
  mkdirSync(join(root, "progress", "sessions"), { recursive: true });
  sessions.forEach((s, i) =>
    writeFileSync(join(root, "progress", "sessions", `session-${String(i + 1).padStart(2, "0")}.json`), JSON.stringify(s))
  );
  writeFileSync(join(root, "progress", "achievements.json"), JSON.stringify({ definitions: [], unlocked }));
  return root;
}

test("old records are sent as-is (no back-filled v2 fields); unlocks get explicit stack null / run 1", () => {
  const p = run(fixture());
  for (const k of ["masterplan", "stack", "mode", "run"]) assert.ok(!(k in p.sessions[0]), `${k} not back-filled`);
  assert.equal(p.unlocked_achievements[0].stack, null);
  assert.equal(p.unlocked_achievements[0].run, 1);
});

test("Java + Python fixture carries v2 fields through and strips private ones", () => {
  const base = { day: 1, project: "p1", date: "2026-06-01", verification: { all_passed: true }, reflection: "x" };
  const root = fixtureWith(
    [
      { ...base, session: 1, xp_earned: 100 }, // old java record, no v2 fields
      { ...base, session: 2, xp_earned: 80, masterplan: "loan-servicing", stack: "python", mode: "assisted", run: 1 },
    ],
    [
      { id: "pure-core", stack: "python", run: 1, unlocked_at: "2026-06-02", session_id: "session-02", evidence: "e" },
      { id: "decision-anchor", unlocked_at: "2026-06-02", session_id: "session-02", evidence: "e" },
    ]
  );
  const p = run(root);
  assert.equal(p.sessions[1].stack, "python");
  assert.equal(p.sessions[1].mode, "assisted");
  assert.ok(!("reflection" in p.sessions[1]));
  assert.deepEqual(p.unlocked_achievements.map((u) => [u.id, u.stack, u.run]), [
    ["pure-core", "python", 1],
    ["decision-anchor", null, 1],
  ]);
});

test("invalid v2 values fail the build with exit code 1", () => {
  const base = { day: 1, project: "p1", date: "2026-06-01", xp_earned: 1 };
  for (const bad of [{ stack: "Py thon" }, { mode: "turbo" }, { run: 0 }, { masterplan: "../x" }]) {
    const root = fixtureWith([{ ...base, session: 1, ...bad }]);
    assert.throws(() => execFileSync("node", [script, root], { encoding: "utf8", stdio: "pipe" }), /status 1|Command failed/);
  }
});
