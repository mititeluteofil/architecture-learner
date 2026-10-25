# Cloud Sync (Cloudflare Workers + D1, Microsoft sign-in) — Deferred Spec

Status: **in progress on branch `cloudflare`, not deployed.** Nothing in the 30-day curriculum depends on this. The local `progress/` files plus the claude.ai dashboard artifact are the full product. Agent tasks: [`progress/DASHBOARD-PLAN.md`](../../progress/DASHBOARD-PLAN.md).

## Before building

Human-only gates. Code can be written and tested without them, but nothing is deployed until all three are answered; each one can kill the feature.

1. **Is there a need?** The claude.ai artifact is already hosted, private, and multi-device. The only thing this adds is a cross-learner leaderboard. With one learner, skip it.
2. **Corporate tenant approval.** Registering an Entra app and letting colleagues sign in usually needs admin consent from IT, and sending work identities (name, email) to a personally-owned Cloudflare account is a data-processing question (GDPR). Get a yes before writing code.
3. **Can the dashboard even call it?** The current dashboard is a claude.ai artifact; whether it may `fetch` an external origin with a bearer token is an open question. If not, sync has to happen from the CLI (a `/sync` command calling the API), not from the page.

## Files

```text
tools/cloud-sync/             # dashboard tooling, not curriculum infra (that is infra/)
├── CLOUDFLARE-SYNC-SPEC.md   # this file
├── schema.sql                # D1 schema: two ledgers + one derived cache
├── src/
│   ├── index.ts              # fetch handler: routing, CORS, fail-closed config check
│   ├── auth.ts               # Entra access-token verification
│   ├── sync.ts               # sync/state/leaderboard handlers + rebuildProfile
│   ├── rules.ts              # levels + streak/shield fold
│   └── http.ts               # json() helper
├── test/                     # vitest + Miniflare D1 (rules, auth, sync)
├── wrangler.toml             # bindings; refuses requests until configured
├── package.json / tsconfig.json / vitest.config.ts
```

```bash
cd tools/cloud-sync && npm ci && npm run typecheck && npm test
```

## Principles

1. **Offline-first.** No account, network, or cloud is ever required. `progress/` stays the source of truth, written only by `award-xp`.
2. **Ledgers, not field merges.** Sessions and achievement unlocks are ledgers: sessions upsert by `session` number (the copy with more XP wins, replaced whole); unlocks are a set union. The profile — `xp_total = Σ xp_earned`, level, `current_day`, streak and shields (same fold as `award-xp`) — is **re-derived** after every sync. `MAX(local, cloud)` per field is wrong: two machines with different sessions would lose one side's XP.
3. **Privacy.** `journal.md`, `reflection`, and `buddy_questions_asked` never leave the machine — the client omits them and the worker strips them again. The leaderboard is **opt-in** (`leaderboard_opt_in`, default off).
4. **Fail closed.** Until `AZURE_CLIENT_ID` and a tenant allowlist are set, every protected route returns `503`.

## Auth

- SPA uses Authorization Code + PKCE against Entra ID and requests an **access token** for this API's scope (`api://<client-id>/Progress.Sync`). ID tokens are for the client, not for calling APIs — the worker rejects them (wrong audience).
- The worker checks: `alg = RS256`, signature against the tenant's JWKS (edge-cached 24h), `exp`/`nbf` (±5 min), `aud ∈ {client-id, api://client-id}`, `tid` in the allowlist, `iss = https://login.microsoftonline.com/{tid}/v2.0`, and `scp` contains `REQUIRED_SCOPE`.
- CORS allows exactly one origin (`ALLOWED_ORIGIN`), never `*`.

## API

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/health` | public | `{ status, configured }` |
| `POST /api/sync` | bearer | Body `{ sessions: Session[], unlocked_achievements?: AchievementUnlock[], leaderboard_opt_in?: boolean }` (shapes from `progress/DASHBOARD-SPEC.md`). Returns the re-derived profile. |
| `GET /api/state` | bearer | Ledgers + cached profile, for a new machine. The caller hands sessions to `award-xp` to merge into `progress/`; nothing else writes those files. |
| `GET /api/leaderboard` | bearer | Opted-in learners in the caller's tenant, top 50 by XP. |

`feed.json` is not synced; it is a pure function of the other files and `award-xp` regenerates it after a hydrate.

## Deploy (once "Before building" is resolved)

1. **Entra app registration** (single tenant): expose an API with scope `Progress.Sync`; add SPA redirect URIs for the dashboard origin. Put the client ID and tenant GUID in `wrangler.toml`.
2. **D1**:
   ```bash
   npx wrangler login
   npx wrangler d1 create architecture-learner-db          # copy database_id into wrangler.toml
   npx wrangler d1 execute architecture-learner-db --local  --file=./schema.sql
   npx wrangler d1 execute architecture-learner-db --remote --file=./schema.sql
   ```
3. **Run / deploy**: `npx wrangler dev`, then `npx wrangler deploy`. Check `GET /api/health` reports `configured: true`.
