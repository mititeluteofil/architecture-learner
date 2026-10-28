# Python idioms

- **Layout:** `src/<package>/{domain,application,adapters}` plus `tests/`, one `pyproject.toml` per project dir. `__init__.py` files stay empty.
- **Ports:** modern step uses `typing.Protocol` in `application/ports.py`; baseline step uses abstract base classes (`abc`) without annotations.
- **DI:** explicit constructor arguments, wired in a `main.py` composition root. With FastAPI, `Depends` belongs only in the adapter layer.
- **Baseline step (3.8):** no annotations, no `match`. Docstrings carry the contract.
- **Modern step (3.12):** frozen `@dataclass` value objects, full annotations (`mypy --strict`), `match` on tagged unions, `type` aliases.
- **Money:** `decimal.Decimal` built from strings, explicit `ROUND_*` mode; never `float`.
- **Stub idiom:** `raise NotImplementedError("LEARNER: implement - <hint>")`. Dataclasses get fields only, with `# LEARNER: invariant - <hint>` in `__post_init__` if validation is needed.
- **Failing tests:** `pytest.fail("LEARNER: <hint>")`, function names as snake_case sentences.
- **Config:** a `settings.py` reading env vars with `# LEARNER: configure <key>`.
- **Images:** multi-stage Dockerfile; serve on `PORT`.

## Do not

- Do not write function bodies, validation or mapping logic.
- Do not import web-framework or ORM modules from `domain`.
- Do not add dependencies the PLAN has not decided on.
- Do not use `float` for money.
