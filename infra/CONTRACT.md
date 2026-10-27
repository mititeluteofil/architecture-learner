# Infrastructure Contract

Shared infrastructure is stack-neutral. Any service, in any language, plugs in by honouring this contract. A stack pack (`stacks/<id>/`) decides *how* its image is built. It never changes what the platform expects.

| Concern | Contract |
|---|---|
| HTTP port | `PORT` env var, default `8080` |
| Liveness / readiness | `GET /health/live`, `GET /health/ready` (200 when OK) |
| Database | `DATABASE_URL=postgres://loan_user:loan_pass@postgres:5432/loan_servicing` (PostgreSQL 16) |
| Migrations | One source of truth: `infra/docker/db/migrations/` (plain SQL, applied once, by whichever runner the stack prefers) |
| Messaging | `KAFKA_BOOTSTRAP_SERVERS=kafka:9092`, Schema Registry on `8081`; topics and schemas are defined once, not per stack |
| Telemetry | `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317` (gRPC) / `4318` (HTTP) |
| Image | Any OCI image that starts with no arguments and reads only the env vars above |
| Contracts between services | Pact (works across stacks); HTTP APIs described in OpenAPI |

The Loan Servicing values above are the reference masterplan's. Another masterplan renames the database and topics, but keeps the same variables.

## What is shared and what is per stack

- **Shared:** docker-compose backing services, migrations, the Helm chart, Terraform modules, LocalStack environment, the observability stack.
- **Per stack:** how the app image is built, and its `values-<stack>.yaml` overlay (resource limits, runtime tuning).

Nothing in `infra/` may assume a particular language.
