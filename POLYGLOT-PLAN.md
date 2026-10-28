# Polyglot Plan — Masterplans × Stacks × Ladders

Branch: `polyglot`, cut from `cloudflare` (2126709). It inherits rules.json, `/sync`, cloud-sync and the P1 tests. PR #6 (`junie/issue-5-37984750697`) is used as **reference material only**: we cherry-pick its ideas and do not merge its branch.

Three things are added:

1. **Masterplan layer.** The domain becomes swappable. Loan Servicing stays the reference masterplan, in place, and the owner keeps using it.
2. **Stack layer.** The language and framework become swappable: Java, .NET, Node/TypeScript, Python and Ruby on the same masterplan.
3. **Expanded gamification.** Each stack gets its own level ladder, titles multiply ("Bilingual Senior"), achievements are scoped as common, per-stack or stack-specific, and you can restart a run with prestige or continue.

```
                 Stack pack  ─────────────►
                 java   dotnet   node   python   ruby
Masterplan  │
loan-serv.  │    ●      ○        ○      ○        ○      ● = in use today
orders      │    ○      ○        ○      ○        ○      ○ = possible once both layers exist
...         ▼
```

The **architecture spine** is fixed and shared by both layers. It runs: pure domain model, then the modern language step, hexagonal, driving adapter, persistence + outbox, second service + saga, containers + observability, k8s, cloud, and chaos. A masterplan says *what* gets built at each slot, and a stack pack says *with what*.

---

## 0. Starting point

**Inherited from `cloudflare`:** rules.json as the XP source of truth, the award-xp single-writer contract, streak/shield fold, `/sync` + the D1 ledger (`sessions`, `achievement_unlocks`, `profiles`), and the dashboard spec.

**Taken from PR #6 (ideas, re-applied by hand):**
- Infrastructure-as-contract: shared env vars, `/health/live` + `/health/ready`, OTLP, a single migration schema, and one parameterised Helm chart.
- `projects/p<N>-<name>/<stack>/` layout and the `--stack=` flag.
- The per-stack tool mapping.

**Not taken from PR #6:**
- **Its benchmark tables.** The numbers are invented but presented as measurements ("94,100 req/s", "18 ms cold start"). They are replaced by a measurement template the learner fills (§6).
- Language lists hard-coded into every agent and command. They are replaced by stack packs (§3).
- Its edits to `.junie/`. `.junie` is regenerated from `.claude` instead (§3.3).

---

## 1. Target layout

Per D2, Loan Servicing **stays where it is**. Its `masterplan.yaml` points at the existing paths, and only new masterplans live under `curriculum/masterplans/<id>/`.

```
curriculum/
  spine.yaml                        # fixed slots P1..P9 + capstone (domain- and stack-free)
  masterplan.yaml                   # Loan Servicing manifest → points at existing files below
  00-overview.md  day-by-day/  side-quests/  adr/     # unchanged locations
  vectors/                          # Loan Servicing shared test vectors (new)
  contracts/                        # Loan Servicing OpenAPI + event schemas (new)
  comparisons/                      # learner-written cross-stack comparisons (new)
  masterplans/
    _template/                      # skeleton for a new masterplan
    <other-id>/ masterplan.yaml domain.md day-by-day/ vectors/ contracts/ side-quests/
stacks/
  java/ dotnet/ node/ python/ ruby/     # stack.yaml, idioms.md, verify.yaml, achievements.json
projects/
  p1-loan-core-java8/               # untouched; declared as dir override in masterplan.yaml
  p<N>-<slug>/<stack>/              # new projects
progress/
  archive/<run-id>/                 # prestige archives (new)
```

`.github/learning-path.yml` gains these keys. They stay flat `key: value`, because the workflow parses the file without a YAML library.

```
masterplan: loan-servicing
stack: java                    # default stack for /kickoff and /verify
stacks: java                   # comma list of stacks in play, e.g. java,python,ruby
mode_python: hands-on          # hands-on | assisted   (per stack, §5)
stack_p6:                      # optional per-project override → mixed-stack systems
```

---

## 2. Layer 1 — Masterplan abstraction

### 2.1 Spine vs masterplan

`curriculum/spine.yaml` (domain-free, stack-free):

```yaml
slots:
  - { id: p1, concept: pure-domain-model, language_step: baseline, days: [1, 3] }
  - { id: p2, concept: modern-language,   language_step: modern,   days: [4, 6] }
  - { id: p3, concept: hexagonal,         days: [7, 10] }
  # p4 driving-adapter, p5 persistence-outbox, p6 second-service-saga,
  # p7 containers-observability, p8 kubernetes, p9 cloud, capstone chaos
```

`masterplan.yaml` maps each slot to domain content. For Loan Servicing it points at today's files:

```yaml
id: loan-servicing
title: Loan Servicing
paths: { days: curriculum/day-by-day, side_quests: curriculum/side-quests, vectors: curriculum/vectors }
projects:
  p1: { slug: loan-core, dir: projects/p1-loan-core-java8, brief: "Loan, Money, LoanId" }
  p6: { slug: payments-service, brief: "Payment allocation as a second bounded context" }
```

Lint rule: every spine slot must be mapped.

### 2.2 Two-part day files

Day files keep the domain content: the Main Quest, ADR prompts and buddy prompts. The language spotlight comes from the stack pack (keyed by `language_step`). Verification uses abstract verbs that the stack pack resolves:

```markdown
## Verification
- [ ] verify: build p1
- [ ] verify: discipline p1 baseline
- [ ] verify: vectors p1 money-rounding
- [ ] `test -f curriculum/adr/0001-*.md`      # backticked = raw shell, still supported
```

Existing day files keep working unchanged, because raw shell lines are still accepted. They get migrated to verbs gradually.

### 2.3 Authoring a new masterplan

- Commands: `/masterplan list | show | new <id> | switch <id>` (switching is covered in §4.6).
- `new` copies `_template/` and runs a new **`domain-designer`** agent. It drafts `domain.md` (glossary, bounded contexts, invariants **posed as questions**), the slot mapping, ADR seed questions and vectors. It never writes models or type signatures; that stays with the architect at kickoff.
- `tools/masterplan-lint` (Node, alongside cloud-sync) checks: slots mapped, a `## Verification` block on every day, known verbs only, and well-formed vectors.

---

## 3. Layer 2 — Polyglot stack packs

### 3.1 Pack contents

```
stacks/<id>/
  stack.yaml         # versions per language_step, frameworks, tooling, marker idioms, layout
  verify.yaml        # abstract verb → command, e.g. build: "uv run --directory {dir} pytest -q"
  idioms.md          # short guidance for scaffolders: ports, DI, stub idiom
  achievements.json  # stack-specific achievement definitions (§4.4)
```

### 3.2 The five packs

| Pack | Baseline → modern | Default framework (variants) | Property / arch / mutation / contract |
|---|---|---|---|
| `java` | Java 8 → 21 | Spring Boot 3.3 (Quarkus) | jqwik / ArchUnit / PIT / Pact (+ Spring Cloud Contract) |
| `dotnet` | C# 7.3 → C# 12 / .NET 8 | ASP.NET Core Minimal API | FsCheck or CsCheck / NetArchTest / Stryker.NET / PactNet |
| `node` | ES2017 JS → TS 5 strict | Fastify (NestJS) | fast-check / dependency-cruiser / StrykerJS / pact-js |
| `python` | 3.8 untyped → 3.12 typed + `match` | FastAPI (Django) | Hypothesis / import-linter / mutmut / pact-python |
| `ruby` | 2.7 → 3.3 (pattern matching, RBS) | **Rails API** (Hanami 2) | prop_check / Packwerk / mutant / pact-ruby |

Ruby defaults to Rails (D3). Rails fights hexagonal architecture, and that friction is a comparison lesson in itself.

Pact becomes the cross-stack contract standard. Spring Cloud Contract is JVM-only, so Pact is what makes a mixed-stack P6 possible (a Java provider verified against a Python consumer).

### 3.3 Agents become stack-agnostic

- `architect`, `code-scaffolder`, `infra-scaffolder` and `test-scaffolder` contain **no language names**. They read `spine.yaml`, the active `masterplan.yaml`, the day file, and `stacks/<stack>/*`.
- Semantic identity across stacks (`Money`, `LoanId`) is enforced by the shared vectors, not by prose.
- In CLAUDE.md, "Jib for app images" becomes a java-pack rule. Each pack declares its own image strategy.
- `.claude/` is the source of truth. `tools/sync-agents` regenerates `.junie/`, and CI fails on drift.

### 3.4 Shared infra, per-stack images

There is one Helm chart with `values-<stack>.yaml`. docker-compose backing services are shared and app services are templated per stack. `learning_loop.py` stops hard-coding Maven (`src/test/java`, `pom.xml`, `mvn -Dtest=`) and dispatches on the stack detected from the path.

---

## 4. Gamification v2

### 4.1 Principles

1. **More stacks means more XP.** Each stack has its own ladder, and a hands-on day in a second stack earns full XP (D4).
2. **The ledger stays the truth.** The rule is `xp_total = Σ sessions[].xp_earned` for the current run. Per-stack XP is `Σ` over sessions tagged with that stack. Everything else is derived and idempotent, as today.
3. **No retroactive recompute.** session-01 keeps its 175 XP and is treated as `stack: java, mode: hands-on, run: 1, masterplan: loan-servicing` when it is read. The file is not back-filled.
4. **award-xp stays the single writer.**

### 4.2 Ladders

- **Stack ladder (one per stack).** Uses today's bands L1 Apprentice → L6 Architect (0 / 601 / 1601 / 3201 / 5601 / 9001), applied to that stack's XP.
- **Global ladder.** Applied to total XP across stacks. It is the same six bands plus three new ones above Architect, so the extra polyglot XP has somewhere to go:

| id | Name | min XP |
|---|---|---|
| L7 | Principal | 15 001 |
| L8 | Distinguished | 25 001 |
| L9 | Fellow | 40 001 |

  One full hands-on run is ≈ 9–10k XP, so L9 roughly means "the whole spine in 4+ stacks". The bands live in rules.json and can be tuned.
- Common achievement XP (§4.4) counts toward the global ladder only, not any stack ladder.

### 4.3 Multiplied titles

The headline title combines the **highest level that at least two stacks have both reached** with the number of stacks at that level:

| Stacks at ≥ that level | Prefix |
|---|---|
| 1 | *(none)*, e.g. "Senior · Java" |
| 2 | **Bilingual** |
| 3 | **Trilingual** (yes, a real English word) |
| 4 | **Quadrilingual** |
| 5 | **Polyglot** |

For example, Java at L4, Python at L2 and Ruby at L2 gives the headline "**Trilingual Journeyman**", plus "Senior · Java" as the best single-stack title. The profile stores every combination reached, so the dashboard can show the set (e.g. Bilingual Engineer and Trilingual Journeyman). If several combinations qualify, the higher level wins the headline, then the higher multiplier.

Only levels earned with hands-on work count toward a prefix. Assisted stacks are capped at L3 (§5), which naturally limits "Trilingual Senior" to people who wrote the code three times.

Prestige: after a fresh-start run (§4.6), titles gain stars, e.g. "★★ Bilingual Staff".

rules.json, `schema_version: 2`:

```json
"levels":          [ …unchanged L1–L6… ],
"global_levels":   [ …L1–L6…, {"id":"L7","name":"Principal","min":15001,"max":25000},
                     {"id":"L8","name":"Distinguished","min":25001,"max":40000},
                     {"id":"L9","name":"Fellow","min":40001,"max":null} ],
"title_prefixes":  { "2": "Bilingual", "3": "Trilingual", "4": "Quadrilingual", "5": "Polyglot" },
"assisted":        { "xp_multiplier": 0.5, "level_cap": "L3", "counts_for_titles": false },
"prestige":        { "symbol": "★" }
```

### 4.4 Achievement scopes

Each definition gains a `scope`. The unlock key depends on the scope:

| scope | Unlock key | Earnable | Lives in |
|---|---|---|---|
| `common` | `id` | once per run, in any stack | `progress/achievements.json` |
| `per-stack` | `id@stack` | once in **each** stack | `progress/achievements.json` (criteria written with abstract verbs) |
| `stack` | `id@stack` | once, only in that stack | `stacks/<id>/achievements.json` |
| `polyglot` | `id` | once per run, needs 2+ stacks | `progress/achievements.json` |

`achievements_total` is derived as common + polyglot + per-stack × stacks in play + stack-specific for stacks in play. It is never hard-coded, matching today's rule.

Entries in `unlocked[]` gain `stack` (null for common/polyglot) and `run`. Nothing is unlocked yet (`"unlocked": []`), so the migration is free.

**Re-scoping the existing 18:**

- **common:** decision-anchor, kubectl-karma, terraform-tamer, localstack-whisperer, chaos-survivor. They are language-agnostic.
- **per-stack** (criteria rewritten as verbs):
  - pure-core: `verify: day p1-end`
  - property-pioneer: `verify: property`
  - hex-vex: `verify: arch p3`
  - bounded
  - outbox-hero
  - idempotent-mind
  - contract-killer: generalised to any green provider/consumer contract
  - container-diet: size threshold per pack in `stack.yaml`
- **stack: java:** hello-21, sealed-fate, pattern-master, loom-lord, the-quarkus-question.

**New stack-specific achievements:**

| Stack | id → name | Criterion (sketch) |
|---|---|---|
| dotnet | `sharp-records` → Sharp Records | P2 uses records + `required` members, day-06 green |
| dotnet | `null-and-void` → Null and Void | Nullable enabled + warnings-as-errors, zero warnings in P3 |
| dotnet | `ahead-of-time` → Ahead of Time | P4 Native AOT publish starts and answers `/health/ready` |
| dotnet | `state-of-the-saga` → State of the Saga | P6 saga state machine with a compensation test green |
| node | `strictly-typed` → Strictly Typed | `tsc --strict --noUncheckedIndexedAccess` clean on P2+ |
| node | `union-jack` → Union Jack | Discriminated union with an exhaustive `never` check (≥3 arms) |
| node | `no-floating-money` → No Floating Money | P1 money vectors green, with no `number` arithmetic on amounts |
| node | `loop-whisperer` → Loop Whisperer | Worker-thread offload of a CPU-bound use case, benchmark committed |
| python | `strict-typist` → Strict Typist | `mypy --strict` (or pyright strict) clean on P2+ |
| python | `match-maker` → Match Maker | `match` with ≥3 class patterns in domain code |
| python | `protocol-purist` → Protocol Purist | All P3 driven ports are `typing.Protocol`, import-linter green |
| python | `async-all-the-way` → Async All the Way | P4/P5 async endpoint → async repository, Testcontainers test green |
| ruby | `off-the-rails` → Off the Rails | P3 domain has zero ActiveRecord references, Packwerk green |
| ruby | `signed-sealed` → Signed & Sealed | RBS/Steep (or Sorbet) typecheck passes on domain |
| ruby | `in-case-of-pattern` → In Case of Pattern | `case/in` with deconstruct ≥3 arms in domain |
| ruby | `mutant-slayer` → Mutant Slayer | mutant kill rate ≥80% on a domain module |

**New common achievements (any stack, any masterplan):**

| id → name | Criterion |
|---|---|
| `adr-ten` → Paper Trail | 10 learner ADRs with a `## Consequences` heading |
| `streak-14` → Fortnight | `streak_days` ≥ 14 (shields allowed) |
| `debrief-30` → Reflective | 30 debriefs recorded |
| `cartographer` → Cartographer | Authored a masterplan that passes lint |
| `domain-hopper` → Domain Hopper | P1 completed in 2 different masterplans |
| `new-game-plus` → New Game+ | Started a fresh-start run (§4.6) |

**New polyglot achievements (2+ stacks):**

| id → name | Criterion |
|---|---|
| `first-words` → First Words | First hands-on day in a second stack |
| `rosetta-stone` → Rosetta Stone | Same slot completed hands-on in 3 stacks |
| `consensus` → Consensus | One vector file green in 3 stacks |
| `contract-diplomat` → Contract Diplomat | Mixed-stack Pact (provider ≠ consumer stack) green |
| `full-house` → Full House | P1 completed in all 5 stacks (hands-on or assisted) |
| `comparative-critic` → Comparative Critic | 5 `curriculum/comparisons/*.md` with reflections filled |
| `honest-numbers` → Honest Numbers | Capstone benchmark measured in 2+ stacks, hardware noted |
| `polyglot-architect` → Polyglot Architect | Every slot completed hands-on in 2 stacks |

### 4.5 New XP events (rules.json `xp_events`)

| event | XP | Emitted by | Notes |
|---|---|---|---|
| `stack_ignition` | 50 | `/start` | First session ever in a stack. Once per stack per run. |
| `comparison_note` | 40 | `/debrief` | A `curriculum/comparisons/*.md` reflection section written by the learner. |
| `diff_walkthrough` | 30 | `/debrief` | Assisted mode: completed a buddy compare session (§5). |
| `port_review` | 20 | `/debrief` | Assisted mode: learner names an idiom difference with file refs. Max 3/day (`port_review_max`). |

Existing events still apply in every stack. In assisted sessions, `daily_acceptance` is multiplied by `assisted.xp_multiplier`. The skill's drift check (skill table vs rules.json) is updated to cover the new events.

### 4.6 Switching masterplan: the learner chooses (D1)

`/masterplan switch <id>` asks the learner to pick one of two paths. The fresh-start path is offered prominently after the capstone, and is available at any point with explicit confirmation.

**A. Fresh start (prestige)**
- Moves `progress/{sessions,achievements.json,profile.json,feed.json,journal.md}` and buddy memory into `progress/archive/<run-id>/`. The `<run-id>` is e.g. `run-1-loan-servicing`.
- Resets XP, levels, titles and unlocked achievements, then starts `run: N+1` and increments `prestige`.
- `lifetime_xp` (all runs) is kept for the leaderboard. The archive is read-only and shown in the dashboard as a "Hall of runs".
- Unlocks `new-game-plus`.

**B. Continue**
- The same run and profile: XP, levels, titles and unlocks carry over. Sessions are now tagged with the new masterplan.
- Per-stack achievements are **not** re-earnable in the new domain (no double-dipping). New XP comes from daily events, `domain-hopper`, and stacks not yet played.
- At kickoff, each project can be run **hands-on** or **assisted** (§5). This is the "I've already done DDD in Java, just show me the differences" path.

Either way, buddy memory is scoped per run, so the buddy does not recall the old domain's details as current.

### 4.7 Schema changes

- **Session record:** + `masterplan`, `stack`, `mode` (`hands-on|assisted`), `run`. The defaults above apply when a field is absent.
- **profile.json:**
  - adds `run`, `prestige`, `lifetime_xp`, `global_level`, `stacks: {<id>: {xp, level, mode}}` and `titles: {headline, best_single, combos[]}`
  - `level` stays as an alias of the active stack's level, so the current dashboard keeps working
- **achievements.json:** `definitions[].scope`, and `unlocked[].stack` + `unlocked[].run`. Stack-specific definitions are merged in from the packs.
- **cloud-sync `schema.sql`:**
  - `sessions` + `masterplan, stack, mode, run`
  - `achievement_unlocks` PK becomes `(learner_id, achievement_id, stack, run)`
  - `profiles` + `headline_title, global_level_id, lifetime_xp, prestige`
  - the leaderboard can rank by current-run XP, lifetime XP, or filter by stack
  - the payload builder and `/sync pull` hydrate carry the new fields. Hydrate still awards nothing.
- **DASHBOARD-SPEC.md:** stack ladders strip, title badges, Hall of runs, and per-stack achievement grid.

---

## 5. Assisted mode: skip implementation, learn by comparison

The learner asked for a way to say "I've coded DDD in Java, don't make me write it again in Ruby, show me what's different". This is a **deliberate, recorded exception to the cardinal rule**.

- **Opt-in:** `mode_<stack>: assisted` in learning-path.yml, or `/kickoff p<N> --stack=ruby --assisted`. Setting it counts as the explicit "write it" consent that CLAUDE.md already requires, given once per stack and stored.
- **New `implementer` agent:** the only agent allowed to fill `LEARNER:` markers, and only in assisted mode. It has two sources, in order of preference:
  1. **Port.** If the same slot is done hands-on in another stack, translate the learner's own implementation. The learner's design decisions and ADRs carry over, and nothing new is designed for them.
  2. **Generate.** If there is no source (e.g. a new masterplan in continue mode), it implements from the PLAN.md and ADRs. The result is flagged as such.

  Either way, the test-scaffolder's tests and the shared vectors must go green. It writes `ASSISTED.md` in the project, listing the generated files and the source.
- **Buddy compare mode:** `/buddy compare p3 java ruby` reads both implementations and walks the differences. Examples: where invariants live, how DI and ports look, what the framework forces on you, and what the type system catches. The buddy may **show** code here (it is reading existing code), but it still **asks**, e.g. "Rails put validation on the model. Where did you put it in Java, and what did that buy you?". Learner answers earn `diff_walkthrough` and `port_review`.
- **Gamification:**
  - assisted `daily_acceptance` earns ×0.5 XP
  - the stack ladder is capped at L3 Engineer
  - assisted levels don't count toward title prefixes
  - hands-on-only achievements check `mode`
- **Take it back:** `/kickoff p<N> --stack=ruby --reset-impl` re-stubs the files listed in ASSISTED.md and switches the project to hands-on. That lifts the cap for future XP; past XP is not recomputed.

---

## 6. Comparison: the point of polyglot

- **Shared vectors.** Each stack's test-scaffolder emits a test over the same JSON vectors (P1 money rounding first).
- **`/compare p<N> [stacks]`** collects *measured* facts only: LOC (domain vs adapters), test count, build time, image size, cold start, and a k6 profile from P7. It writes `curriculum/comparisons/p<N>.md`. The facts table is generated; the reflection sections are left empty for the learner (which feeds `comparison_note` and `comparative-critic`).
- **Capstone benchmark template:** same k6 profile, same Helm limits, hardware noted. This replaces PR #6's invented tables (and feeds `honest-numbers`).

---

## 7. Delivery waves

Each wave is mergeable on its own and keeps the Java + Loan Servicing path green.

| Wave | Scope | Done when |
|---|---|---|
| **0 — Hygiene** | Cherry-pick PR #6's useful docs (infra contract, `--stack` wording) without benchmarks. Add `polyglot` to the CLAUDE.md push rule. | `/verify day-01` still passes; `grep -rn "req/s" curriculum` hits only the template. |
| **1 — Masterplan layer** | `spine.yaml`, Loan Servicing `masterplan.yaml` pointing at existing paths, `_template/`, masterplan-lint, `/masterplan list/show`. | Lint passes; `/start` renders day 01 exactly as today. |
| **2 — Stack packs** | `stacks/*` ×5, stack-agnostic agents, `.junie` sync. | `/kickoff p1 --stack=<each>` on a scratch branch builds, and markers fail as expected. |
| **3 — Gamification v2** | rules.json v2, achievement scopes + re-scoped 18 + new definitions, award-xp (stack ladders, titles, scopes, new events, defaults for old sessions), DASHBOARD-SPEC, cloud-sync schema + payload + hydrate. | Re-running award-xp on session-01 yields the same 175 XP; a synthetic Java + Python fixture yields "Bilingual Apprentice"; sync tests green. |
| **4 — Verify + CI** | `verify:` verbs, verify-day resolver, learning_loop.py stack dispatch, CI setup per stack present in the diff. | day-01 migrated to verbs; CI green on a PR touching Java + Python. |
| **5 — Assisted + compare** | `implementer` agent, `--assisted` / `--reset-impl`, ASSISTED.md, buddy compare mode, `/compare`, vectors, comparisons dir. | Assisted P1 in Ruby, ported from Java P1, is green; `/buddy compare p1 java ruby` runs; XP is capped and multiplied correctly. |
| **6 — Switching + authoring** | `/masterplan switch` (fresh start / continue), archive + prestige, `domain-designer`, `/masterplan new`, README guide. | Fresh start on a scratch copy archives and resets cleanly, and lifetime XP survives; a throwaway masterplan passes lint. |

Waves 1, 2 and 3 touch mostly separate files and can run in parallel worktrees, like the cloudflare t1–t6 waves. Wave 3 only needs Wave 2's stack ids. Waves 4–6 depend on 1–3.

---

## 8. Decisions

| # | Decision |
|---|---|
| D1 | **Learner chooses** on switch: fresh start (archive, reset, prestige ★, lifetime XP kept) or continue (same run, assisted mode available per project). |
| D2 | **Leave Loan Servicing in place.** Its `masterplan.yaml` points at existing paths. |
| D3 | **Rails** default for Ruby; Hanami 2 as a variant. |
| D4 | *(owner unsure, recommendation applied)* Full XP for hands-on work in every stack, because each stack has its own ladder. Assisted earns ×0.5 and is capped at L3. Easy to tune in rules.json. |
| D5 | **Yes.** `polyglot` added to the CLAUDE.md push rule. |

**Still open**
- O1: Global ladder thresholds (15k / 25k / 40k). Tune after real data from a second stack.
- O2: Should the leaderboard default to current-run XP or lifetime XP? Recommended: current run, with a lifetime tab.
- O3: Should a fresh start also reset the streak? Recommended: no. The streak tracks the habit, not the run.
