# Docker / Compose (Polyglot Shared Infrastructure)

Shared docker-compose configurations, database schemas, and sidecars serving **Java, Node.js, and .NET** applications identically.

- **Application Images**:
  - **Java**: Built with Jib via Maven (`mvn compile jib:dockerBuild`).
  - **Node.js**: Built via multi-stage Distroless `Dockerfile` (`docker build -f projects/p<N>-.../node/Dockerfile`).
  - **.NET**: Built via Chiseled Ubuntu `Dockerfile` or `dotnet publish /t:PublishContainer`.
- **Shared Backing Services**:
  - **PostgreSQL 16**: Port 5432, single migrations directory under `infra/docker/db/migrations/`.
  - **Apache Kafka + Schema Registry**: Port 9092 & 8081 for cross-service event streaming and saga orchestration.
  - **LGTM Observability Stack** (P7): Loki (logs), Grafana (dashboards), Tempo (distributed traces), Mimir/Prometheus (metrics), and OpenTelemetry Collector. All 3 runtimes send OTLP data on standard ports (4317 gRPC / 4318 HTTP).

Grown by the `infra-scaffolder` agent starting at **P5** (Postgres, Kafka) and reaching full LGTM observability at **P7**.
