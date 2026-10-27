# Java idioms

- **Layout:** Maven multi-module under the project dir; parent POM at repo root governs versions via BOMs. Register new modules in the root `<modules>`.
- **Ports:** interfaces in the `application` (or `domain.port`) package. Driving ports are use-case interfaces, driven ports are repositories and publishers. No default methods.
- **DI:** constructor injection only. Wiring lives in a `@Configuration` class in the adapter or bootstrap module, never in the domain.
- **Baseline step (Java 8):** `<release>8</release>`. Plain classes, `final` fields, `Optional`. No `var`, `record`, `sealed`, text blocks.
- **Modern step (Java 21):** records for value objects, sealed interfaces for closed hierarchies, pattern-matching `switch`.
- **Money:** `BigDecimal` plus an explicit `RoundingMode`; never `double`.
- **Stub idiom:** method body is `throw new UnsupportedOperationException("LEARNER: implement - <hint>");`. Records get fields only, with `// LEARNER: invariant - <hint>` where validation belongs.
- **Failing tests:** `fail("LEARNER: <hint>");` with `@DisplayName` and snake_case names.
- **Config:** `application.yml` with empty keys and `# LEARNER: configure <key>`.
- **Images:** Jib configuration block in the module POM; no Dockerfile for apps.

## Do not

- Do not write method bodies, validation or mapping logic.
- Do not pre-import frameworks the PLAN has not decided on (e.g. JPA before the persistence slot).
- Do not put framework annotations in the domain module.
- Do not use `javax.*`; use `jakarta.*`.
