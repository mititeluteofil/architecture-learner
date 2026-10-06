# ADR 0003: Loan Construction Invariants and Status Transitions

## Status: Accepted

## Context

The `Loan` aggregate root must protect two categories of invariants: what must be present at construction time for a loan to be valid, and which status transitions are permitted throughout the loan lifecycle. Without explicit rules here, callers could construct incomplete loans or drive a loan into an illegal state.

## Decision

**Mandatory construction fields:** A `Loan` requires `LoanId`, `borrowerId`, and `Money` (principal amount with currency) at construction. No other fields are mandatory — a loan cannot exist without an identity, a borrower, and an amount.

**Allowed transitions:**

| From | To |
|---|---|
| `DRAFT` | `ACTIVE` |
| `ACTIVE` | `DELINQUENT`, `PAID_IN_FULL` |
| `DELINQUENT` | `ACTIVE`, `PAID_IN_FULL` |
| `PAID_IN_FULL` | `CLOSED` |
| `CLOSED` | *(terminal — no further transitions)* |

A delinquent loan must pass through `PAID_IN_FULL` before closing — it cannot transition directly to `CLOSED`. A closed loan is terminal; a borrower taking on more debt requires a new `Loan` instance.

The `Loan` aggregate enforces these transitions by throwing an `IllegalStateException` on any attempt to move to a disallowed status.

## Consequences

- Construction is fail-fast: a `Loan` with missing mandatory fields cannot be instantiated.
- All lifecycle rules live inside the aggregate — no caller can bypass them.
- The `DELINQUENT → CLOSED` path is explicitly forbidden, which is a deliberate business rule that must be documented and communicated to consumers.
- `CLOSED` as a terminal state means the system accumulates historical loan records rather than mutating them — this simplifies audit trails.

## References

- [Domain-Driven Design, Eric Evans](https://www.amazon.com/Domain-Driven-Design-Tackling-Complexity-Software/dp/0321125215) — Aggregates and invariant enforcement
