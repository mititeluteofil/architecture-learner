# Dashboard & Cloud Sync — Work Plan

Branch: `cloudflare`. Specs this plan implements: [`DASHBOARD-SPEC.md`](DASHBOARD-SPEC.md) (data contract + views) and [`tools/cloud-sync/CLOUDFLARE-SYNC-SPEC.md`](../tools/cloud-sync/CLOUDFLARE-SYNC-SPEC.md) (sync).

Written to be split across parallel agents. Each task names the files it **owns**; no two tasks in the same wave own the same file.

## Already done (on this branch)

- XP table with emitters, doubled levels, no retroactive XP, derived streak/shield fold — `award-xp` skill (`.claude` + `.junie`).
- `/start` emits `session_ignition`; `/debrief` emits `micro_step`, `adr_landing`, `property_bug`, `public_artifact`.
- 18 achievements with `tier`; ambiguous criteria made checkable.
- `DASHBOARD-SPEC.md` matches the real `session-01.json` / `feed.json`; Focus mode is read-only.
- Worker: fail-closed auth (aud/iss/tid/nbf/alg/scope), ledger merge with derived profile, private fields stripped, opt-in leaderboard. Type-checks (`npm run typecheck`); `schema.sql` applies to local D1.

## Rules for every agent

1. Read `CLAUDE.md` first. This is a learning repo: **never** touch `projects/`, `curriculum/`, or any `// LEARNER:` marker.
2. **Never write** `progress/profile.json`, `progress/feed.json`, `progress/sessions/*`, the `unlocked[]` of `progress/achievements.json`, `progress/journal.md`, or `.claude/buddy/*`. Those have single writers.
3. Never run `wrangler deploy`, `wrangler d1 … --remote`, or `wrangler login`. Local only (`--local`, Miniflare, vitest).
4. Work in a worktree on `cloudflare-<task-id>` (not `cloudflare/…` — git can't nest under an existing `cloudflare` branch). Before your first edit, check `git merge-base --is-ancestor cloudflare HEAD`; if it fails, `git reset --hard cloudflare` — worktrees may be cut from `main`. Don't push; the orchestrator merges into `cloudflare` and pushes.
5. Every `.claude/…` file you change has a `.junie/…` twin; change both identically.
6. Done = the task's acceptance commands pass and are pasted in the hand-off.

## Wave 1 — parallel

### T1 · Worker modules + test suite
**Owns:** `tools/cloud-sync/**` (except `CLOUDFLARE-SYNC-SPEC.md`).
- Split `worker.ts` into `src/index.ts` (routing/CORS), `src/auth.ts` (JWT), `src/sync.ts` (handlers + `rebuildProfile`), `src/rules.ts` (`computeLevel`, `computeStreak`, `LEVELS`). Behaviour unchanged; update `wrangler.toml` `main`.
- Add vitest + `@cloudflare/vitest-pool-workers` (D1 via Miniflare). `npm test` script.
- Tests, at minimum:
  - `computeLevel` at 0, 600, 601, 1600, 1601, 9000, 9001.
  - `computeStreak`: single day → 1/0; `06-01..06-03,06-05` → 4/0; `06-01..06-03,06-06` → 1/1; duplicate dates ignored.
  - Auth (generate an RSA key in the test, stub the JWKS `fetch`): valid token passes; placeholder client ID → 503; wrong `aud`, wrong `iss`, `tid` not allowed, expired, future `nbf`, `alg: none` / `HS256`, missing scope → 401.
  - Sync: two pushes with disjoint sessions → `xp_total` is the sum; re-push of a session with lower XP does not overwrite; `reflection`/`buddy_questions_asked` absent from stored `session_json`; leaderboard hides learners who did not opt in; `/api/state` round-trips sessions.
- **Accept:** `npm ci && npm run typecheck && npm test` green.

### T2 · Single source for XP rules
**Owns:** `progress/rules.json` (new), `.claude/skills/award-xp/SKILL.md`, `.junie/skills/award-xp/SKILL.md`.
- Create `progress/rules.json`: `{ schema_version: 1, xp_events: {event: xp}, micro_step_max: 5, levels: [{id, name, min, max|null}], shields: {every: 3, max: 3} }` with the current values from the skill.
- Skill: replace the XP and level tables with "read `progress/rules.json`" (keep the "Emitted by" column as prose). Add: write `schema_version: 1` and `xp_breakdown` on every new session file; add `streak_shields` to `feed.json`.
- **Accept:** `python -c "import json;json.load(open('progress/rules.json'))"`; every event named in the skill exists in `rules.json` and vice versa (show the grep).

### T3 · Focus mode in the dashboard artifact
**Owns:** the claude.ai Design artifact `https://claude.ai/artifact/EfeuGDbr9yb8RTrmJzs6Tf`, `.claude/commands/debrief.md` + `.junie` twin (republish table only).
- Needs the Artifact tool — run in a main session, not a subagent without it. Read every artboard before editing; keep hand edits.
- Add `Cockpit` and `Hangar` artboards per `DASHBOARD-SPEC.md` Mode A, plus a Focus/Analytics toggle (`localStorage`, try/catch). Read-only: commands are copy buttons, nothing writes.
- Hangar Blueprint: one SVG region per `tier`, lit by `unlocked[]`. No other inputs.
- Add the two artboards to the `/debrief` republish table with their `getData()` shape.
- **Accept:** artifact republished; screenshot or read-back of both artboards rendering `session-01` data; no-gap and after-gap copy checked (no streak-loss wording).

### T4 · CI for cloud-sync
**Owns:** `.github/workflows/cloud-sync.yml` (new).
- Trigger on `push` and `pull_request` with `paths: tools/cloud-sync/**, progress/rules.json`. Node 24, `working-directory: tools/cloud-sync`, `npm ci`, `npm run typecheck`, `npm test --if-present`. No secrets, no deploy step.
- **Accept:** `npx --yes @action-validator/cli .github/workflows/cloud-sync.yml` (or equivalent) passes; workflow does not reference any secret.

## Wave 2 — after Wave 1 merges

### T5 · Worker reads `progress/rules.json` · needs T1, T2
**Owns:** `tools/cloud-sync/src/rules.ts`, `tools/cloud-sync/tsconfig.json`, tests for it.
- Import the JSON (`resolveJsonModule`; wrangler bundles it). Delete the hard-coded `LEVELS` and shield constants. Add a test that fails if `rules.json` and the worker disagree.
- **Accept:** `npm run typecheck && npm test`.

### T6 · `/sync` command · needs T1, T2
**Owns:** `.claude/commands/sync.md` + `.junie` twin; the hydrate section of the `award-xp` skill (both copies).
- `/sync push`: token via `az account get-access-token --scope api://<client-id>/Progress.Sync --query accessToken -o tsv`; payload = all session files minus `reflection`/`buddy_questions_asked`/`notes`, plus `achievements.json.unlocked`; `POST /api/sync`; print the returned profile next to the local one.
- `/sync pull`: `GET /api/state`; pass sessions missing locally to `award-xp` with `event: hydrate`. Specify hydrate in the skill: adds missing session files verbatim (no new XP), then recomputes profile/feed. Never overwrites an existing session file.
- API base URL and client ID come from env (`CLOUD_SYNC_URL`, `CLOUD_SYNC_CLIENT_ID`); missing → explain and stop.
- **Accept:** dry run against `npx wrangler dev` with a test token from T1's helpers; local files unchanged after `push`.

### T7 · Analytics mode refresh · needs T3
**Owns:** the Main/Session/Achievements artboards.
- Achievements grouped by `tier`; shields in the status bar; XP line uses `xp_breakdown` when present.
- **Accept:** read-back of the three artboards rendering current data.

## Human-only gates (no agent can close these)

| # | Question | Blocks |
|---|---|---|
| H1 | Is a cross-learner leaderboard actually wanted? If not, stop after Wave 1. | T6, any deploy |
| H2 | IT: admin consent for an Entra app registration + GDPR OK for names/emails in a personal Cloudflare account. | deploy |
| H3 | Can a claude.ai artifact `fetch` an external origin with a bearer token? If not, sync stays CLI-only (T6) and the dashboard never calls the API. | any in-page sync UI |

## Suggested agent split

`T1`, `T2`, `T4` → three Sonnet agents in worktrees (disjoint files). `T3` → main session (needs the Artifact tool). Then `T5` + `T6` in parallel, `T7` after `T3`.

Note: `npm install` blocks `workerd`'s postinstall by default. `wrangler d1 --local` works without it; if `wrangler dev` or vitest's pool complains, run `npm install-scripts approve workerd` and reinstall.
