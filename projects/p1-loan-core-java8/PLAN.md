# PLAN — P1 `loan-core-java8`

## Module layout

- **`projects/p1-loan-core-java8`** — single Maven module for the Java 8 domain core.
  - Packaging: `jar`
  - Compiler target: **Java 8** (`<release>8</release>` via module config or the root `java8` profile)
  - No Spring Boot yet; this project is intentionally framework-free so the learner feels the domain constraints directly.

## Package tree

```text
projects/p1-loan-core-java8/
  pom.xml
  src/
    main/
      java/
        dev/architecturelearner/loanservicing/core/
          model/
            Loan.java
            LoanId.java
            LoanStatus.java
            Money.java
    test/
      java/
        dev/architecturelearner/loanservicing/core/
          model/
            LoanTest.java
            MoneyTest.java
            LoanIdTest.java
            MoneyPropertiesTest.java
```

## Key type signatures

These are Java 8-friendly signatures only — no records, no sealed types, no method bodies.

```java
package dev.architecturelearner.loanservicing.core.model;

public final class Loan {
    private final LoanId id;
    private final Money principal;
    private final Money outstandingBalance;
    private final LoanStatus status;
    private final LocalDate startDate;

    public Loan(LoanId id,
                Money principal,
                Money outstandingBalance,
                LoanStatus status,
                LocalDate startDate);

    public LoanId getId();
    public Money getPrincipal();
    public Money getOutstandingBalance();
    public LoanStatus getStatus();
    public LocalDate getStartDate();

    public Loan activate(LocalDate activatedOn);
    public Loan applyPayment(Money paymentAmount, LocalDate receivedOn);
    public Loan markDelinquent(LocalDate delinquentOn);
    public Loan close(LocalDate closedOn);
}

public final class Money implements Comparable<Money> {
    private final BigDecimal amount;
    private final Currency currency;

    public Money(BigDecimal amount, Currency currency);

    public BigDecimal getAmount();
    public Currency getCurrency();

    public Money add(Money other);
    public Money subtract(Money other);
    public boolean isNegative();
    public boolean isZero();
    public int compareTo(Money other);

    @Override
    public boolean equals(Object other);

    @Override
    public int hashCode();

    @Override
    public String toString();
}

public final class LoanId {
    private final UUID value;

    public LoanId(UUID value);

    public static LoanId random();
    public UUID getValue();

    @Override
    public boolean equals(Object other);

    @Override
    public int hashCode();

    @Override
    public String toString();
}

public enum LoanStatus {
    DRAFT,
    ACTIVE,
    DELINQUENT,
    PAID_IN_FULL,
    CLOSED
}
```

### Responsibility notes

- **`Loan`** — first aggregate root; protects lifecycle transitions and balance-related invariants.
- **`Money`** — BigDecimal-backed value object with explicit rounding and currency rules.
- **`LoanId`** — value object wrapper around `UUID` so the domain avoids primitive identity.
- **`LoanStatus`** — intentionally an enum in P1 so P2 can revisit richer modeling with modern Java.

## ADR stubs

- **ADR-0001**: How should `Money` behave when arithmetic is attempted across different currencies — throw, return `Optional`, introduce a result type, or prevent the operation earlier?
- **ADR-0002**: Should `LoanId` accept any `UUID`, or should the domain constrain the acceptable UUID version from the start?
- **ADR-0003**: Which `Loan` fields are mandatory at construction time, and which transitions are allowed from each `LoanStatus`?
- **ADR-0004**: Where should rounding rules live for `Money` in P1 — fixed inside the value object, caller-supplied, or centrally configured later?

## Scaffolding manifest

### For `code-scaffolder`

- `projects/p1-loan-core-java8/pom.xml`
- Register `projects/p1-loan-core-java8` in the root `pom.xml` modules list
- `src/main/java/dev/architecturelearner/loanservicing/core/model/Loan.java`
- `src/main/java/dev/architecturelearner/loanservicing/core/model/Money.java`
- `src/main/java/dev/architecturelearner/loanservicing/core/model/LoanId.java`
- `src/main/java/dev/architecturelearner/loanservicing/core/model/LoanStatus.java`

### For `infra-scaffolder`

- No infra files required for P1
- Keep `infra/` unchanged

### For `test-scaffolder`

- `src/test/java/dev/architecturelearner/loanservicing/core/model/LoanTest.java`
- `src/test/java/dev/architecturelearner/loanservicing/core/model/MoneyTest.java`
- `src/test/java/dev/architecturelearner/loanservicing/core/model/LoanIdTest.java`
- `src/test/java/dev/architecturelearner/loanservicing/core/model/MoneyPropertiesTest.java` (stretch jqwik skeleton only)

## Notes for the learner

- P1 should feel intentionally plain: no framework annotations, no records, no `var`, no sealed hierarchies.
- The generated production stubs should include `// TODO LEARNER:` markers for invariants and transition rules, not filled-in business logic.
- The generated tests should fail with `fail("LEARNER: …")` until the learner turns the examples into real assertions and implementation.

