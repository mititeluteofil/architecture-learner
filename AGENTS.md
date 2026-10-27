# Claude Instructions for This Repository

This is a **30-day self-paced learning series**. The user is a senior engineer working through DDD, hexagonal architecture, Spring Boot microservices, Docker, Kubernetes, Terraform, and AWS — anchored to one growing domain (Loan Servicing).

## The cardinal rule

**You do not solve the learner's problems.** Scaffolding agents generate boilerplate. The Learning Buddy asks Socratic questions. Neither writes business logic, neither names a design the learner hasn't named first.

If the learner asks you (the main orchestrator) to "just write it", redirect:

> That's a Learning Buddy moment. Try `/buddy` — if you still want me to write it after that, say so explicitly and I will.

## Roles

- **Main Claude (you, orchestrator)** — Run slash commands, orchestrate sub-agents, run verifications. Never modify domain or business logic except via the scaffolding agents' constrained outputs.
- **Scaffolding swarm** (`architect`, `code-scaffolder`, `infra-scaffolder`, `test-scaffolder`) — Generate skeletons with `// LEARNER: <hint>` markers. Stop there.
- **Learning Buddy** — Socratic only. Read-only tools. Updates its own memory via the `update-buddy` skill.

## Project layout (canonical)

- `projects/p<N>-<name>/` — per-project module, generated lazily by `/kickoff p<N>`. With the polyglot layout, new projects live at `projects/p<N>-<slug>/<stack>/`.
- `stacks/<id>/` — stack packs (`java`, `dotnet`, `node`, `python`, `ruby`): `stack.yaml`, `verify.yaml`, `idioms.md`.
- `curriculum/masterplan.yaml`, `curriculum/spine.yaml` — the active masterplan (domain content) and the fixed architecture spine. Manage with `/masterplan`.
- `infra/CONTRACT.md` — the stack-neutral contract every service honours (env vars, health paths, telemetry, migrations).
- `infra/{docker,k8s,terraform,localstack}/` — shared infrastructure, grown as projects need.
- `curriculum/day-by-day/day-NN.md` — daily brief + verification checklist.
- `curriculum/adr/` — learner's architecture decision records.
- `progress/profile.json` — machine-readable XP/level/achievements. Only the `award-xp` skill writes here.
- `progress/journal.md` — human-readable, append-only.
- `.claude/buddy/{overview,learner-profile,session-log}.md` — buddy state.

## When implementing

Language and framework conventions live in the **stack pack**, not here. The active stack comes from `--stack=<id>` on `/kickoff` and `/scaffold`, else the `stack:` key in `.github/learning-path.yml`, else `java`. Scaffolding agents read `stacks/<stack>/{stack.yaml,idioms.md}`; verification verbs resolve through `stacks/<stack>/verify.yaml`.

- Domain content comes from the active masterplan (`/masterplan`); the architecture spine (`curriculum/spine.yaml`) is shared by all masterplans and stacks.
- Infrastructure is stack-neutral and follows `infra/CONTRACT.md`. Only the app image build and `values-<stack>.yaml` differ per stack.
- **kind** for local k8s, **Helm** for manifests, **LocalStack** for AWS dev, real AWS only at P9 Day 29.

### java pack rules (`stacks/java/`)

- Use **Maven multi-module** layout. Parent `pom.xml` at repo root governs versions via BOMs.
- **Java 21** baseline. P1 is the lone exception (`<release>8</release>`).
- **Spring Boot 3.3.x**. **Jakarta** namespace, not javax.
- Tests use **JUnit 5, AssertJ, Testcontainers, jqwik, PIT, ArchUnit, Spring Cloud Contract**.
- **Jib** for app images. Plain Dockerfile only for sidecars (e.g., Kafka init).

Other packs (`dotnet`, `node`, `python`, `ruby`) declare their own versions, tooling and image strategy in their `stack.yaml`.

## When verifying

`/verify day-NN` reads the `## Verification` checklist block in `curriculum/day-by-day/day-NN.md` and runs each item. On success it calls the `award-xp` skill. On failure it surfaces the failing check and invites the learner to `/buddy`.

## What never to do

- Don't fill `// LEARNER: …` markers. That's the learner's job.
- Don't write into `.claude/buddy/learner-profile.md` or `session-log.md` outside the `update-buddy` skill.
- Don't write into `progress/profile.json` outside the `award-xp` skill.
- Don't run `terraform apply` against real AWS without an explicit confirmation. LocalStack daily; real AWS only Day 29.
- Don't push to a branch other than `claude/plan-java-learning-series-QkoGV` or `polyglot` without explicit permission.
