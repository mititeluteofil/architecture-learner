# Side Quest Catalog

All side quests are **optional** and self-contained. Each has a gate (the project after which it unlocks), a time estimate, and an XP reward (150 XP each unless noted).

## Quarkus track (primary)

| id | title | gate | hrs | summary |
|---|---|---|---|---|
| SQ-01 | Quarkus First Light | after P2 | 2 | Port the P2 domain to Quarkus 3. GraalVM native image. Compare cold-start vs Spring. |
| SQ-02 | Panache vs JPA | after P5 | 2 | Same persistence layer in Quarkus Panache (active record). Contrast ergonomics & migration story. |
| SQ-03 | SmallRye Reactive Messaging | after P6 | 2 | Payments service in Quarkus with SmallRye vs Spring Kafka. Backpressure, error channels. |
| SQ-04 | Native Image Showdown | after P7 | 3 | Spring AOT vs Quarkus native. Build size, cold-start, peak memory chart. |

## Kotlin track

| id | title | gate | hrs | summary |
|---|---|---|---|---|
| SQK-01 | Kotlin Echo of Java 21 | after P2 | 2 | Same domain in Kotlin. Data classes vs records, sealed classes, `when`, null safety, scope functions. |
| SQK-04 | Arrow-kt at the Port | after P3 | 2 | Replace exception-based error handling with `Either<DomainError, T>` at the application port. |
| SQK-02 | Spring Boot + Coroutines | after P4 | 2 | Driving adapter rewritten with Kotlin + coroutines. Compare against virtual threads. |
| SQK-03 | Ktor for Payments | after P6 | 2.5 | Payments service in Ktor. Contrast against Spring MVC (platform threads) and Spring WebFlux. |

## Nice-to-have

| id | title | gate | hrs | summary |
|---|---|---|---|---|
| SQN-01 | .NET 8 Hexagon | after P3 | 2 | Hexagonal domain in C# 12 / .NET 8. Records, `required`, primary constructors. |
| SQN-02 | Fastify + Zod | after P4 | 1.5 | Node.js driving adapter with schema-first validation. Contrast type story. |
| SQN-03 | Pulumi vs Terraform | after P9 | 2 | Same EKS stack in Pulumi/TypeScript. Compare drift detection, state management. |
| SQN-04 | Project Loom Deep-Dive | anytime | 1.5 | Structured concurrency + scoped values, isolated from the platform code. |

## Suggested order

1. After P2 finishes: SQK-01 (cheap, broadens horizon) → SQ-01 (Quarkus baseline).
2. After P3: SQK-04 if functional error handling appeals.
3. After P4: SQK-02 then SQ-02 (if you went deep on JPA, contrast Panache now while it's fresh).
4. After P6: SQ-03 + SQK-03 paired — same service, two reactive stacks.
5. After P7: SQ-04 — the cold-start story is most legible right after containers.
6. Anytime: SQN-04 (Loom).

`/xp` will recommend the next gate-unlocked quest you haven't attempted.
