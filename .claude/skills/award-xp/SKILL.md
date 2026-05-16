---
name: award-xp
description: Award XP, update level, unlock achievements, and write a session record. Single writer for `progress/profile.json`, `progress/achievements.json`, `progress/sessions/session-NN.json`, and `progress/feed.json`. Invoked by `/verify` on success and by `/debrief`.
---

# award-xp

You are the single writer to the gamification state files. Direct edits by humans or other agents are out of contract.

## Inputs

The caller provides a JSON-ish brief:

```yaml
event: daily_acceptance | side_quest | adr | property_bug | mutation_score | debrief | public_artifact
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

| event | XP |
|---|---|
| daily_acceptance | 100 |
| side_quest | 150 |
| adr | 75 |
| property_bug | 50 |
| mutation_score (≥80% on a module) | 60 |
| debrief | 25 |
| public_artifact (blog/gist) | 200 |

Multiple events in one brief stack. `daily_acceptance` requires `verification.all_passed === true`.

## Levels

| id | name | XP range |
|---|---|---|
| L1 | Apprentice | 0–300 |
| L2 | Journeyman | 301–800 |
| L3 | Engineer | 801–1600 |
| L4 | Senior | 1601–2800 |
| L5 | Staff | 2801–4500 |
| L6 | Architect | 4501+ |

## Achievement criteria (evaluated each call)

See `progress/achievements.json` `definitions[]`. Each definition has a `criteria` string. You evaluate criteria deterministically using **Bash/Grep/Read** (e.g., `grep -rE 'sealed (interface|class)' projects/p2-loan-core-modern/src/main/java | wc -l`). If criteria text is ambiguous, **do not unlock** — log a note for the learner to refine the criteria.

## Files you write

1. **`progress/sessions/session-NN.json`** — the full session record (schema in plan).
2. **`progress/profile.json`** — recompute `xp_total`, `level`, `xp_in_level`, `xp_to_next`, `streak_days`, `last_session_at`, `current_day`, `current_project`, `achievements_unlocked`.
3. **`progress/achievements.json`** — append newly-unlocked items to `unlocked[]`.
4. **`progress/feed.json`** — regenerate fully from all `sessions/*.json` plus `profile.json` + `achievements.json`.

## Streak rule

`streak_days += 1` if the previous session's date is exactly yesterday (UTC). Reset to 1 if there's a gap of ≥2 days. Same-day re-runs do not change the streak.

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
