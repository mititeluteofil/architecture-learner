# ADR 0004: Money Rounding Rules

## Status: Accepted

## Context
Where should the rounding rules live?
## Options
fixed inside Money, caller-supplied, centrally configured
## Decision
The decision is to keep the domain pure. The domain service passes in RoundingMode as a parameter to the method that needs it, and the domain logic uses it to round the money values accordingly. This way, the domain logic remains agnostic of any specific rounding rules and can be easily tested with different rounding modes.
## Consequences
A domain service will always need to pass in the RoundingMode when performing operations that require rounding. If a domain service forgets to pass a RoundingMode that throws a compile-time error
Different operations round differently, and rounding can favor the bank or the client -> therefore the caller which in this case it should be in the application layer, where the business logic lives, must call the domain service with a RoundingMode. And normally if the application layer would not call it with a roundingMode then a wrapper method.
## References
