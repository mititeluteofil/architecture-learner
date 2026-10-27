# Ruby idioms

- **Layout:** `lib/<project>/{domain,application,adapters}` with RSpec in `spec/`. For Rails API, the domain lives in `lib/` (a Packwerk package), not `app/models`.
- **Ports:** Ruby has no interfaces. Declare a port as a module whose methods raise `NotImplementedError`; add an RBS file in the modern step.
- **DI:** constructor injection with keyword arguments, wired in an initializer or `config/container.rb`. No global lookups, no ActiveRecord callbacks in the domain.
- **Baseline step (2.7):** plain classes, `attr_reader`, `freeze`. No `case/in`, no `Data.define`, no RBS.
- **Modern step (3.3):** `Data.define` value objects, `case/in` pattern matching, RBS under `sig/`.
- **Rails friction:** keep ActiveRecord in the persistence adapter; the learner decides how to separate it. Do not pre-decide.
- **Money:** `BigDecimal` from strings with an explicit rounding mode; never `Float`.
- **Stub idiom:** `raise NotImplementedError, "LEARNER: implement - <hint>"`. Value objects get members only, with `# LEARNER: invariant - <hint>`.
- **Failing tests:** `flunk "LEARNER: <hint>"` inside `it "describes one behavior"`.
- **Config:** `config/*.yml` with empty keys and `# LEARNER: configure <key>`.
- **Images:** multi-stage Dockerfile; bind to `PORT`.

## Do not

- Do not write method bodies, validation or mapping logic.
- Do not put business rules in controllers or ActiveRecord models.
- Do not add gems the PLAN has not decided on.
- Do not use `Float` for money.
