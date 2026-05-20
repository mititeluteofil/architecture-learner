---
description: Run one scaffolding agent in isolation.
argument-hint: <architect|code|infra|test> p<N>
---

Arguments: agent type and project id (e.g., `code p4`).

Resolve the agent:
- `architect` → `architect` subagent
- `code` → `code-scaffolder` subagent
- `infra` → `infra-scaffolder` subagent
- `test` → `test-scaffolder` subagent

If the agent type is unrecognized, list the four valid options and abort.

Invoke the chosen subagent with the project id. Pass through its summary report to the learner verbatim — no additional commentary.

Use this command for partial reruns (e.g., the learner deletes a stub class and wants the code-scaffolder to regenerate just that one) or when the architect's plan needs a second pass after edits.

Do not award XP.
