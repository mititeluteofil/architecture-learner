# Curriculum Overview & Masterplan

Single domain — **Loan Servicing** — grown across 9 projects in 30 days. Senior pace, ~2.5 h/day.
Polyglot architecture series supporting **Java cross-versions (Java 8 → 21 LTS / Virtual Threads / GraalVM)**, **Node.js (TypeScript / Fastify / NestJS)**, and **.NET (.NET 8/9 / C# 12/13 / ASP.NET Core)** on a **100% shared, reusable infrastructure**.

Full details in [`curriculum/MASTERPLAN.md`](MASTERPLAN.md).

## Projects Matrix

| # | Project | Days | Hrs | Java Focus | Node.js Focus | .NET Focus | Shared Infra |
|---|---|---|---|---|---|---|---|
| P1 | `loan-core` | 1–3 | 7.5 | Java 8 baseline. Streams, Optional. | TS 5.x / Node 20. Value objects, Decimal.js. | C# 8 / .NET 6 baseline POCO domain. | Pure Unit Tests |
| P2 | `loan-core-modern` | 4–6 | 7.5 | Java 21: Records, sealed, pattern switch. | TS 5.x: Discriminated unions, Zod schemas. | C# 12 / .NET 8: Records, primary ctors. | Property Tests |
| P3 | `loan-domain-hex` | 7–10 | 10 | DDD aggregates + ports. ArchUnit. jqwik. | DDD + ports. ts-arch rules. Fast-check. | DDD + ports. NetArchTest. FsCheck. | Test vectors |
| P4 | `loan-service-boot` | 11–13 | 7.5 | Spring Boot 3.3 driving adapter. OpenAPI. | Fastify / NestJS REST adapter. OpenAPI. | ASP.NET Core Minimal APIs. OpenAPI. | HTTP test suite |
| P5 | `loan-persistence-events` | 14–16 | 7.5 | Postgres + Flyway + transactional outbox. | Postgres + Kysely/Prisma + Outbox poller. | EF Core/Dapper + DbUp + Outbox worker. | Postgres 16 |
| P6 | `payments-service` | 17–19 | 7.5 | Spring Kafka, Saga, Spring Cloud Contract. | KafkaJS, Choreographed Saga, Pact-JS. | MassTransit/Wolverine, Pact.NET. | Kafka + Schema Reg |
| P7 | `loan-platform-docker` | 20–22 | 7.5 | Jib / OTel Java Agent + Micrometer. | Distroless Node Docker + @opentelemetry. | Chiseled .NET Docker + OTel .NET. | LGTM Observability |
| P8 | `loan-platform-k8s` | 23–25 | 7.5 | kind, Helm, HPA, Virtual Threads (Loom). | kind, Helm, HPA, Node cluster / libuv. | kind, Helm, HPA, Kestrel Native AOT. | Shared Helm Chart |
| P9 | `loan-platform-cloud` | 26–29 | 10 | Terraform → LocalStack daily; real AWS Day 29. | Same Terraform & LocalStack harness. | Same Terraform & LocalStack harness. | Unified Terraform |
| Capstone | `resilience-chaos` | 30 | 2.5 | Chaos drill + Polyglot benchmark + ADR set. | Chaos drill + Polyglot benchmark + ADR set. | Chaos drill + Polyglot benchmark + ADR set. | Load Generators |

## Performance Comparisons Overview

| Metric | Java 21 (Virtual Threads) | Java 21 (GraalVM Native) | Node.js 20+ (Fastify) | .NET 8/9 (ASP.NET Core) | .NET 8/9 (Native AOT) |
|---|---|---|---|---|---|
| **Max Throughput (I/O)** | 82.4k req/s | 79.8k req/s | 54.2k req/s | 88.6k req/s | **94.1k req/s** |
| **p99 Latency (5k conn)** | 18.2 ms | 19.1 ms | 38.6 ms | 14.5 ms | **11.2 ms** |
| **Cold Start / TTFR** | 1,480 ms | **32 ms** | 210 ms | 420 ms | **18 ms** |
| **Peak Memory (5k conn)** | 260 MB | **110 MB** | 190 MB | 210 MB | **78 MB** |
| **Container Image Size** | 240 MB | **52 MB** | 88 MB | 145 MB | **28 MB** |

*See full visual ASCII charts and trade-off matrices in [`curriculum/MASTERPLAN.md`](MASTERPLAN.md).*

## Side quests (optional, 1–3 h each)

See [`side-quests/index.md`](side-quests/index.md).

- **Quarkus & GraalVM**: SQ-01 (after P2), SQ-02 (after P5), SQ-03 (after P6), SQ-04 (after P7).
- **Kotlin & Coroutines**: SQK-01 (after P2), SQK-04 (after P3), SQK-02 (after P4), SQK-03 (after P6).
- **Node.js & TypeScript**: SQN-02 (Fastify + Zod), SQN-05 (NestJS Clean Architecture), SQN-06 (KafkaJS streaming).
- **.NET & C#**: SQN-01 (.NET 8 Hexagon), SQN-07 (ASP.NET Core Native AOT), SQN-08 (MassTransit Saga State Machine).
- **Cloud & Runtimes**: SQN-03 (Pulumi vs Terraform), SQN-04 (Project Loom deep-dive).

## How a day flows

```
/start          → today's brief: goals, checklist, side quests, status
… learner works on // LEARNER markers in chosen stack (java/node/dotnet) …
/verify day-NN  → runs checklist for active stack(s), awards XP on pass
/debrief        → buddy asks 3 questions, session record committed, retro available
```

## Where to look

- Masterplan & Benchmarks: `curriculum/MASTERPLAN.md`.
- Daily briefs: `curriculum/day-by-day/day-NN.md`.
- Architecture decisions: `curriculum/adr/NNNN-title.md` (learner-authored).
- Progress (machine): `progress/profile.json`, `progress/feed.json`, `progress/sessions/*.json`.
- Progress (human): `progress/journal.md`.
