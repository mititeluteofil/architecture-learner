import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeState, applyMode, normalize } from "./compute.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(readFileSync(join(here, "..", "..", "progress", "rules.json"), "utf8"));

let n = 0;
const s = (stack, xp, extra = {}) => ({
  session: ++n,
  day: n,
  project: "p",
  date: "2026-06-01",
  xp_earned: xp,
  ...(stack ? { stack } : {}),
  ...extra,
});

test("rules.json is v2 with the polyglot blocks", () => {
  assert.equal(rules.schema_version, 2);
  assert.equal(rules.global_levels.length, 9);
  assert.equal(rules.global_levels[8].max, null);
  assert.deepEqual(rules.assisted, { xp_multiplier: 0.5, level_cap: "L3", counts_for_titles: false });
});

test("session-01-like record without stack/mode/run => Java L1 Apprentice, 175 XP", () => {
  const old = { session: 1, day: 1, project: "p1-loan-core-java8", date: "2026-06-01", xp_earned: 175 };
  assert.deepEqual(normalize(old), { ...old, stack: "java", mode: "hands-on", run: 1, masterplan: "loan-servicing" });
  assert.ok(!("stack" in old), "input is not back-filled");
  const st = computeState([old], rules);
  assert.equal(st.xp_total, 175);
  assert.equal(st.stacks.java.level.id, "L1");
  assert.equal(st.stacks.java.level.name, "Apprentice");
  assert.equal(st.stacks.java.level.xp_to_next, 426);
  assert.equal(st.global_level.id, "L1");
  assert.equal(st.titles.headline, "Apprentice · Java");
  assert.deepEqual(st.titles.combos, []);
});

test("Java L4 + Python L2 + Ruby L2 hands-on => Trilingual Journeyman, best single Senior · Java", () => {
  const st = computeState([s("java", 3300), s("python", 700), s("ruby", 650)], rules);
  assert.equal(st.stacks.java.level.id, "L4");
  assert.equal(st.stacks.python.level.id, "L2");
  assert.equal(st.titles.headline, "Trilingual Journeyman");
  assert.equal(st.titles.best_single, "Senior · Java");
  assert.deepEqual(st.titles.combos.map((c) => c.title), ["Trilingual Journeyman", "Bilingual Journeyman"]);
  assert.equal(st.xp_total, 4650);
  assert.equal(st.global_level.id, "L4");
});

test("Java + Python both L2 => Bilingual Journeyman", () => {
  const st = computeState([s("java", 700), s("python", 800)], rules);
  assert.equal(st.titles.headline, "Bilingual Journeyman");
  assert.equal(st.titles.best_single, "Journeyman · Python");
});

test("assisted stack is capped at L3 and excluded from prefixes", () => {
  const st = computeState([s("java", 3300), s("ruby", 5000, { mode: "assisted" }), s("python", 700)], rules);
  assert.equal(st.stacks.ruby.level.id, "L3");
  assert.equal(st.stacks.ruby.level.capped, true);
  assert.equal(st.stacks.ruby.xp, 5000);
  // ruby (assisted, would be L4 uncapped) is ignored: java L4 + python L2 => Bilingual Journeyman
  assert.equal(st.titles.headline, "Bilingual Journeyman");
  assert.equal(st.titles.best_single, "Senior · Java");
});

test("two assisted stacks never produce a prefix", () => {
  const st = computeState([s("java", 100, { mode: "assisted" }), s("ruby", 100, { mode: "assisted" })], rules);
  assert.deepEqual(st.titles.combos, []);
});

test("common achievement XP counts for the global ladder only", () => {
  const st = computeState(
    [s("java", 650, { achievements_unlocked: [{ id: "decision-anchor", scope: "common", xp: 50 }] })],
    rules
  );
  assert.equal(st.xp_total, 650);
  assert.equal(st.stacks.java.xp, 600);
  assert.equal(st.stacks.java.level.id, "L1");
  assert.equal(st.global_level.id, "L2");
});

test("prestige: current run only for xp_total, lifetime kept, stars on titles", () => {
  const st = computeState([s("java", 5000, { run: 1 }), s("java", 700, { run: 2 }), s("python", 700, { run: 2 })], rules);
  assert.equal(st.run, 2);
  assert.equal(st.prestige, 1);
  assert.equal(st.xp_total, 1400);
  assert.equal(st.lifetime_xp, 6400);
  assert.equal(st.titles.headline, "★ Bilingual Journeyman");
});

test("assisted multiplier applies only to daily_acceptance", () => {
  assert.equal(applyMode("daily_acceptance", 100, "assisted", rules), 50);
  assert.equal(applyMode("daily_acceptance", 100, "hands-on", rules), 100);
  assert.equal(applyMode("micro_step", 20, "assisted", rules), 20);
});

test("five hands-on stacks at the same level => Polyglot", () => {
  const st = computeState(["java", "dotnet", "node", "python", "ruby"].map((k) => s(k, 700)), rules);
  assert.equal(st.titles.headline, "Polyglot Journeyman");
});

test("deterministic: input order does not change the result", () => {
  const a = [s("java", 3300), s("python", 700), s("ruby", 650)];
  assert.deepEqual(computeState(a, rules), computeState([...a].reverse(), rules));
});
