---
description: Run today's verification checklist for each active stack. Awards `daily_acceptance` XP per passing stack.
argument-hint: day-NN [--stack <id>]
---

Argument: `day-NN` (e.g., `day-05`). If missing, default to `day-{current_day}` from `progress/profile.json`. Optional `--stack <id>` limits the run to one stack.

Invoke the `verify-day` skill with the day number. It resolves each `verify:` item through the stack pack (`node tools/verify-resolve/resolve.mjs --day <N> --stack <id> --dry-run`), runs the commands in order per stack (stopping at the first failure in each stack), and prints one result row per stack. Active stacks come from `.github/learning-path.yml` (`stacks:` comma list, else `stack:`). Pass its output through. For each stack that fully passes, the skill calls `award-xp` (`daily_acceptance` with `stack`, `masterplan`, `mode`); the resulting banners are included automatically.

A verb the stack pack does not define fails with a message pointing at `stacks/<stack>/verify.yaml`.

Do not retry failed checks. Do not edit code to make a check pass.
