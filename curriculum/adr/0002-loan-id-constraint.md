# ADR 0002: Loan ID Constraint
## Status: Accepted
## Context
In our loan servicing domain, we have a `LoanId` class that serves as a value object wrapper around a `UUID`. The `UUID` is a universally unique identifier that can be generated in various versions (e.g., version 1, version 4). When designing the `LoanId` class, we need to decide whether to allow any version of `UUID` or to constrain the acceptable UUID version from the start.

## Options
1. **Allow any UUID version**: We could design the `LoanId` class to accept any version of `UUID`. This would provide flexibility in terms of the types of UUIDs that can be used, but it may lead to inconsistencies in the format of `LoanId` values across the system.
2. **Constrain to a specific UUID version**: We could restrict the `LoanId` class to only accept a specific version of `UUID` (e.g., version 4). This would ensure consistency in the format of `LoanId` values and may simplify certain operations that rely on the structure of the UUID, but it would limit flexibility in terms of the types of UUIDs that can be used.
3. **Introduce a custom identifier format**: Instead of using `UUID` directly, we could create a custom identifier format for `LoanId` that is not based on `UUID`. This would allow us to design the identifier format specifically for our domain needs, but it would require additional implementation effort and may introduce complexity in terms of generating and validating the identifiers.
4. **Use a different unique identifier**: We could choose to use a different type of unique identifier (e.g., a sequential ID, a composite key) instead of `UUID`. This would allow us to tailor the identifier to our specific requirements, but it may not provide the same level of uniqueness and may require additional logic to ensure uniqueness across the system.(We considered also composite keys, but due to collision risk and overhead it would bring to mitigate it, we decided to not include it as an option)
## Decision
We chose to allow UUID V7 for `LoanId`. This decision was made to ensure that all `LoanId` values have a consistent format while still providing the benefits of UUIDs, such as uniqueness and ease of generation. By constraining to a specific version of UUID, we can also take advantage ofDB efficiency (time-ordered, better index locality).
LoanId will be implemented as a value object that wraps a UUID V7, and we will enforce this constraint in the constructor of the `LoanId` class. Will have a static factory method LoanId.generate() otherwise Loan aggegate would call it internally and therefore the tests would need spy. This way it's more elegant and ensures encapsulation. This approach allows us to maintain consistency in our identifiers while still leveraging the advantages of UUIDs in our loan servicing domain.
## Consequences
- All `LoanId` values will have a consistent format, which can simplify certain operations and improve readability.
- We will need to ensure that any UUID generation logic in the system is updated to generate version 7 UUIDs for `LoanId` values.
- This decision may limit flexibility in terms of the types of UUIDs that can be used for `LoanId`, but it provides a clear standard
- If you ever need to swap the generation strategy (v7 → something else), only LoanId.generate() changes — Loan and all callers are unaffected.
## References
- [UUID Versions](https://www.ietf.org/rfc/rfc4122.txt)
- [UUID Version 7](https://www.ietf.org/rfc/rfc4122
