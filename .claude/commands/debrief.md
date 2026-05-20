---
description: End-of-session retro — 3 reflection questions, then record the session and award XP.
---

This command has three phases. Run them sequentially.

### Phase 1 — Reflect (Learning Buddy)

Invoke the `learning-buddy` subagent in "debrief mode". It must:

1. Read `.claude/buddy/{overview,learner-profile,session-log}.md`.
2. Run `git diff $(cat .claude/buddy/.last-debrief-sha 2>/dev/null || echo HEAD~10) HEAD --stat` (best-effort) to see what changed.
3. Ask exactly **three** reflection questions. The first is always: "What did you attempt today, and how far did you get?" The other two come from the buddy's read of the diff and profile.

Print the questions. Wait for the learner to answer all three in a single reply. Capture verbatim.

### Phase 2 — Collect the session data

Gather, from the learner's answers and the curriculum:

- `day` (from `progress/profile.json.current_day`)
- `project` (same)
- `duration_minutes` and `planned_minutes` — ask the learner if not stated.
- `main_quest.goals[].status` — ask the learner to mark each of today's goals (from the day file) as `done`, `in_progress`, or `not_started`.
- `decisions` — extract from reflection text; confirm with learner before recording.
- `blockers` — extract; confirm.
- `side_quests` — ask: "Did you attempt any side quests today? If so, which and what status?"
- `reflection` — the concatenated answers, lightly cleaned.
- `buddy_questions_asked` — the three questions from Phase 1.
- `verification` — if `/verify day-NN` was run in this session, use its result; else assume `all_passed: false` (no `daily_acceptance` XP, just `debrief`).

### Phase 3 — Commit the record

1. Invoke the `update-buddy` skill with a ≤200-word summary built from the reflection and decisions. It rewrites `learner-profile.md` and prepends to `session-log.md`.
2. Invoke the `award-xp` skill with the session data. Events to include: `debrief` always; `daily_acceptance` only if `verification.all_passed === true`; `side_quest` per completed side quest; `adr` per new ADR (check `curriculum/adr/` for files newer than the last session).
3. Record the current `HEAD` sha to `.claude/buddy/.last-debrief-sha` so the next `/debrief` knows where to diff from.
4. Print the retro banner: today's XP, level (and change if any), new achievements, streak. Tell the learner: "Open the Angular dashboard (or read `progress/feed.json`) for the visual retro."

If anything in Phase 2 is missing and the learner doesn't supply it, **abort and ask** rather than guessing. No half-recorded sessions.
