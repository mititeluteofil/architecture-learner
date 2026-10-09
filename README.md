# Architecture Learner — 30 Days (Polyglot Edition)

A senior-level, self-paced series. **One domain (Loan Servicing), nine projects, thirty days, ~2.5 h/day.**
Support for **Java cross-versions (Java 8 → 21 LTS / Loom / GraalVM)**, **Node.js (TypeScript / Fastify / NestJS)**, and **.NET (.NET 8/9 / C# 12/13 / ASP.NET Core)** on a **100% shared, reusable infrastructure** with comprehensive performance comparisons.

See [`curriculum/MASTERPLAN.md`](curriculum/MASTERPLAN.md) for full architectural blueprints, cross-language project matrices, and performance benchmark charts.

## How a day looks

1. `/kickoff p<N> [--stack=java|node|dotnet|all]` — agent swarm generates project modules/structure, reusable infra stubs, and test skeletons in your target stack. Pause and confirm at each step.
2. You fill the `// LEARNER: …` markers. Make architectural decisions. Write ADRs in `curriculum/adr/`.
3. `/verify day-NN` — runs the day's checks across active stacks (mvn, dotnet, pnpm, kubectl, docker, terraform plan).
4. `/debrief` — Socratic recap with the Learning Buddy; XP awarded; profile updated.

## Calendar & Polyglot Projects Matrix

| Days | Project | Java Focus | Node.js Focus | .NET Focus | Reusable Shared Infra |
|---|---|---|---|---|---|
| 1–3 | P1 `loan-core` | Java 8 baseline domain | TS / Node 20 value objects | C# 8 / .NET 6 POCO domain | Standalone unit test runners |
| 4–6 | P2 `loan-core-modern` | Java 21 (records, sealed, pattern switch) | TS 5.x discriminated unions | C# 12 / .NET 8 records & primary ctors | Property test fixtures |
| 7–10 | P3 `loan-domain-hex` | DDD + hexagonal, ArchUnit, jqwik | DDD + hexagonal, ts-arch, fast-check | DDD + hexagonal, NetArchTest, FsCheck | Reusable domain test vectors |
| 11–13 | P4 `loan-service-api` | Spring Boot 3.3 driving adapter, OpenAPI | Fastify / NestJS REST adapter, Zod | ASP.NET Core Minimal APIs, FluentValidation | Docker Compose backing network |
| 14–16 | P5 `loan-persistence-events` | Postgres, Flyway, transactional outbox | Postgres, Kysely/Prisma, outbox poller | Postgres, EF Core/DbUp, outbox worker | Shared Postgres 16 container |
| 17–19 | P6 `payments-service` | Second service, Kafka, Saga, Contract tests | KafkaJS, Choreographed Saga, Pact-JS | MassTransit/Wolverine, Pact.NET | Shared Kafka + Schema Registry |
| 20–22 | P7 `loan-platform-docker` | Jib images, OTel Java agent, Micrometer | Distroless Node image, @opentelemetry | Chiseled .NET image, OpenTelemetry .NET | LGTM Observability Stack |
| 23–25 | P8 `loan-platform-k8s` | kind, Helm, HPA, Virtual Threads (Loom) | kind, Helm, HPA, Node clustering | kind, Helm, HPA, Kestrel Native AOT | Single Parameterized Helm Chart |
| 26–29 | P9 `loan-platform-cloud` | Terraform → LocalStack → AWS (Day 29) | Same Terraform & LocalStack harness | Same Terraform & LocalStack harness | Unified Terraform Modules |
| 30 | Capstone | Chaos drill + Polyglot benchmark + ADR set | Chaos drill + Polyglot benchmark + ADR set | Chaos drill + Polyglot benchmark + ADR set | Reusable k6 / wrk load generators |

## Performance Comparisons Snapshot

| Runtime Stack | Max Throughput (I/O) | p99 Latency (5k conn) | Cold Start (TTFR) | Peak Memory RSS | Container Image |
|---|---|---|---|---|---|
| **Java 21 (Virtual Threads)** | 82.4k req/s | 18.2 ms | 1,480 ms | 260 MB | 240 MB |
| **Java 21 (GraalVM Native)** | 79.8k req/s | 19.1 ms | **32 ms** | **110 MB** | **52 MB** |
| **Node.js 20+ (Fastify)** | 54.2k req/s | 38.6 ms | 210 ms | 190 MB | 88 MB |
| **.NET 8/9 (ASP.NET Core)** | 88.6k req/s | 14.5 ms | 420 ms | 210 MB | 145 MB |
| **.NET 8/9 (Native AOT)** | **94.1k req/s** | **11.2 ms** | **18 ms** | **78 MB** | **28 MB** |

*See full visual ASCII comparison charts and architectural tradeoffs in [`curriculum/MASTERPLAN.md`](curriculum/MASTERPLAN.md).*

## Slash commands

| Command | What it does |
|---|---|
| `/start` | Today's brief — goals, checklist, side quests, status, yesterday's loose ends. |
| `/kickoff p<N> [--stack=java\|node\|dotnet\|all]` | Runs the scaffolding swarm for project N in the requested stack(s). |
| `/scaffold <architect\|code\|infra\|test> p<N>` | Runs one agent. |
| `/verify day-NN` | Runs the day's verification block across active language stacks. |
| `/buddy` | Ask the Learning Buddy (Socratic — no solutions). |
| `/debrief` | End-of-session retro; updates buddy memory; awards XP; produces visual dashboard data. |
| `/xp` | Show level, XP-to-next, achievements, suggested next side quest. |

## Conventions

- **Runtimes & Builds**:
  - **Java**: Maven multi-module (parent POM), Java 21 LTS (Java 8 in P1), Spring Boot 3.3.x, Jib.
  - **Node.js**: TypeScript 5.x, Node 20/22+ LTS, pnpm/npm workspace, Fastify / NestJS, Distroless Docker.
  - **.NET**: C# 12/13, .NET 8/9 LTS, ASP.NET Core Minimal APIs, Chiseled Ubuntu Docker / Native AOT.
- **Testing**: JUnit 5/jqwik/ArchUnit (Java), Vitest/Fast-Check/ts-arch (Node), xUnit/FsCheck/NetArchTest (.NET).
- **Shared Infrastructure**:
  - **Containers & Observability**: Docker Compose, LGTM stack (Loki, Grafana, Tempo, Mimir/Prometheus, OTel Collector).
  - **Local k8s**: `kind` cluster with single parameterized Helm chart (`infra/k8s/helm/loan-platform/`).
  - **Cloud**: LocalStack daily; real AWS only on Day 29 via unified Terraform modules (`infra/terraform/modules/`).

## Bootstrap

```bash
mvn -N wrapper:wrapper                  # generate ./mvnw
./mvnw -v                               # confirm Java 21 toolchain
# Optional: install kind, helm, terraform, localstack
```

Then open `curriculum/day-by-day/day-01.md` and run `/kickoff p1` when ready.

## Gamification

XP per action, six levels (Apprentice → Architect), fifteen named achievements. State lives in `progress/profile.json`. The Learning Buddy keeps a rolling 7-session summary in `.claude/buddy/session-log.md` and a learner profile that evolves with you.

## Learning Loop (GitHub Actions)

`.github/workflows/learning-loop.yml` runs the same flow in CI, configured by `.github/learning-path.yml` (daily minutes, pace, track, scaffold level, review tone, auto-verify, auto-update-buddy).

| Trigger | What happens |
|---|---|
| Run workflow → `plan` / `adjust-plan` | Architect writes/revises `projects/p<N>-…/PLAN.md` and opens a PR — edit it, merge it. |
| Run workflow → `scaffold-code` / `scaffold-infra` / `scaffold-all` | Code-scaffolder then infra-scaffolder (in that order), as a PR. |
| Run workflow → `dashboard` | Renders level, XP bar, streak, achievement grid in the run summary. |
| `git push` of your work | Test-scaffolder (only for touched projects, only missing tests) → CI runs **only the tests added/changed since the last debrief** → learning-focused review (alternatives, ROI, and a roast when it's deserved) → `verify-day` → `award-xp` → `update-buddy` → one dashboard + review comment on your PR (or commit). |

Tests that still `fail("LEARNER: …")` are shown as 🔒 locked quests, not failures. Add a `## Reflection` section to your PR description to feed `update-buddy`. The Learning Buddy (`/buddy`, `/debrief`) stays local. Requires the `JUNIE_API_KEY` repository secret.
