---
name: award-xp
description: Award XP, update stack and global levels, titles, unlock achievements, and write a session record. Single writer for `progress/profile.json`, `progress/achievements.json`, `progress/sessions/session-NN.json`, and `progress/feed.json`. Invoked by `/verify` on success and by `/debrief`.
---

# award-xp

You are the single writer to the gamification state files. Direct edits by humans or other agents are out of contract.

A tested reference of the level/title algorithm below lives in `tools/gamification-ref/compute.mjs`. It is a spec oracle: if this document and the oracle disagree, fix the disagreement, do not pick silently.

## Inputs

The caller provides a JSON-ish brief:

```yaml
event: session_ignition | micro_step | daily_acceptance | side_quest | adr | adr_landing | property_bug | mutation_score | debrief | public_artifact | stack_ignition | comparison_note | diff_walkthrough | port_review | hydrate
day: 1
project: p1-loan-core-java8
masterplan: loan-servicing      # optional, default loan-servicing
stack: java                     # optional, default java
mode: hands-on                  # optional: hands-on | assisted, default hands-on
run: 1                          # optional, default = profile.run (else 1)
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

Absent `masterplan`, `stack`, `mode`, `run` in a brief default as above. The brief's `stack`, `mode`, `masterplan` and `run` are written onto the session record.

## XP table

XP values live in **`progress/rules.json`** (`xp_events`) — read it on every call; it is the single source of truth. Never hard-code numbers here.

| event | Emitted by | Notes |
|---|---|---|
| session_ignition | `/start` | Once per day — first `/start` of the day. Re-runs are no-ops. |
| micro_step | `/debrief` | One per `## Main Quest` item marked `done` (max `micro_step_max`). |
| daily_acceptance | `/verify` | Requires `verification.all_passed === true`. Stacks with micro_step. Multiplied in assisted mode (see below). |
| side_quest | `/debrief` | Per side quest with `status: done`. |
| adr | `/debrief` | Per new `curriculum/adr/NNNN-*.md` with explicit trade-offs. |
| adr_landing | `/debrief` | Per ADR whose decision is exercised by a passing test (learner names the test). |
| property_bug | `/debrief` | A property-based test surfaced a real invariant counterexample (learner supplies the seed). |
| mutation_score | `/verify` | Mutation score >=80% on a module (the stack's mutation tool). Once per module per stack. |
| debrief | `/debrief` | Always. |
| public_artifact | `/debrief` | Blog/gist URL supplied. |
| stack_ignition | `/start` | First session ever in a stack. Once per stack per run: skip when any session of the current run already has this `stack`. |
| comparison_note | `/debrief` | A `curriculum/comparisons/*.md` reflection section written by the learner (not a `LEARNER:` placeholder). |
| diff_walkthrough | `/debrief` | Assisted mode: completed a buddy compare session. |
| port_review | `/debrief` | Assisted mode: learner names an idiom difference with file refs. At most `port_review_max` per day. |

Multiple events in one brief stack. Every event must be emitted by the command named above — never inferred.

**Drift check:** the set of events in this table must equal the keys of `rules.json` `xp_events` (`hydrate` is deliberately in neither). `micro_step_max` and `port_review_max` are caps, not events.

**XP is never recomputed retroactively.** A session's `xp_earned` is fixed when it is written. Achievement XP is added to the `xp_earned` of the session in which it unlocks, so `xp_total = Σ sessions[].xp_earned` over the **current run** — nothing else. Changing `rules.json` only affects future sessions (session-01 keeps its 175 XP earned under the old `adr = 75`).

## Old-session defaults

A session file without `stack`, `mode`, `run` or `masterplan` is **read** as `stack: java, mode: hands-on, run: 1, masterplan: loan-servicing`. These defaults are applied in memory only: **never back-fill** existing session files, and never recompute their `xp_earned`. Session-01 therefore stays 175 XP = Java L1 Apprentice.

New and merged session files from this version on carry `"schema_version": 2` plus `masterplan`, `stack`, `mode`, `run`, and `xp_breakdown: [{event, xp}]`. Entries of `achievements_unlocked[]` carry `{id, stack, scope, xp, evidence}` (`stack: null` for common/polyglot).

## Modes

- `hands-on`: normal.
- `assisted`: every `daily_acceptance` XP is `floor(xp * rules.assisted.xp_multiplier)`; every other event is unchanged. A stack's ladder level is capped at `rules.assisted.level_cap` (XP still accumulates and is shown; only the level is capped). With `counts_for_titles: false` the stack is excluded from title prefixes. Per-stack and stack-scope achievements are not unlocked from assisted sessions (they require hands-on authorship); common and polyglot achievements are unaffected unless their criteria say hands-on.
- A stack's mode is the `mode` of its latest session in the current run. `--reset-impl` makes later sessions hands-on, which lifts the cap going forward; past XP is not recomputed.

## Ladders

Bands are read from `progress/rules.json`; never hard-code them.

- **Stack ladder** (`rules.levels`, L1 Apprentice to L6 Architect, `max: null` on L6): applied to that stack's XP.
  `stack_xp(stack) = Σ over current-run sessions with that stack of (xp_earned − Σ xp of achievements_unlocked[] entries with scope common or polyglot)`.
  Common and polyglot achievement XP therefore counts toward the global ladder only.
- **Global ladder** (`rules.global_levels`, L1 to L9 Fellow): applied to `xp_total` (current run, all stacks, all XP).
- `lifetime_xp = Σ xp_earned over all runs` (the live run plus `progress/archive/*`; with no archive it equals `xp_total`).

`profile.json` `level` stays as an alias of the **active** stack's level (the stack of the latest session), computed on the stack ladder, so the existing dashboard keeps working.

Thresholds were doubled when micro_step/session_ignition raised a typical day from ~125 to ~250 XP, so L6 stays a day-28–30 goal for one stack.

## Multiplied titles (deterministic)

Inputs: `stacks{}` with each stack's level index (0 = L1, after the assisted cap) and `counts_for_titles`; `prestige`; `rules.title_prefixes`.

```
eligible = [s for s in stacks if s.counts_for_titles]      # hands-on only
idx      = sorted(s.level_index for s in eligible, descending)
combos   = []
for n in 2 .. min(len(eligible), max(keys of title_prefixes)):
    L = idx[n-1]                                           # highest level reached by >= n eligible stacks
    combos.append({level: levels[L].id, count: n,
                   title: stars + title_prefixes[n] + " " + levels[L].name})
sort combos by (L desc, n desc)
best_single = highest (level_index, then stack_xp, then stack id ascending) over ALL stacks
              -> stars + levels[L].name + " · " + StackLabel      # e.g. "Senior · Java"
headline    = combos[0].title if combos else best_single
stars       = rules.prestige.symbol repeated `prestige` times, followed by a space (empty when prestige = 0)
```

Stack labels: java Java, dotnet .NET, node Node, python Python, ruby Ruby (otherwise the id capitalised). Worked example: Java L4, Python L2, Ruby L2 hands-on gives combos `Trilingual Journeyman`, `Bilingual Journeyman`; headline `Trilingual Journeyman`; best single `Senior · Java`.

## Achievement criteria (evaluated each call)

Definitions come from `progress/achievements.json` `definitions[]` (scopes common, per-stack, polyglot) merged with `stacks/<id>/achievements.json` `definitions[]` for each stack in play (scope stack). Each definition has a `criteria` string. You evaluate criteria deterministically using **Bash/Grep/Read** and, for `verify:` verbs, the command the stack pack's `verify.yaml` maps the verb to. If criteria text is ambiguous, if a verb is not defined by the pack, or the criteria says it depends on something that does not exist yet, **do not unlock** — log a note for the learner to refine the criteria.

Unlock keys (what de-duplicates `unlocked[]`):

| scope | key | evaluated for |
|---|---|---|
| common | `id` | any session |
| polyglot | `id` | any session, needs 2+ stacks in play |
| per-stack | `id@stack` | the brief's `stack`, hands-on only |
| stack | `id@stack` | the brief's `stack` (must equal the definition's `stack`), hands-on only |

`unlocked[]` entries: `{id, stack (null for common/polyglot), run, unlocked_at, session_id, evidence}`. An entry with no `stack` and no `run` (written before v2) is read as `stack: null, run: 1`, and for a per-stack definition as `stack: java`. A key is "already unlocked" only when an entry with that key exists **for the current run**.

`achievements_total` in `profile.json` is derived: `count(common) + count(polyglot) + count(per-stack) × |stacks in play| + Σ over stacks in play count(stack definitions)`. Stacks in play = distinct `stack` values of the current run's sessions, plus the brief's stack; `java` when there are none. Never hard-code it and never use `definitions.length` alone.

## Files you write

1. **`progress/sessions/session-NN.json`** — the full session record (schema in `progress/DASHBOARD-SPEC.md`), `"schema_version": 2`, with `masterplan`, `stack`, `mode`, `run`, `xp_breakdown`. Never back-fill session-01 or any older file.
2. **`progress/profile.json`** — recompute `xp_total`, `level` (alias of the active stack), `xp_in_level`, `xp_to_next`, `streak_days`, `streak_shields`, `last_session_at`, `current_day`, `current_project`, `achievements_unlocked`, `achievements_total`, plus the v2 fields:
   - `run`, `prestige` (`run − 1`), `lifetime_xp`
   - `global_level: {id, name, xp_in_level, xp_to_next}`
   - `stacks: {<id>: {xp, level, mode}}` (`level` is the capped stack-ladder level)
   - `titles: {headline, best_single, combos[]}`
   - `schema_version: 2`
3. **`progress/achievements.json`** — append newly-unlocked items to `unlocked[]`.
4. **`progress/feed.json`** — regenerate fully from all `sessions/*.json` plus `profile.json` + `achievements.json`; includes `streak_shields`.

## Streak & Shield rule

Streak and shields are **derived**, never incremented in place — that is what keeps re-runs idempotent. The streak is a habit across all stacks and runs: fold over the sorted, de-duplicated session dates (UTC) of every session, whatever its stack or run (a fresh start does not reset it).

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

- **One session file per day**. If `session-NN.json` already exists for `day:N` in the same run, edit it (merge events) rather than creating a duplicate. One day in two stacks is two different days of work: the file is keyed by session number, and the brief's `stack` must match the existing file's `stack` to merge; otherwise write a new session.
- **Idempotent**: re-running with the same inputs must produce the same final state. This includes `stack_ignition` (once per stack per run), `port_review` (capped per day), unlock keys, and the derived `stacks{}`, `titles{}`, `global_level`.
- **No silent unlocks**: every achievement unlock includes `evidence` (file path, command output snippet, or session reference).
- **No XP for verification failures**: if `verification.all_passed === false`, `daily_acceptance` is **not** awarded — but other concurrent events (side_quest, adr) still are if they qualify.
- Do not touch `progress/archive/*` (written only by the masterplan fresh-start flow).

## Hydrate (`event: hydrate`)

Emitted only by `/sync pull`. It restores session history from Cloud Sync and **awards nothing**: `hydrate` is deliberately **not** in the XP table and **not** in `progress/rules.json` `xp_events` — drift checks between the skill's XP events and `rules.json` must ignore it.

Brief: `event: hydrate`, `sessions: [<full session records>]`, `unlocked_achievements: [{id, stack, run, unlocked_at, session_id, evidence}]`.

1. For each record, if `progress/sessions/session-NN.json` (NN = `session`, zero-padded) does **not** exist, write the record verbatim — `xp_earned`, `xp_breakdown`, `events`, and every other field as received, including `masterplan`, `stack`, `mode`, `run` when present. Absent fields stay absent (old-session defaults apply on read; never back-fill). If the file exists, **skip it; never overwrite**.
2. Do not append events, do not evaluate achievement criteria, do not award XP. `xp_earned` is kept as-is (so `xp_total = Σ sessions[].xp_earned` still holds for the current run).
3. Union `unlocked_achievements` into `achievements.json.unlocked[]`, de-duplicated by the unlock key (`id` for common/polyglot, `id@stack` otherwise) together with `run` (absent = null stack, run 1); local entry wins.
4. Recompute `profile.json` (including `run`, `prestige`, `lifetime_xp`, `global_level`, `stacks{}`, `titles{}`) and regenerate `feed.json` as usual (streak/shields fold over all session dates).
5. Banner: sessions restored (numbers), skipped (already local), unlocks added, resulting XP total/global level/headline title/streak. Idempotent — a second identical call changes nothing.

Server records lack the private fields (`reflection`, `buddy_questions_asked`, `notes`); leave them absent.

## Process

1. Read existing `profile.json`, `achievements.json`, `rules.json`, the pack achievements for stacks in play, and `sessions/`.
2. Resolve `masterplan`, `stack`, `mode`, `run` (brief, else profile, else defaults).
3. Compute new XP from the brief (apply the assisted multiplier to `daily_acceptance`); sum.
4. Walk achievement definitions; for each key not yet unlocked in this run, evaluate criteria; collect new unlocks. Add their XP to the session's `xp_earned` and record `scope`/`stack`/`xp` on each entry.
5. Write/merge `session-NN.json`.
6. Recompute `profile.json`: run totals, stack ladders (assisted cap), global level, multiplied titles, streak.
7. Append to `achievements.json.unlocked` if anything new.
8. Regenerate `feed.json` deterministically.
9. Print a short banner the orchestrator can show: XP earned this call, new stack level and global level (if changed), headline title (if changed), achievements unlocked (if any), streak.
