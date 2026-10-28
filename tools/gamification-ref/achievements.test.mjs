import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const main = read("progress/achievements.json");
const TIERS = ["domain-core", "hexagonal", "event-driven", "cloud-infra"];
const STACKS = ["java", "dotnet", "node", "python", "ruby"];

test("main catalogue: every definition has a non-stack scope and a complete shape", () => {
  assert.equal(main.schema_version, 2);
  assert.deepEqual(main.unlocked, []);
  for (const d of main.definitions) {
    assert.ok(["common", "per-stack", "polyglot"].includes(d.scope), `${d.id} scope`);
    assert.ok(TIERS.includes(d.tier), `${d.id} tier`);
    assert.ok(Number.isInteger(d.xp) && d.xp >= 50 && d.xp <= 150, `${d.id} xp`);
    for (const k of ["id", "name", "description", "criteria"]) assert.ok(d[k], `${d.id} ${k}`);
  }
  const by = (s) => main.definitions.filter((d) => d.scope === s).map((d) => d.id).sort();
  assert.deepEqual(by("common"), [
    "adr-ten", "cartographer", "chaos-survivor", "debrief-30", "decision-anchor", "domain-hopper",
    "kubectl-karma", "localstack-whisperer", "new-game-plus", "streak-14", "terraform-tamer",
  ]);
  assert.deepEqual(by("per-stack"), [
    "bounded", "container-diet", "contract-killer", "hex-vex", "idempotent-mind", "outbox-hero", "property-pioneer", "pure-core",
  ]);
  assert.equal(by("polyglot").length, 8);
});

test("per-stack criteria are stack-neutral (no java-only tooling)", () => {
  for (const d of main.definitions.filter((x) => x.scope === "per-stack")) {
    assert.doesNotMatch(d.criteria, /mvn|jqwik|\.java|jib/i, d.id);
  }
});

test("stack packs: only achievements.json is required here; each has 4+ well-formed definitions", () => {
  const all = [...main.definitions.map((d) => d.id)];
  for (const s of STACKS) {
    const p = `stacks/${s}/achievements.json`;
    assert.ok(existsSync(join(root, p)), p);
    const pack = read(p);
    assert.equal(pack.stack, s);
    assert.ok(pack.definitions.length >= 4);
    for (const d of pack.definitions) {
      assert.equal(d.scope, "stack");
      assert.equal(d.stack, s);
      assert.ok(TIERS.includes(d.tier));
      all.push(d.id);
    }
  }
  assert.equal(new Set(all).size, all.length, "ids are unique across main + packs");
  assert.equal(read("stacks/java/achievements.json").definitions.length, 5);
});

test("stack dirs hold nothing this wave owns besides achievements.json", () => {
  for (const s of STACKS) assert.ok(readdirSync(join(root, "stacks", s)).includes("achievements.json"));
});
