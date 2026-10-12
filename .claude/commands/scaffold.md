---
description: Run one scaffolding agent in isolation across Java, Node.js, or .NET.
argument-hint: <architect|code|infra|test> p<N> [--stack=java|node|dotnet|all]
---

Arguments: agent type, project id, and optional target stack (e.g., `code p4 --stack=node`).

Resolve the agent:
- `architect` → `architect` subagent
- `code` → `code-scaffolder` subagent
- `infra` → `infra-scaffolder` subagent
- `test` → `test-scaffolder` subagent

If the agent type is unrecognized, list the four valid options and abort.

Invoke the chosen subagent with the project id and target stack. Pass through its summary report to the learner verbatim — no additional commentary.

Use this command for partial reruns (e.g., the learner deletes a stub class and wants the code-scaffolder to regenerate just that one) or when the architect's plan needs a second pass after edits.

Do not award XP.
