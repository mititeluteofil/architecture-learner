---
name: award-xp
description: Award XP, update level, unlock achievements, and write a session record. Single writer for `progress/profile.json`, `progress/achievements.json`, `progress/sessions/session-NN.json`, and `progress/feed.json`. Invoked by `/verify` on success and by `/debrief`.
---

# award-xp

You are the single writer to the gamification state files. Direct edits by humans or other agents are out of contract.

## Inputs

The caller provides a JSON-ish brief:

```yaml
event: session_ignition | micro_step | daily_acceptance | side_quest | adr | adr_landing | property_bug | mutation_score | debrief | public_artifact
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

| event | XP | Emitted by | Notes |
|---|---|---|---|
| session_ignition | 25 | `/start` | Once per day — first `/start` of the day. Re-runs are no-ops. |
| micro_step | 20 | `/debrief` | One per `## Main Quest` item marked `done` (max 5 = 100 XP). |
| daily_acceptance | 100 | `/verify` | Requires `verification.all_passed === true`. Stacks with micro_step. |
| side_quest | 150 | `/debrief` | Per side quest with `status: done`. |
| adr | 35 | `/debrief` | Per new `curriculum/adr/NNNN-*.md` with explicit trade-offs. |
| adr_landing | 40 | `/debrief` | Per ADR whose decision is exercised by a passing test (learner names the test). |
| property_bug | 50 | `/debrief` | jqwik surfaced a real invariant counterexample (learner supplies the seed). |
| mutation_score | 60 | `/verify` | PIT ≥80% on a module. Once per module. |
| debrief | 25 | `/debrief` | Always. |
| public_artifact | 200 | `/debrief` | Blog/gist URL supplied. |

Multiple events in one brief stack. Every event must be emitted by the command named above — never inferred.

**XP is never recomputed retroactively.** A session's `xp_earned` is fixed when it is written. Achievement XP is added to the `xp_earned` of the session in which it unlocks, so `xp_total = Σ sessions[].xp_earned` — nothing else. Changing this table only affects future sessions (session-01 keeps its 175 XP earned under the old `adr = 75`).

## Levels

Thresholds were doubled when micro_step/session_ignition raised a typical day from ~125 to ~250 XP, so L6 stays a day-28–30 goal.

| id | name | XP range |
|---|---|---|
| L1 | Apprentice | 0–600 |
| L2 | Journeyman | 601–1600 |
| L3 | Engineer | 1601–3200 |
| L4 | Senior | 3201–5600 |
| L5 | Staff | 5601–9000 |
| L6 | Architect | 9001+ |

## Achievement criteria (evaluated each call)

See `progress/achievements.json` `definitions[]`. Each definition has a `criteria` string. You evaluate criteria deterministically using **Bash/Grep/Read** (e.g., `grep -rE 'sealed (interface|class)' projects/p2-loan-core-modern/src/main/java | wc -l`). If criteria text is ambiguous, **do not unlock** — log a note for the learner to refine the criteria.

## Files you write

1. **`progress/sessions/session-NN.json`** — the full session record (schema in plan).
2. **`progress/profile.json`** — recompute `xp_total`, `level`, `xp_in_level`, `xp_to_next`, `streak_days`, `streak_shields`, `last_session_at`, `current_day`, `current_project`, `achievements_unlocked`, `achievements_total` (= `definitions.length`, never hard-coded).
3. **`progress/achievements.json`** — append newly-unlocked items to `unlocked[]`.
4. **`progress/feed.json`** — regenerate fully from all `sessions/*.json` plus `profile.json` + `achievements.json`.

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
  if streak % 3 == 0:         shields = min(3, shields + 1)
  prev = d
```

`streak_days = streak`, `streak_shields = shields`. Shields start at 0. A gap that is still open today does not consume shields until the next session lands.

## Hard rules

- **One session file per day**. If `session-NN.json` already exists for `day:N`, edit it (merge events) rather than creating a duplicate.
- **Idempotent**: re-running with the same inputs must produce the same final state.
- **No silent unlocks**: every achievement unlock includes `evidence` (file path, command output snippet, or session reference).
- **No XP for verification failures**: if `verification.all_passed === false`, `daily_acceptance` is **not** awarded — but other concurrent events (side_quest, adr) still are if they qualify.

## Process

1. Read existing `profile.json`, `achievements.json`, and `sessions/`.
2. Compute new XP from the brief; sum.
3. Walk achievement definitions; for each `not yet unlocked`, evaluate criteria; collect new unlocks.
4. Write/merge `session-NN.json`.
5. Recompute and write `profile.json`.
6. Append to `achievements.json.unlocked` if anything new.
7. Regenerate `feed.json` deterministically.
8. Print a short banner the orchestrator can show: XP earned this call, new level (if any), achievements unlocked (if any), streak.
