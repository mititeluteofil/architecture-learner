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
const sessions = files.map((f) => {
  const rec = JSON.parse(readFileSync(join(sessionsDir, f), "utf8"));
  return Object.fromEntries(Object.entries(rec).filter(([k]) => !PRIVATE_SESSION_FIELDS.includes(k)));
});

const achPath = join(root, "progress", "achievements.json");
const unlocked = existsSync(achPath) ? JSON.parse(readFileSync(achPath, "utf8")).unlocked ?? [] : [];

const payload = { sessions, unlocked_achievements: unlocked };
if (flags.includes("--opt-in")) payload.leaderboard_opt_in = true;
if (flags.includes("--opt-out")) payload.leaderboard_opt_in = false;
process.stdout.write(JSON.stringify(payload));
