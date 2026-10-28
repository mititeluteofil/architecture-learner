#!/usr/bin/env node
// Builds the POST /api/sync body from local progress files. Zero deps.
// Usage: node build-payload.mjs <repo-root> [--opt-in | --opt-out]
// Prints JSON to stdout. Reads only; never writes.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Keep in sync with PRIVATE_SESSION_FIELDS in tools/cloud-sync/src/sync.ts.
const PRIVATE_SESSION_FIELDS = ["reflection", "buddy_questions_asked", "notes"];

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const root = args.find((a) => !a.startsWith("--"));
if (
  !root ||
  flags.some((f) => f !== "--opt-in" && f !== "--opt-out") ||
  (flags.includes("--opt-in") && flags.includes("--opt-out"))
) {
  console.error("usage: build-payload.mjs <repo-root> [--opt-in | --opt-out]");
  process.exit(2);
}

const sessionsDir = join(root, "progress", "sessions");
const files = existsSync(sessionsDir)
  ? readdirSync(sessionsDir).filter((f) => /^session-\d+\.json$/.test(f)).sort()
  : [];
// v2 fields (masterplan, stack, mode, run). Old records lack them and are sent as-is (never
// back-filled; the worker applies the same defaults). Values that are present must be valid.
// Keep in sync with normalizeSession in tools/cloud-sync/src/sync.ts.
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const fail = (msg) => {
  console.error(`build-payload: ${msg}`);
  process.exit(1);
};
function checkV2(label, rec) {
  for (const k of ["masterplan", "stack"]) {
    if (rec[k] !== undefined && (typeof rec[k] !== "string" || !ID_RE.test(rec[k]))) fail(`${label}: invalid ${k}`);
  }
  if (rec.mode !== undefined && rec.mode !== "hands-on" && rec.mode !== "assisted") fail(`${label}: invalid mode`);
  if (rec.run !== undefined && (!Number.isInteger(rec.run) || rec.run < 1)) fail(`${label}: invalid run`);
}

const sessions = files.map((f) => {
  const rec = JSON.parse(readFileSync(join(sessionsDir, f), "utf8"));
  checkV2(f, rec);
  return Object.fromEntries(Object.entries(rec).filter(([k]) => !PRIVATE_SESSION_FIELDS.includes(k)));
});

const achPath = join(root, "progress", "achievements.json");
const rawUnlocked = existsSync(achPath) ? JSON.parse(readFileSync(achPath, "utf8")).unlocked ?? [] : [];
// Unlock entries get explicit v2 keys: stack null (common/polyglot, or written before v2), run 1.
const unlocked = rawUnlocked.map((u) => {
  checkV2(`unlock ${u.id}`, { stack: u.stack ?? undefined, run: u.run });
  return { ...u, stack: u.stack ?? null, run: u.run ?? 1 };
});

const payload = { sessions, unlocked_achievements: unlocked };
if (flags.includes("--opt-in")) payload.leaderboard_opt_in = true;
if (flags.includes("--opt-out")) payload.leaderboard_opt_in = false;
process.stdout.write(JSON.stringify(payload));
