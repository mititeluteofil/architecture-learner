# Architecture Learner — 30 Days

A senior-level, self-paced series. **One domain (Loan Servicing), nine projects, thirty days, ~2.5 h/day.** Java 8 → 21, DDD + hexagonal, Spring Boot microservices, Docker, Kubernetes, Terraform, AWS. Gamified. Scaffolded by an agent swarm so your hours go to decisions, not boilerplate.

## How a day looks

1. `/kickoff p<N>` — agent swarm generates the project's Maven module, infra stubs, and test skeletons. Pause and confirm at each step.
2. You fill the `// LEARNER: …` markers. Make architectural decisions. Write ADRs in `curriculum/adr/`.
3. `/verify day-NN` — runs the day's checks (mvn, kubectl, docker, terraform plan).
4. `/debrief` — Socratic recap with the Learning Buddy; XP awarded; profile updated.

## Calendar

| Days | Project | What unlocks |
|---|---|---|
| 1–3 | P1 `loan-core-java8` | Java 8 baseline domain |
| 4–6 | P2 `loan-core-modern` | Java 21 features (records, sealed, pattern switch) |
| 7–10 | P3 `loan-domain-hex` | DDD + hexagonal, ArchUnit-enforced, jqwik property tests |
| 11–13 | P4 `loan-service-boot` | Spring Boot 3.3 driving adapter, OpenAPI |
| 14–16 | P5 `loan-persistence-events` | Postgres, Flyway, transactional outbox |
| 17–19 | P6 `payments-service` | Second service, Kafka, Spring Cloud Contract, saga |
| 20–22 | P7 `loan-platform-docker` | Jib images, LGTM observability stack |
| 23–25 | P8 `loan-platform-k8s` | kind, Helm, HPA, virtual-thread benchmark |
| 26–29 | P9 `loan-platform-cloud` | Terraform → LocalStack → real AWS (Day 29), GH Actions |
| 30 | Capstone | Chaos drill + ADR sign-off |

Side quests (optional, 1–3 h) live in `curriculum/side-quests/` — Quarkus comparisons at four inflection points, plus nice-to-have .NET/Node parallels.

## Slash commands

| Command | What it does |
|---|---|
| `/start` | Today's brief — goals, checklist, side quests, status, yesterday's loose ends. |
| `/kickoff p<N>` | Runs the scaffolding swarm for project N. |
| `/scaffold <architect\|code\|infra\|test> p<N>` | Runs one agent. |
| `/verify day-NN` | Runs the day's verification block. |
| `/buddy` | Ask the Learning Buddy (Socratic — no solutions). |
| `/debrief` | End-of-session retro; updates buddy memory; awards XP; produces visual dashboard data. |
| `/xp` | Show level, XP-to-next, achievements, suggested next side quest. |

## Conventions

- **Build**: Maven multi-module, parent POM.
- **Java**: 21 LTS everywhere except P1 (locked to 8).
- **Spring Boot**: 3.3.x.
- **Tests**: JUnit 5, AssertJ, Testcontainers, jqwik, PIT, ArchUnit, Spring Cloud Contract.
- **Containers**: Jib for apps, Dockerfile only for sidecars.
- **Local k8s**: `kind`. **Manifests**: Helm.
- **Cloud**: LocalStack daily; real AWS only on Day 29.

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
