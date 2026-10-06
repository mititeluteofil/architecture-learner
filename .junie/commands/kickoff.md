---
description: Kickoff a project — run the full scaffolding swarm (architect → code → infra → test) with confirmation pauses.
argument-hint: p<N>
---

Argument: the project id (e.g., `p4`). If missing, abort and tell the learner to provide one.

Run the scaffolding swarm for `$ARGUMENTS` in this exact order, pausing for the learner's explicit confirmation between each step. Do **not** chain them silently.

### Step 1 — architect

Invoke the `architect` subagent with the project id. The architect reads `curriculum/day-by-day/day-NN.md` for the project's first day, the previous project's `PLAN.md` (if any), and the buddy overview, then returns a `PLAN.md` draft.

Write the returned plan to `projects/{full-project-folder}/PLAN.md` (resolve the folder name from the curriculum). Show the learner a one-paragraph summary and the path. Ask:

> Plan written to `projects/…/PLAN.md`. Review and reply "go" to run the code-scaffolder, or "edit" to tweak the plan first.

### Step 2 — code-scaffolder

On "go": invoke the `code-scaffolder` subagent. It generates the Maven module(s), stub Java files with `// LEARNER:` markers, ArchUnit skeletons, and `application.yml`. It runs `mvn -pl projects/… -am compile` as a smoke check.

Report: number of files created, count of `LEARNER:` markers, compile result. Ask:

> Code scaffolded. Reply "go" to run the infra-scaffolder, "test" to skip ahead to test scaffolds, or "stop" to start coding.

### Step 3 — infra-scaffolder

On "go": invoke the `infra-scaffolder` subagent. It extends `infra/{docker,k8s,terraform,localstack}` and `.github/workflows/` as appropriate for the project.

Report: files touched, `# LEARNER:` marker count, any LocalStack vs AWS divergence noted. Ask:

> Infra scaffolded. Reply "go" to run the test-scaffolder, or "stop".

### Step 4 — test-scaffolder

On "go": invoke the `test-scaffolder` subagent. It generates `*Test.java` skeletons with `fail("LEARNER: …")` bodies, jqwik properties, ArchUnit rules, Spring slice tests, Testcontainers fixtures, and (for P6) Spring Cloud Contract stubs.

Report: test classes created, test methods per class. Confirm `mvn -pl projects/… -am test` compiles (failures from `LEARNER:` markers are expected).

### Final summary

Print a compact summary table — files added, markers placed, modules registered with the parent POM. Suggest the learner runs `/start` to see today's brief.

Do not award XP. Scaffolding is not progress; filling the markers is.
