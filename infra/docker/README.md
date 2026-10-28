# Docker / compose

Shared docker-compose fragments, database migrations and sidecars. The backing services are the same whichever language the application is written in (see [`../CONTRACT.md`](../CONTRACT.md)).

- **Backing services (shared):**
  - PostgreSQL 16 on 5432; migrations in `db/migrations/`.
  - Apache Kafka (9092) + Schema Registry (8081).
  - LGTM observability stack (P7): Loki, Grafana, Tempo, Mimir/Prometheus, and an OpenTelemetry Collector on 4317 (gRPC) / 4318 (HTTP).
- **Application images (per stack):** each stack pack declares its image strategy. For Java this is Jib, configured in the project's `pom.xml`. A plain Dockerfile here only exists if a sidecar needs one. Other stacks add a multi-stage Dockerfile inside their own project directory.

Grown by the `infra-scaffolder` agent starting at **P5** (Postgres, Kafka) and reaching full LGTM observability at **P7**.
