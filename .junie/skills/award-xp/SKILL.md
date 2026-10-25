---
name: award-xp
description: Award XP, update level, unlock achievements, and write a session record. Single writer for `progress/profile.json`, `progress/achievements.json`, `progress/sessions/session-NN.json`, and `progress/feed.json`. Invoked by `/verify` on success and by `/debrief`.
---

# award-xp

You are the single writer to the gamification state files. Direct edits by humans or other agents are out of contract.

## Inputs

The caller provides a JSON-ish brief:

```yaml
event: session_ignition | micro_step | daily_acceptance | side_quest | adr | adr_landing | property_bug | mutation_score | debrief | public_artifact | hydrate
day: 1
project: p1-loan-core-java8
verification:
  checks: [{label: "mvn …", passed: true}]
  all_passed: true
goals:
  - {id: g1, label: "…", status: done}
  - {id: g2, label: "…", status: in_progress}
decisions: [{summary: "Money as BigDecimal", adr: "ADR-0001"}]
blockers: [{text: "…", resolved: false}]
side_quests: [{id: "SQK-01", status: skipped}]
reflection: "…freeform learner text…"
buddy_questions_asked: ["…", "…", "…"]
duration_minutes: 150
planned_minutes: 150
```

## XP table

XP values live in **`progress/rules.json`** (`xp_events`) — read it on every call; it is the single source of truth. Never hard-code numbers here.

| event | Emitted by | Notes |
|---|---|---|
| session_ignition | `/start` | Once per day — first `/start` of the day. Re-runs are no-ops. |
| micro_step | `/debrief` | One per `## Main Quest` item marked `done` (max `micro_step_max`). |
| daily_acceptance | `/verify` | Requires `verification.all_passed === true`. Stacks with micro_step. |
| side_quest | `/debrief` | Per side quest with `status: done`. |
| adr | `/debrief` | Per new `curriculum/adr/NNNN-*.md` with explicit trade-offs. |
| adr_landing | `/debrief` | Per ADR whose decision is exercised by a passing test (learner names the test). |
| property_bug | `/debrief` | jqwik surfaced a real invariant counterexample (learner supplies the seed). |
| mutation_score | `/verify` | PIT ≥80% on a module. Once per module. |
| debrief | `/debrief` | Always. |
| public_artifact | `/debrief` | Blog/gist URL supplied. |

Multiple events in one brief stack. Every event must be emitted by the command named above — never inferred.

**XP is never recomputed retroactively.** A session's `xp_earned` is fixed when it is written. Achievement XP is added to the `xp_earned` of the session in which it unlocks, so `xp_total = Σ sessions[].xp_earned` — nothing else. Changing `rules.json` only affects future sessions (session-01 keeps its 175 XP earned under the old `adr = 75`).

## Levels

Thresholds were doubled when micro_step/session_ignition raised a typical day from ~125 to ~250 XP, so L6 stays a day-28–30 goal.

Level bands (`levels[]`: `id`, `name`, `min`, `max`; L6 `max: null`) are read from `progress/rules.json`.

## Achievement criteria (evaluated each call)

See `progress/achievements.json` `definitions[]`. Each definition has a `criteria` string. You evaluate criteria deterministically using **Bash/Grep/Read** (e.g., `grep -rE 'sealed (interface|class)' projects/p2-loan-core-modern/src/main/java | wc -l`). If criteria text is ambiguous, **do not unlock** — log a note for the learner to refine the criteria.

## Files you write

1. **`progress/sessions/session-NN.json`** — the full session record (schema in `progress/DASHBOARD-SPEC.md`). Every new or merged session file carries `"schema_version": 1` and `xp_breakdown: [{event, xp}]` (from session-02 on; never back-fill session-01).
2. **`progress/profile.json`** — recompute `xp_total`, `level`, `xp_in_level`, `xp_to_next`, `streak_days`, `streak_shields`, `last_session_at`, `current_day`, `current_project`, `achievements_unlocked`, `achievements_total` (= `definitions.length`, never hard-coded).
3. **`progress/achievements.json`** — append newly-unlocked items to `unlocked[]`.
4. **`progress/feed.json`** — regenerate fully from all `sessions/*.json` plus `profile.json` + `achievements.json`; includes `streak_shields`.

## Streak & Shield rule

Streak and shields are **derived**, never incremented in place — that is what keeps re-runs idempotent. Fold over the sorted, de-duplicated session dates (UTC):

```
streak = 0; shields = 0; prev = null
for d in dates:
  if prev == null:            streak = 1
  else:
    missed = days(d - prev) - 1
    if missed == 0:           streak += 1
    elif missed <= shields:   shields -= missed; streak += 1   # one shield per missed day
    else:                     streak = 1                       # reset, no penalty, no shame copy
  if streak % rules.shields.every == 0:   shields = min(rules.shields.max, shields + 1)
  prev = d
```

`streak_days = streak`, `streak_shields = shields`. Shields start at 0. A gap that is still open today does not consume shields until the next session lands.

## Hard rules

- **One session file per day**. If `session-NN.json` already exists for `day:N`, edit it (merge events) rather than creating a duplicate.
- **Idempotent**: re-running with the same inputs must produce the same final state.
- **No silent unlocks**: every achievement unlock includes `evidence` (file path, command output snippet, or session reference).
- **No XP for verification failures**: if `verification.all_passed === false`, `daily_acceptance` is **not** awarded — but other concurrent events (side_quest, adr) still are if they qualify.

## Hydrate (`event: hydrate`)

Emitted only by `/sync pull`. It restores session history from Cloud Sync and **awards nothing**: `hydrate` is deliberately **not** in the XP table and **not** in `progress/rules.json` `xp_events` — drift checks between the skill's XP events and `rules.json` must ignore it.

Brief: `event: hydrate`, `sessions: [<full session records>]`, `unlocked_achievements: [{id, unlocked_at, session_id, evidence}]`.

1. For each record, if `progress/sessions/session-NN.json` (NN = `session`, zero-padded) does **not** exist, write the record verbatim — `xp_earned`, `xp_breakdown`, `events` and every other field as received. If it exists, **skip it; never overwrite**.
2. Do not append events, do not evaluate achievement criteria, do not award XP. `xp_earned` is kept as-is (so `xp_total = Σ sessions[].xp_earned` still holds).
3. Union `unlocked_achievements` into `achievements.json.unlocked[]`, de-duplicated by `id` (local entry wins).
4. Recompute `profile.json` and regenerate `feed.json` as usual (streak/shields fold over all session dates).
5. Banner: sessions restored (numbers), skipped (already local), unlocks added, resulting XP total/level/streak. Idempotent — a second identical call changes nothing.

Server records lack the private fields (`reflection`, `buddy_questions_asked`, `notes`); leave them absent.

## Process

1. Read existing `profile.json`, `achievements.json`, and `sessions/`.
2. Compute new XP from the brief; sum.
3. Walk achievement definitions; for each `not yet unlocked`, evaluate criteria; collect new unlocks.
4. Write/merge `session-NN.json`.
5. Recompute and write `profile.json`.
6. Append to `achievements.json.unlocked` if anything new.
7. Regenerate `feed.json` deterministically.
8. Print a short banner the orchestrator can show: XP earned this call, new level (if any), achievements unlocked (if any), streak.
