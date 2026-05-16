# Docker / compose

Shared docker-compose fragments and Dockerfiles for sidecars. Application images use Jib (configured in each project's `pom.xml`); a plain Dockerfile here only exists if a sidecar needs one.

Grown by the `infra-scaffolder` agent starting at **P5** (Postgres, Kafka) and reaching full LGTM observability at **P7**.
