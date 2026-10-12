# Side Quest Catalog

All side quests are **optional** and self-contained. Each has a gate (the project after which it unlocks), a time estimate, and an XP reward (150 XP each unless noted).

## Quarkus & Native Image track

| id | title | gate | hrs | summary |
|---|---|---|---|---|
| SQ-01 | Quarkus First Light | after P2 | 2 | Port the P2 domain to Quarkus 3. GraalVM native image. Compare cold-start vs Spring. |
| SQ-02 | Panache vs JPA | after P5 | 2 | Same persistence layer in Quarkus Panache (active record). Contrast ergonomics & migration story. |
| SQ-03 | SmallRye Reactive Messaging | after P6 | 2 | Payments service in Quarkus with SmallRye vs Spring Kafka. Backpressure, error channels. |
| SQ-04 | Native Image Showdown | after P7 | 3 | Spring AOT vs Quarkus native vs .NET Native AOT. Build size, cold-start, peak memory chart. |

## Kotlin track

| id | title | gate | hrs | summary |
|---|---|---|---|---|
| SQK-01 | Kotlin Echo of Java 21 | after P2 | 2 | Same domain in Kotlin. Data classes vs records, sealed classes, `when`, null safety, scope functions. |
| SQK-04 | Arrow-kt at the Port | after P3 | 2 | Replace exception-based error handling with `Either<DomainError, T>` at the application port. |
| SQK-02 | Spring Boot + Coroutines | after P4 | 2 | Driving adapter rewritten with Kotlin + coroutines. Compare against virtual threads. |
| SQK-03 | Ktor for Payments | after P6 | 2.5 | Payments service in Ktor. Contrast against Spring MVC (platform threads) and Spring WebFlux. |

## Node.js / TypeScript track

| id | title | gate | hrs | summary |
|---|---|---|---|---|
| SQN-02 | Fastify + Zod Driving Port | after P4 | 1.5 | Node.js driving adapter with schema-first validation. Contrast type story & JSON parsing speed. |
| SQN-05 | NestJS Clean Architecture | after P4 | 2 | NestJS dependency injection container implementing Hexagonal driving/driven ports. |
| SQN-06 | KafkaJS vs Spring Kafka | after P6 | 2 | Payments event consumer with KafkaJS. Compare batch throughput, rebalance latency, backpressure. |

## .NET & C# track

| id | title | gate | hrs | summary |
|---|---|---|---|---|
| SQN-01 | .NET 8 Hexagon | after P3 | 2 | Hexagonal domain in C# 12 / .NET 8. Records, `required`, primary constructors, NetArchTest. |
| SQN-07 | ASP.NET Core Native AOT | after P4 | 2 | Minimal API compiled to Native AOT. Benchmark 18ms cold start and 24MB RSS footprint. |
| SQN-08 | MassTransit Saga State Machine | after P6 | 2.5 | Orchestrated payments saga with MassTransit & Kafka state machine in C#. |

## Platform & Performance track

| id | title | gate | hrs | summary |
|---|---|---|---|---|
| SQN-03 | Pulumi vs Terraform | after P9 | 2 | Same EKS stack in Pulumi/TypeScript. Compare drift detection, state management. |
| SQN-04 | Project Loom Deep-Dive | anytime | 1.5 | Structured concurrency + scoped values, isolated from the platform code. |
| SQN-09 | Polyglot Performance Shootout | after P8 | 3 | Run k6 load test across Java (Virtual Threads / GraalVM), Node.js (Fastify), and .NET 8 (AOT). |

## Suggested order

1. After P2 finishes: SQK-01 (cheap, broadens horizon) → SQ-01 (Quarkus baseline).
2. After P3: SQN-01 (.NET Hexagon) or SQK-04 (functional error handling).
3. After P4: SQN-02 (Fastify+Zod), SQN-07 (.NET Native AOT), or SQ-02 (Panache).
4. After P6: SQ-03 (Quarkus SmallRye), SQN-06 (KafkaJS), or SQN-08 (MassTransit Saga).
5. After P7: SQ-04 (Native Image Showdown) — cold-start comparisons.
6. After P8: SQN-09 (Polyglot Shootout).
7. Anytime: SQN-04 (Loom).

`/xp` will recommend the next gate-unlocked quest you haven't attempted.
