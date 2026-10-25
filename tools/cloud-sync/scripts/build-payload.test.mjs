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
