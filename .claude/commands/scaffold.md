---
description: Run one scaffolding agent in isolation.
argument-hint: <architect|code|infra|test> p<N> [--stack=<id>[,<id>]]
---

Arguments: agent type, project id and optional flags (e.g., `code p4 --stack=python`).

Resolve the agent:
- `architect` → `architect` subagent
- `code` → `code-scaffolder` subagent
- `infra` → `infra-scaffolder` subagent
- `test` → `test-scaffolder` subagent

If the agent type is unrecognized, list the four valid options and abort.

Invoke the chosen subagent with the project id. Pass through its summary report to the learner verbatim — no additional commentary.

Use this command for partial reruns (e.g., the learner deletes a stub class and wants the code-scaffolder to regenerate just that one) or when the architect's plan needs a second pass after edits.

Do not award XP.

## Flags

`--stack=<id>[,<id>]` — any directory under `stacks/`. Default: the `stack:` key in `.github/learning-path.yml`, else `java`. Reject an id with no `stacks/<id>/stack.yaml` and list the valid ones. Pass the masterplan (default `curriculum/masterplan.yaml`), project slot and stack id to the subagent; with several ids, invoke it once per stack.

Note: `--assisted` is not implemented yet (planned for Wave 5).
