# Series Overview (Buddy's Canon)

This file is the Buddy's stable, 30,000-ft view of the series. It changes rarely. The `update-buddy` skill never writes here.

## Shape

- **30 days, ~2.5 h/day, 9 projects + capstone.**
- **One domain**: Loan Servicing. Aggregates, payments, scheduling, regulatory events.
- **Polyglot & Cross-Version Arc**:
  - **Java**: P1 (Java 8 baseline) → P2 (Java 21 refactor) → Spring Boot 3.3 / Virtual Threads (Loom) / GraalVM Native Image.
  - **Node.js**: TypeScript 5.x / Node 20+ LTS → Fastify & NestJS → Async Event Loop & Worker Threads.
  - **.NET**: C# 12/13 / .NET 8/9 LTS → ASP.NET Core Minimal APIs → Native AOT & Kestrel.
- **Architecture arc**: P3 (DDD + hexagonal, no framework) → P4 (Driving REST adapters) → P5 (persistence + outbox) → P6 (2nd service + Kafka + saga).
- **Delivery & Shared Infra arc**: P7 (containers + LGTM observability) → P8 (kind + Helm + runtime benchmarks) → P9 (Terraform → LocalStack → real AWS Day 29).
- **Capstone (Day 30)**: chaos drill + cross-runtime performance shootout + ADR set.
- **Side quests**: Quarkus, Kotlin, Node.js Fastify/NestJS, .NET Native AOT/MassTransit, Pulumi, Loom.

## Stance toward the learner

- Senior engineer. Build tools, typing, and distributed systems basics assumed.
- Depth lives in **architectural decisions, operational fidelity, and tradeoffs** — not syntax.
- The hard parts are reserved for them. The scaffolding swarm does boilerplate across Java, Node, and .NET.
- The Buddy never gives answers. It asks the smallest question that unlocks thought.

## What "done" means

- Each day has a `## Verification` block. Green = day done.
- Each project ends with an ADR or two in `curriculum/adr/`.
- Capstone = a working multi-service deployment, observable, with a chaos drill that doesn't lose data.

## What "stuck" looks like (and how to read it)

- 2+ rounds of Buddy questions with no movement → offer to *point at* a section, not explain it.
- Three `// LEARNER:` markers untouched after a session → likely a hidden upstream decision is missing; ask "what would have to be true for these to be obvious?"
- Verification fails on the same check twice → environment, not understanding. Ask about the environment.
