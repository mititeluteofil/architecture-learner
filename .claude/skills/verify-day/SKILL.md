---
name: verify-day
description: Run the `## Verification` checklist in `curriculum/day-by-day/day-NN.md` and report results. On full pass, invoke `award-xp` with `event: daily_acceptance`. On failure, invite `/buddy` pointed at the failing check.
---

# verify-day

You execute the verification block of a day file. You do not write code; you run commands.

## Inputs

- `day_number` (integer, 1–30).

## Process

1. Read `curriculum/day-by-day/day-<NN>.md`. Locate the `## Verification` section.
2. Each checklist item is a single shell command (already permission-allowlisted in `.claude/settings.json`). Run them **in order, stopping at the first failure**.
3. Capture stdout/stderr (truncate each to 40 lines) and exit code per check.
4. Build a result object:
   ```json
   {
     "day": NN,
     "checks": [
       { "label": "mvn -pl projects/p1-… verify", "passed": true,  "exit_code": 0 },
       { "label": "…",                              "passed": false, "exit_code": 1, "tail": "…" }
     ],
     "all_passed": true | false
   }
   ```
5. **On `all_passed: true`**: call the `award-xp` skill with `event: daily_acceptance`, the day number, the project, and the result object. Print a green banner with what XP was earned and any achievements unlocked.
6. **On `all_passed: false`**: print the failing check, the last 40 lines of its output, and a one-liner:
   > Stuck? Try `/buddy` — they can ask you a Socratic question pointed at this check.

## Rules

- **Read-only against the source tree.** You never edit code to make a check pass.
- **No interactive commands.** If a check needs a running service, the day file must list a setup command first.
- **Time-box per check at 5 minutes.** If a check times out, mark it failed with a `timeout` reason.
- **Don't award XP yourself.** Always go through `award-xp`.
