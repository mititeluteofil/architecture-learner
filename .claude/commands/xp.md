---
description: Show current XP, level, streak, recent achievements, and a suggested next side quest.
---

Read `progress/profile.json`, `progress/achievements.json`, and `progress/feed.json`.

Print, in this exact format:

```
Day {current_day}/30 · {current_project}
Level {level.name} (L{N}) — {xp_total} XP — {xp_to_next} to next level
Streak: {streak_days}d
Achievements: {achievements_unlocked}/{achievements_total}

Recent achievements (last 3):
  • {name} — unlocked {date}
  • …

Suggested next side quest:
  {id} — {title} — {xp} XP — {hours}h
  (gated to: after {project_id})
```

The "suggested next side quest" is the first un-attempted side quest whose gate has been reached. Prefer Quarkus quests before Kotlin before nice-to-have, but if the learner has skipped a Quarkus quest twice already (check `sessions/*.json` for `status: skipped` on the same id), rotate to the next track.

Read-only. No file writes.
