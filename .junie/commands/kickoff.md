---
description: Kickoff a project — run the full scaffolding swarm (architect → code → infra → test) with confirmation pauses.
argument-hint: p<N> [--stack=<id>[,<id>]]
---

Arguments: the project id (e.g., `p4`) and optional flags (below). If missing, abort and tell the learner to provide one.

Run the scaffolding swarm for the project in `$ARGUMENTS` in this exact order, pausing for the learner's explicit confirmation between each step. Do **not** chain them silently.

### Step 1 — architect

Invoke the `architect` subagent with the project id. The architect reads `curriculum/day-by-day/day-NN.md` for the project's first day, the previous project's `PLAN.md` (if any), and the buddy overview, then returns a `PLAN.md` draft.

Write the returned plan to `projects/{full-project-folder}/PLAN.md` (resolve the folder name from the curriculum). Show the learner a one-paragraph summary and the path. Ask:

> Plan written to `projects/…/PLAN.md`. Review and reply "go" to run the code-scaffolder, or "edit" to tweak the plan first.

### Step 2 — code-scaffolder

On "go": invoke the `code-scaffolder` subagent. It generates the module(s) and manifests, stub files with `LEARNER:` markers (comment syntax from the pack), an architecture-rule skeleton, and config stubs. It runs the stack pack's `build` verb as a smoke check.

Report: number of files created, count of `LEARNER:` markers, compile result. Ask:

> Code scaffolded. Reply "go" to run the infra-scaffolder, "test" to skip ahead to test scaffolds, or "stop" to start coding.

### Step 3 — infra-scaffolder

On "go": invoke the `infra-scaffolder` subagent. It extends `infra/{docker,k8s,terraform,localstack}` and `.github/workflows/` as appropriate for the project.

Report: files touched, `# LEARNER:` marker count, any LocalStack vs AWS divergence noted. Ask:

> Infra scaffolded. Reply "go" to run the test-scaffolder, or "stop".

### Step 4 — test-scaffolder

On "go": invoke the `test-scaffolder` subagent. It generates test skeletons using the stack pack's failing-test idiom: unit, vector, property, architecture, slice, integration and (where there is a service boundary) contract tests.

Report: test classes created, test methods per class. Confirm the stack's tests build (failures from `LEARNER:` markers are expected).

### Final summary

Print a compact summary table — files added, markers placed, units registered with the repo aggregator. Suggest the learner runs `/start` to see today's brief.

Do not award XP. Scaffolding is not progress; filling the markers is.

## Flags

- `--stack=<id>[,<id>]` — any directory under `stacks/`. Default: the `stack:` key in `.github/learning-path.yml`, else `java`. With several ids, run the whole swarm once per stack, in the order given, pausing between stacks as well as between steps. Reject an id with no matching `stacks/<id>/stack.yaml` and list the valid ones.
- Resolve the project directory from the masterplan manifest (an explicit `dir` override wins), else the stack's `layout.project_dir` with `<N>` and `<slug>` filled in.

Pass the masterplan (default `curriculum/masterplan.yaml`), the project slot and the stack id to every subagent. The agents read the stack pack themselves; do not paraphrase it.

Note: `--assisted` and `--reset-impl` are not implemented yet (planned for Wave 5).
