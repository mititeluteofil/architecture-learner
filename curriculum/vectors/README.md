# Vectors

Language-neutral test data. Every stack's tests load the same files, so `Money` means the same thing in Java, Python, Node, .NET and Ruby. Vectors are data, not business logic.

## Format

One JSON file per concept, `<name>.json`:

```json
{
  "name": "money-rounding",
  "description": "what the set covers",
  "version": 1,
  "cases": [
    { "id": "unique-id", "op": "round", "mode": "HALF_UP", "scale": 2, "input": "2.345", "expected": "2.35" }
  ]
}
```

Rules:
- Top level: `name` (matches file name), `version` (integer), `cases` (non-empty array); `description` optional.
- Each case: unique string `id`; `input` and `expected` are **decimal strings** (never JSON numbers, to avoid float drift); other fields are strings or integers.
- `money-rounding` cases also carry `op`, `mode` (HALF_UP, HALF_EVEN, DOWN, ...) and integer `scale`.
- Referenced from day files as `verify: vectors <slot> <name>`.

Validated by `node tools/masterplan-lint/lint.mjs`.
