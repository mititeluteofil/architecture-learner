---
description: Run today's verification checklist. Awards `daily_acceptance` XP on full pass.
argument-hint: day-NN
---

Argument: `day-NN` (e.g., `day-05`). If missing, default to `day-{current_day}` from `progress/profile.json`.

Invoke the `verify-day` skill with the day number. Pass through its output. If the skill awards XP via `award-xp`, the resulting banner is included automatically.

Do not retry failed checks. Do not edit code to make a check pass.
