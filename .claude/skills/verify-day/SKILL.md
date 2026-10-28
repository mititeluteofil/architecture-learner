---
name: verify-day
description: Run the `## Verification` checklist in `curriculum/day-by-day/day-NN.md` for each active stack, resolving `verify:` verbs through the stack pack. On a stack's full pass, invoke `award-xp` with `event: daily_acceptance` for that stack. On failure, invite `/buddy` pointed at the failing check.
---

# verify-day

You execute the verification block of a day file. You do not write code; you run commands. Resolving an item to a command is done by `tools/verify-resolve/resolve.mjs`; **you** run the resolved commands (the resolver never executes anything).

## Inputs

- `day_number` (integer, 1-30).
- Optional `stack` override. Otherwise the active stacks come from `.github/learning-path.yml`: `stacks:` (comma list) when set, else `stack:` (default `java`).
- `masterplan` from `.github/learning-path.yml` (default `loan-servicing`); the manifest supplies project slots and any `dir` override.

## Item forms

| Checklist item | Meaning |
|---|---|
| `` `raw shell` `` | Runs unchanged, for every stack. |
| `verify: <verb> <slot> [args...]` | Command comes from `stacks/<stack>/verify.yaml`, with `{dir}` (the slot's project dir) and `{args}` substituted. |
| `verify: discipline p1 baseline` | Dotted verb: resolves `discipline.baseline` when the pack defines it. |

## Process

1. Read `curriculum/day-by-day/day-<NN>.md` and locate `## Verification`.
2. For each active stack, resolve the items:
   ```
   node tools/verify-resolve/resolve.mjs --day <N> --stack <stack> --dry-run
   ```
   (add `--masterplan <dir>` for a non-default masterplan). Output is one numbered line per item, in order: `[raw]`/`[verb]` with the command, or `[unsupported]` with a reason.
3. Run the commands **in order, stopping at the first failure, per stack**. A failure in one stack does not stop the other stacks.
4. An item resolved as `unsupported` is a **failed check** for that stack: show the resolver's reason, which names the verb and points at `stacks/<stack>/verify.yaml` (the pack that has to define it). Never substitute a guessed command.
5. Capture stdout/stderr (truncate each to 40 lines) and exit code per check.
6. Report **one row per stack**, then details for any failure:
   ```
   stack    result   checks
   java     PASS     4/4
   python   FAIL     1/4  (stopped at: verify: build p1 -> exit 1)
   ```
   Per-stack result object:
   ```json
   {
     "day": NN, "stack": "java",
     "checks": [
       { "label": "./mvnw -pl projects/p1-... -am verify", "passed": true, "exit_code": 0 },
       { "label": "...", "passed": false, "exit_code": 1, "tail": "..." }
     ],
     "all_passed": true | false
   }
   ```
7. **For each stack with `all_passed: true`**: call the `award-xp` skill once for that stack with `event: daily_acceptance`, the day number, the project, `stack: <stack>`, `masterplan: <id>`, `mode: <hands-on|assisted>` (the stack's current mode from `progress/profile.json` `stacks.<stack>.mode`, else `hands-on`) and that stack's result object. Print the banner it returns.
8. **For each stack with `all_passed: false`**: print the failing check, the last 40 lines of its output, and:
   > Stuck? Try `/buddy` - they can ask you a Socratic question pointed at this check.

## Rules

- **Read-only against the source tree.** You never edit code to make a check pass.
- **No interactive commands.** If a check needs a running service, the day file must list a setup command first.
- **Time-box per check at 5 minutes.** If a check times out, mark it failed with a `timeout` reason.
- **Don't award XP yourself.** Always go through `award-xp`, once per passing stack.
- **Never guess.** An `unsupported` verb fails; fix the pack, not the check.
