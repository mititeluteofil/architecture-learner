# Day 01 — P1 `loan-core-java8` — Kickoff

**Feature spotlight**: classic Java 8 — `Stream`, `Optional`, `java.time`, no records, no `var`.
**Hours**: ~2.5
**Project**: `projects/p1-loan-core-java8`

## Why this exists

You will feel the constraints of Java 8 in your hands today so that the refactor in P2 lands. Resist the urge to reach for Java 17 idioms. The goal is **legitimate Java 8** so the diff later means something.

## Main Quest

1. Run `/kickoff p1`. The scaffolding swarm will plan, generate the Maven module (with `<release>8</release>`), stub the core types, and lay down test skeletons.
2. Review the `PLAN.md` the architect produced. Mark any decisions you disagree with and write them up in `curriculum/adr/0001-…md` *before* you touch code.
3. Implement the first aggregate: **`Loan`**. Fields and invariants are listed as `// LEARNER:` markers in the stub. At minimum it must answer:
   - What identifies a loan? (value object, not a primitive)
   - What state can it be in? (today: pick an enum; in P2 you'll meet `sealed`)
   - What invariants hold at construction? At every transition?
4. Implement **`Money`** as a value object. BigDecimal-backed, rounding mode explicit.
5. Make the unit tests for `Loan` and `Money` pass (turn `fail("LEARNER: …")` into real assertions, then real production code to satisfy them).

## Stretch (only if you finish early)

- Add a `LoanId` value object backed by `UUID`. Test that two `LoanId`s with the same underlying UUID are equal.
- Write a property test (jqwik) that `Money.add` is commutative and associative within a single currency.

## Decisions you'll need to make

- **ADR-0001**: How does `Money` handle currency mismatches in arithmetic? Throw, return `Optional.empty()`, return a `Result` type, or refuse to compile?
- **ADR-0002**: Should `LoanId` accept any UUID, or only v7 (time-sortable)?

Write the ADRs as 5-minute documents. They don't have to be right; they have to be **explicit**.

## Verification

- [ ] `./mvnw -pl projects/p1-loan-core-java8 -am verify`
- [ ] `grep -rE 'var |record |sealed ' projects/p1-loan-core-java8/src/main/java | wc -l` returns `0` (Java 8 discipline)
- [ ] `curriculum/adr/0001-money-currency-mismatch.md` exists (even a stub)
- [ ] `git diff --stat HEAD~1 HEAD` shows at least 5 files changed

## Buddy prompts

When you get stuck, `/buddy <your question>`. Some prompts worth asking yourself first:
- "What would force me to use a primitive `double` here?" (If the answer is "nothing", don't.)
- "If a new hire read this code in 5 minutes, what would they get wrong about a loan?"
- "Where would I put the rounding mode if it had to be configurable per loan vs per system?"

## Tomorrow

Day 02 deepens P1: `AmortizationSchedule`, `Payment`, payment allocation. Day 03 finishes P1 with a property test suite and ADR review.
