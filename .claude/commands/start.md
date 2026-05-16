---
description: Start-of-session brief — what to do today, yesterday's loose ends, status.
---

Read `progress/profile.json` to determine `current_day`. Then assemble and print a compact brief with these sections, in order:

1. **Heading** — `Day {current_day} of 30 · Project {current_project} · Feature spotlight: {from day file} · ~2.5h`.
2. **Yesterday's loose ends** — from `progress/sessions/session-{current_day - 1}.json`:
   - Any `main_quest.goals` with `status: in_progress` (list).
   - Any `blockers` with `resolved: false` (list).
   - Count of `// LEARNER:` markers still in the active project (run: `grep -rn 'LEARNER:' projects/{current_project}/src 2>/dev/null | wc -l`).
   - Top 3 files with the most markers (heuristic).
   - If yesterday's session doesn't exist (it's day 1), say so politely.
3. **Today's main quest** — read `curriculum/day-by-day/day-{NN}.md`; print the `## Main Quest` section verbatim.
4. **Today's verification checklist** — print the `## Verification` section verbatim.
5. **Available side quests** — list any side quests gated to "after this day" from `curriculum/side-quests/index.md`. Include XP and time estimate per quest.
6. **Status line** — single line: `XP {xp_total} · Level {level.name} ({xp_in_level}/{xp_in_level + xp_to_next}) · Streak {streak_days}d · Achievements {achievements_unlocked}/{achievements_total}`.

Keep the whole brief under one screen. No commentary, no encouragement, no emojis. The learner wants signal, not narration.

Do not modify any files. This command is strictly read-only.
