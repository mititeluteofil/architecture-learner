# Cloudflare branch — what's left for you

Branch `cloudflare` → PR into `main`. Everything an agent could do is done: gamification v2, the dashboard Focus mode (v11 of the [dashboard](https://claude.ai/artifact/EfeuGDbr9yb8RTrmJzs6Tf)), the Cloud Sync worker (43 tests), `/sync` and CI. What follows needs you.

## 1. Refresh `progress/profile.json` (stale)

It still says `achievements_total: 15` and `xp_to_next: 125`, and has no `streak_shields`. Only the `award-xp` skill writes it, and every run recomputes it from `rules.json`, `achievements.json` and the session files.

- **Normal path:** run `/debrief` at the end of your next session (or a passing `/verify day-NN`). It fixes itself.
- **Right now, without a session:** ask Claude to "run award-xp with `event: hydrate` and no sessions". It awards nothing and only recomputes `profile.json` and `feed.json`. Expected result: 175 XP, L1, `xp_to_next` 425, 18 achievements total.

XP is never recomputed retroactively: session-01 stays at 175.

## 2. Review and merge the PR

- [ ] Check the "Cloud Sync" workflow is green on the PR (Actions tab). It couldn't be checked from here because `gh` isn't installed (`winget install GitHub.cli`, then `gh auth login`).
- [ ] Open the dashboard in a browser. No one has looked at the v11 artboards rendered yet (Main, Session, Achievements, Cockpit, Hangar).
- [ ] Merge.

## 3. Get the leaderboard live (optional; nothing in the curriculum depends on it)

| # | Step | Who |
|---|---|---|
| H2 | IT admin consent for an Entra app registration, plus a GDPR OK for colleagues' names and emails in your personal Cloudflare account. | You + IT |
| a | Register the Entra app (single tenant). Expose an API with scope `Progress.Sync`. Note the **client ID** and **tenant GUID**. | You |
| b | In `tools/cloud-sync/wrangler.toml`: set `AZURE_TENANT_ID` to the tenant GUID, `AZURE_CLIENT_ID` to the client ID and `ALLOWED_TENANT_IDS` to the tenant GUID. Until then the worker answers 503 to everything. | You or Claude |
| c | `npx wrangler login`, then `npx wrangler d1 create architecture-learner-db`, and copy the `database_id` into `wrangler.toml`. | You |
| d | `npx wrangler d1 execute architecture-learner-db --remote --file=./schema.sql` | You (Claude only with explicit go-ahead) |
| e | `npx wrangler deploy`, then check that `GET <worker-url>/api/health` returns `configured: true`. | You (Claude only with explicit go-ahead) |
| f | Set `CLOUD_SYNC_URL=<worker-url>` and `CLOUD_SYNC_CLIENT_ID=<client-id>`, run `az login`, then `/sync push --opt-in`. Verify with `/sync board`. | You |
| H3 | Find out whether a claude.ai artifact can `fetch` an external API with a bearer token. If not, sync stays CLI-only and that's fine. | You |

The first real `/sync push` is also the first end-to-end test: only the payload builder and the worker were tested, separately.

## 4. Housekeeping (whenever)

- [ ] `npm audit` in `tools/cloud-sync` reports 6 high-severity advisories, all in dev dependencies. Not yet triaged.
- [ ] `@cloudflare/vitest-pool-workers` is deprecated in favour of `@cloudflare/vitest-plugin`. Migrate when convenient.
- [ ] Delete the stale agent worktrees: `git worktree prune`, then remove `.claude/worktrees/` (it's untracked).

Details: [`progress/DASHBOARD-PLAN.md`](progress/DASHBOARD-PLAN.md) · [`tools/cloud-sync/CLOUDFLARE-SYNC-SPEC.md`](tools/cloud-sync/CLOUDFLARE-SYNC-SPEC.md)
