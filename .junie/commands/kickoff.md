---
description: Kickoff a project — run the full scaffolding swarm (architect → code → infra → test) with confirmation pauses across Java, Node.js, and .NET.
argument-hint: p<N> [--stack=java|node|dotnet|all]
---

Argument: the project id (e.g., `p4` or `p4 --stack=node` or `p4 --stack=all`). If missing, abort and tell the learner to provide one.

Run the scaffolding swarm for `$ARGUMENTS` in this exact order, pausing for the learner's explicit confirmation between each step. Do **not** chain them silently.

### Step 1 — architect

Invoke the `architect` subagent with the project id and requested target stack(s). The architect reads `curriculum/day-by-day/day-NN.md`, `curriculum/MASTERPLAN.md`, the previous project's `PLAN.md` (if any), and the buddy overview, then returns a `PLAN.md` draft.

Write the returned plan to `projects/{full-project-folder}/PLAN.md` (resolve the folder name from the curriculum). Show the learner a one-paragraph summary and the path. Ask:

> Plan written to `projects/…/PLAN.md`. Review and reply "go" to run the code-scaffolder, or "edit" to tweak the plan first.

### Step 2 — code-scaffolder

On "go": invoke the `code-scaffolder` subagent. It generates the project files (`pom.xml`, `package.json`, `.csproj`), stub files with `// LEARNER:` markers, architecture tests (ArchUnit / ts-arch / NetArchTest), and configuration files. It runs a smoke compilation check.

Report: number of files created, count of `LEARNER:` markers, compile result across target stack(s). Ask:

> Code scaffolded. Reply "go" to run the infra-scaffolder, "test" to skip ahead to test scaffolds, or "stop" to start coding.

### Step 3 — infra-scaffolder

On "go": invoke the `infra-scaffolder` subagent. It extends reusable infrastructure under `infra/{docker,k8s,terraform,localstack}` (supporting Java, Node.js, and .NET runtime images seamlessly).

Report: files touched, `# LEARNER:` marker count, any LocalStack vs AWS divergence noted. Ask:

> Infra scaffolded. Reply "go" to run the test-scaffolder, or "stop".

### Step 4 — test-scaffolder

On "go": invoke the `test-scaffolder` subagent. It generates test skeletons with `fail("LEARNER: …")` bodies, property-based tests (jqwik / Fast-Check / FsCheck), architecture rules, slice tests, and Testcontainers fixtures.

Report: test classes created, test methods per class. Confirm test compilation passes and that markers fail as expected.

### Final summary

Print a compact summary table — files added, markers placed, target stack(s) registered. Suggest the learner runs `/start` to see today's brief.

Do not award XP. Scaffolding is not progress; filling the markers is.
