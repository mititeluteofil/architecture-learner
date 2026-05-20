# Curriculum Overview

Single domain — **Loan Servicing** — grown across 9 projects in 30 days. Senior pace, ~2.5 h/day.

## Projects

| # | Project | Days | Hrs | Focus |
|---|---|---|---|---|
| P1 | `loan-core-java8` | 1–3 | 7.5 | Baseline Java 8. Streams, Optional, java.time. No `var`, no records. |
| P2 | `loan-core-modern` | 4–6 | 7.5 | Refactor to Java 21. Records, sealed, pattern switch, text blocks. |
| P3 | `loan-domain-hex` | 7–10 | 10 | DDD aggregates + ports/adapters. ArchUnit. jqwik. |
| P4 | `loan-service-boot` | 11–13 | 7.5 | Spring Boot 3.3 driving adapter. OpenAPI. |
| P5 | `loan-persistence-events` | 14–16 | 7.5 | Postgres + Flyway + transactional outbox. |
| P6 | `payments-service` | 17–19 | 7.5 | Second service. Kafka. Saga. Spring Cloud Contract. |
| P7 | `loan-platform-docker` | 20–22 | 7.5 | Jib. docker compose. LGTM observability. |
| P8 | `loan-platform-k8s` | 23–25 | 7.5 | kind. Helm. HPA. Virtual threads. |
| P9 | `loan-platform-cloud` | 26–29 | 10 | Terraform → LocalStack daily; real AWS Day 29. GH Actions. |
| Capstone | — | 30 | 2.5 | Chaos drill + ADR set. |

## Side quests (optional, 1–3 h each)

See [`side-quests/index.md`](side-quests/index.md).

- **Quarkus**: SQ-01 (after P2), SQ-02 (after P5), SQ-03 (after P6), SQ-04 (after P7).
- **Kotlin**: SQK-01 (after P2), SQK-04 (after P3), SQK-02 (after P4), SQK-03 (after P6).
- **Nice-to-have**: .NET Hexagon, Fastify+Zod, Pulumi vs Terraform, Project Loom deep-dive.

## How a day flows

```
/start          → today's brief: goals, checklist, side quests, status
… learner works on // LEARNER markers …
/verify day-NN  → runs checklist, awards XP on pass
/debrief        → buddy asks 3 questions, session record committed, retro available
```

## Where to look

- Daily briefs: `curriculum/day-by-day/day-NN.md` (lazy-created per project).
- Architecture decisions: `curriculum/adr/NNNN-title.md` (learner-authored).
- Progress (machine): `progress/profile.json`, `progress/feed.json`, `progress/sessions/*.json`.
- Progress (human): `progress/journal.md`.
