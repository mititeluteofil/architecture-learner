# Session Log

_Rolling FIFO, last 7 sessions. Newer entries on top._

## Session 01 — Day 01 — `p1-loan-core-java8` — 2026-05-30

**Attempted:** Ran the scaffolding setup and wrote two architecture decision records covering currency handling and identifier constraints. Did not reach code implementation.
**Decided:** Currency mismatches in arithmetic should throw immediately, keeping the domain pure and delegating conversion orchestration to the application layer. Identifiers should use a time-sortable variant via a static factory method for encapsulation.
**Stuck on:** Time — session budget was consumed by design documentation before implementation began.
**Buddy noticed:** Learner engages the "why" deeply before writing any code; the entire first session was planning and decision-writing.
