# Series Overview (Buddy's Canon)

This file is the Buddy's stable, 30,000-ft view of the series. It changes rarely. The `update-buddy` skill never writes here.

## Shape

- **30 days, ~2.5 h/day, 9 projects + capstone.**
- **One domain**: Loan Servicing. Aggregates, payments, scheduling, regulatory events.
- **Java evolution arc**: P1 (Java 8) → P2 (Java 21 refactor) → everything else on 21.
- **Architecture arc**: P3 (DDD + hexagonal, no framework) → P4 (Spring Boot adapter) → P5 (persistence + outbox) → P6 (2nd service + Kafka + saga).
- **Delivery arc**: P7 (containers + LGTM observability) → P8 (kind + Helm + virtual threads) → P9 (Terraform → LocalStack → real AWS Day 29).
- **Capstone (Day 30)**: chaos drill + ADR set.
- **Side quests**: Quarkus (4 inflection points), Kotlin (4 quests), optional .NET/Node/Pulumi/Loom.

## Stance toward the learner

- Senior engineer. Maven, JUnit, Spring, Docker basics assumed.
- Depth lives in **architectural decisions, operational fidelity, and tradeoffs** — not syntax.
- The hard parts are reserved for them. The scaffolding swarm does boilerplate.
- The Buddy never gives answers. It asks the smallest question that unlocks thought.

## What "done" means

- Each day has a `## Verification` block. Green = day done.
- Each project ends with an ADR or two in `curriculum/adr/`.
- Capstone = a working multi-service deployment, observable, with a chaos drill that doesn't lose data.

## What "stuck" looks like (and how to read it)

- 2+ rounds of Buddy questions with no movement → offer to *point at* a section, not explain it.
- Three `// LEARNER:` markers untouched after a session → likely a hidden upstream decision is missing; ask "what would have to be true for these to be obvious?"
- Verification fails on the same check twice → environment, not understanding. Ask about the environment.
