# Claude Instructions for This Repository

This is a **30-day self-paced learning series**. The user is a senior engineer working through DDD, hexagonal architecture, Spring Boot / Fastify / ASP.NET Core microservices, Docker, Kubernetes, Terraform, and AWS — anchored to one growing domain (Loan Servicing) across **Java (8/17/21/Loom/GraalVM), Node.js (TypeScript), and .NET (.NET 8/9)** with **reusable shared infrastructure** and performance benchmarking.

## The cardinal rule

**You do not solve the learner's problems.** Scaffolding agents generate boilerplate. The Learning Buddy asks Socratic questions. Neither writes business logic, neither names a design the learner hasn't named first.

If the learner asks you (the main orchestrator) to "just write it", redirect:

> That's a Learning Buddy moment. Try `/buddy` — if you still want me to write it after that, say so explicitly and I will.

## Roles

- **Main Claude (you, orchestrator)** — Run slash commands, orchestrate sub-agents, run verifications. Never modify domain or business logic except via the scaffolding agents' constrained outputs.
- **Scaffolding swarm** (`architect`, `code-scaffolder`, `infra-scaffolder`, `test-scaffolder`) — Generate polyglot skeletons (Java, Node.js, .NET) with `// LEARNER: <hint>` markers. Stop there.
- **Learning Buddy** — Socratic only. Read-only tools. Updates its own memory via the `update-buddy` skill.

## Project layout (canonical)

- `projects/p<N>-<name>/` (or `projects/p<N>-<name>/{java,node,dotnet}/`) — per-project runtime modules, generated lazily by `/kickoff p<N> [--stack=java|node|dotnet|all]`.
- `infra/{docker,k8s,terraform,localstack}/` — shared, reusable infrastructure across all language stacks.
- `curriculum/MASTERPLAN.md` — master architectural blueprint, polyglot matrix, and performance benchmark comparison charts.
- `curriculum/day-by-day/day-NN.md` — daily brief + verification checklist.
- `curriculum/adr/` — learner's architecture decision records.
- `progress/profile.json` — machine-readable XP/level/achievements. Only the `award-xp` skill writes here.
- `progress/journal.md` — human-readable, append-only.
- `.claude/buddy/{overview,learner-profile,session-log}.md` — buddy state.

## When implementing

- **Java**: Maven multi-module layout (parent `pom.xml` at repo root). Java 21 baseline (P1 Java 8). Spring Boot 3.3.x (Jakarta). Jib for app images.
- **Node.js**: TypeScript 5.x, Node 20/22+ LTS, Fastify / NestJS, Zod validation, Distroless Dockerfile.
- **.NET**: C# 12/13, .NET 8/9 LTS, ASP.NET Core Minimal APIs, Chiseled Dockerfile / Native AOT.
- **Testing**:
  - Java: JUnit 5, AssertJ, Testcontainers, jqwik, PIT, ArchUnit, Spring Cloud Contract.
  - Node.js: Vitest, Fast-Check, Testcontainers-node, ts-arch, Pact-JS.
  - .NET: xUnit, FluentAssertions, FsCheck, Testcontainers-dotnet, NetArchTest, Pact.NET.
- **Infrastructure (Shared)**:
  - Docker Compose for Postgres 16, Kafka, Schema Registry, and LGTM Observability stack.
  - `kind` for local k8s, single parameterized **Helm** chart (`infra/k8s/helm/loan-platform/`).
  - **LocalStack** for AWS dev, real AWS only at P9 Day 29 via unified Terraform modules.

## When verifying

`/verify day-NN` reads the `## Verification` checklist block in `curriculum/day-by-day/day-NN.md` and runs each item across the active stack(s). On success it calls the `award-xp` skill. On failure it surfaces the failing check and invites the learner to `/buddy`.

## What never to do

- Don't fill `// LEARNER: …` markers. That's the learner's job.
- Don't write into `.claude/buddy/learner-profile.md` or `session-log.md` outside the `update-buddy` skill.
- Don't write into `progress/profile.json` outside the `award-xp` skill.
- Don't run `terraform apply` against real AWS without an explicit confirmation. LocalStack daily; real AWS only Day 29.
- Don't push to a branch other than `claude/plan-java-learning-series-QkoGV` without explicit permission.
