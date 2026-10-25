---
description: Sync progress with Cloud Sync — push, pull, or show the leaderboard.
---

Argument: `push [--opt-in|--opt-out]`, `pull`, or `board`. Anything else: print this usage and stop.

**Preflight (all subcommands).** Require env `CLOUD_SYNC_URL` (no trailing slash) and `CLOUD_SYNC_CLIENT_ID`. If either is missing, say which, explain `export CLOUD_SYNC_URL=https://…` / `export CLOUD_SYNC_CLIENT_ID=<Entra app client id>` (ask the Cloud Sync admin for values), and stop.

**Token.** Run `az account get-access-token --scope api://$CLOUD_SYNC_CLIENT_ID/Progress.Sync --query accessToken -o tsv`. If `az` is missing or not logged in, tell the learner to run `! az login` and stop. Hold the token only in a shell variable for the curl call. **Never print it**, never write it to a file.

Never modify `progress/*`, `.claude/buddy/*`, or any project files in `push` and `board`.

## `/sync push [--opt-in|--opt-out]`

1. Build the payload: `node tools/cloud-sync/scripts/build-payload.mjs . [--opt-in|--opt-out]` (strips `reflection`, `buddy_questions_asked`, `notes`; includes `achievements.json.unlocked`). With neither flag, the server keeps the learner's previous leaderboard choice.
2. `curl -fsS -X POST "$CLOUD_SYNC_URL/api/sync" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @-` fed from the script's stdout. On HTTP failure, print the status/body (never the token) and stop.
3. Print the returned `profile` next to local `progress/profile.json` as a two-column table: `xp_total`, `level`, `streak_days`, `streak_shields`, `achievements_unlocked`. Flag every row where they differ with `<- differs`. Explain briefly: the server derives from all pushed sessions, so differences usually mean sessions only exist on one side (try `/sync pull`).

## `/sync pull`

1. `curl -fsS "$CLOUD_SYNC_URL/api/state" -H "Authorization: Bearer $TOKEN"`.
2. From the response `sessions[]`, select those whose `session` number has no `progress/sessions/session-NN.json` locally. Also collect `unlocked_achievements[]`.
3. If no session is missing and no unlock is missing, say "Already up to date" and stop.
4. Invoke the `award-xp` skill with `event: hydrate`, `sessions: [<missing records verbatim>]`, `unlocked_achievements: [...]`. Existing local session files are never overwritten. Show its banner.

## `/sync board`

1. `curl -fsS "$CLOUD_SYNC_URL/api/leaderboard" -H "Authorization: Bearer $TOKEN"`.
2. Print a compact table from `cohort[]`: rank, display_name, day (`current_day`), XP (`xp_total`), level (`level_name`), achievements (`achievements_unlocked`).
3. Note: only colleagues who opted in appear, within your tenant. To appear, run `/sync push --opt-in` (reversible with `--opt-out`). If the cohort is empty, say so.

No commentary beyond the above, no emojis.
