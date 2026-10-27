# Node idioms

- **Layout:** one `package.json` per project dir. `src/domain`, `src/application` (ports), `src/adapters/{in,out}`, `src/main` (composition root). Tests in `test/`.
- **Ports:** baseline step uses documented duck-typed objects (JSDoc `@typedef`); modern step uses TypeScript `interface`s in `src/application/ports`.
- **DI:** manual constructor injection wired in the composition root. No decorators or containers unless the NestJS variant is chosen.
- **Baseline step (ES2017):** CommonJS, `class`, `Object.freeze`. No TypeScript, no `import`.
- **Modern step (TS 5 strict):** `strict: true`, discriminated unions, `readonly`, branded ids, exhaustive `switch` with a `never` check.
- **Money:** a decimal library holding integers or strings; never `number` arithmetic on amounts.
- **Stub idiom:** `throw new Error("LEARNER: implement - <hint>");`. Value objects get fields and a `// LEARNER: invariant - <hint>`.
- **Failing tests:** `assert.fail("LEARNER: <hint>")` inside `test("sentence describing behavior", ...)`.
- **Config:** read env vars in one `config` module with `// LEARNER: configure <key>`.
- **Images:** multi-stage Dockerfile; app listens on `PORT`, exposes `/health/live` and `/health/ready`.

## Do not

- Do not write function bodies, validation or mapping logic.
- Do not import framework types in `src/domain`.
- Do not add dependencies the PLAN has not decided on.
- Do not use `any` in the modern step, or floating-point math for money.
