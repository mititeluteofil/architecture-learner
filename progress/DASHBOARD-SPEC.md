# Gamification & Dashboard — Data Contract

This spec is the data contract for the progress dashboard. Today that dashboard is the claude.ai Design artifact republished by `/debrief` (four artboards: Main, Session, Achievements, Journal); any other front-end must consume the same files.

**The CLI is the only writer.** The dashboard is read-only. Anything a view wants to "do" (complete a step, write a retro) is rendered as a copyable CLI command, not a button that writes.

## File map

```
progress/
├── profile.json            # current learner state (single source of truth)
├── achievements.json       # achievement definitions + unlock log
├── sessions/
│   ├── session-01.json     # one file per session (one per day)
│   └── …
├── feed.json               # pre-computed aggregates for fast UI reads
└── journal.md              # human-readable, free-form, not for UI parsing, never synced
```

The `award-xp` skill is the **sole writer** to `profile.json`, `achievements.json`, every `sessions/session-NN.json`, and `feed.json`. Re-running it is idempotent — same inputs produce the same final state. XP rules, levels, and the streak/shield fold live in `.claude/skills/award-xp/SKILL.md`; this file only describes shapes.

## `profile.json`

```ts
type Profile = {
  current_day: number;              // 1..30
  current_project: string;          // e.g., "p3-loan-domain-hex"
  xp_total: number;                 // = Σ sessions[].xp_earned
  level: {
    id: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
    name: "Apprentice" | "Journeyman" | "Engineer" | "Senior" | "Staff" | "Architect";
    xp_in_level: number;            // XP earned since hitting this level
    xp_to_next: number;             // XP required to reach the next level (0 at L6)
  };
  streak_days: number;              // derived by the streak/shield fold
  streak_shields?: number;          // 0..3, derived by the same fold; absent = 0
  started_at: string | null;        // ISO date of session-01
  last_session_at: string | null;   // ISO date
  achievements_unlocked: number;    // = unlocked entries of the current run
  achievements_total: number;       // DERIVED, never hard-coded: common + polyglot + per-stack x stacks in play + stack-specific for stacks in play

  // --- v2 (schema_version 2). All additive; a v1 reader ignores them. ---
  schema_version?: 2;
  run?: number;                     // 1-based; absent = 1
  prestige?: number;                // = run - 1; drives the star count on titles
  lifetime_xp?: number;             // Σ xp over all runs incl. progress/archive/*; = xp_total when no archive
  global_level?: {                  // ladder over xp_total (rules.json global_levels, L1..L9)
    id: "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7" | "L8" | "L9";
    name: string;                   // ... "Architect" | "Principal" | "Distinguished" | "Fellow"
    xp_in_level: number;
    xp_to_next: number;             // 0 at L9
  };
  stacks?: {                        // one entry per stack in play in the current run
    [stackId: string]: {            // "java" | "dotnet" | "node" | "python" | "ruby"
      xp: number;                   // stack XP (common/polyglot achievement XP excluded)
      level: { id: string; name: string; xp_in_level: number; xp_to_next: number; capped?: boolean };
      mode: "hands-on" | "assisted";   // mode of the stack's latest session
    };
  };
  titles?: {
    headline: string;               // e.g. "Trilingual Journeyman", "★ Bilingual Staff", or "Apprentice · Java"
    best_single: string;            // e.g. "Senior · Java"
    combos: { level: string; count: number; title: string }[];   // every (stack-count, level) combination reached, best first
  };
};
```

`level` stays an **alias of the active stack's level** (the stack of the latest session) on the stack ladder, so a v1 dashboard keeps working. A profile without the v2 fields is read as a single Java stack in run 1, `global_level` = `level`, `titles.headline` = `"<level name> · Java"`. The dashboard never computes levels itself except as that fallback; `tools/gamification-ref/compute.mjs` documents the algorithm.

View preference (Focus vs Analytics mode) is **not** in `profile.json` — the dashboard cannot write there. It lives in the browser (`localStorage`, wrapped in try/catch, default Focus).

## `achievements.json`

```ts
type AchievementTier = "domain-core" | "hexagonal" | "event-driven" | "cloud-infra";
type AchievementScope = "common" | "per-stack" | "stack" | "polyglot";
type AchievementDefinition = {
  id: string;                       // kebab-case stable identifier
  name: string;                     // display name
  tier: AchievementTier;            // drives grouping and the Blueprint view
  xp: number;                       // XP added to the unlocking session's xp_earned
  description: string;
  criteria: string;                 // must be checkable with Bash/Grep/Read; ambiguous = never unlocks
  scope?: AchievementScope;         // v2; absent = "common"
  stack?: string;                   // only for scope "stack": the stack id
};
type AchievementUnlock = {
  id: string;
  stack?: string | null;            // v2; null/absent for common + polyglot
  run?: number;                     // v2; absent = 1
  unlocked_at: string;              // ISO datetime
  session_id: string;               // e.g., "session-06"
  evidence: string;                 // file path or command output snippet
};
type Achievements = {
  schema_version?: 2;
  definitions: AchievementDefinition[];   // common + per-stack + polyglot only
  unlocked: AchievementUnlock[];
};
```

**Scopes and unlock keys.**

| scope | key | where defined | earnable |
|---|---|---|---|
| `common` | `id` | `progress/achievements.json` | once per run |
| `per-stack` | `id@stack` | `progress/achievements.json` | once in each stack |
| `stack` | `id@stack` | `stacks/<id>/achievements.json` (same definition shape, plus `scope: "stack"` and `stack`) | once, in that stack |
| `polyglot` | `id` | `progress/achievements.json` | once per run, needs 2+ stacks |

The dashboard builds its catalogue by merging `progress/achievements.json` with the `stacks/<id>/achievements.json` of every stack in `profile.stacks` (java when `stacks` is absent). A definition is unlocked when `unlocked[]` has an entry with the same key in the current `run`. `achievements_total` is the size of that merged, scope-expanded catalogue (per-stack definitions counted once per stack in play); it is not a stored constant.

## `sessions/session-NN.json`

Matches the files `award-xp` already writes (see `session-01.json`).

```ts
type GoalStatus = "done" | "in_progress" | "not_started";
type XpEvent =
  | "session_ignition" | "micro_step" | "daily_acceptance" | "side_quest"
  | "adr" | "adr_landing" | "property_bug" | "mutation_score"
  | "debrief" | "public_artifact"
  | "stack_ignition" | "comparison_note" | "diff_walkthrough" | "port_review";   // v2
type Session = {
  session: number;                  // 1-based within a run; file name is session-NN (zero-padded)
  day: number;                      // 1..30
  project: string;
  // v2 (schema_version 2). Absent on older files and then read as:
  masterplan?: string;              // default "loan-servicing"
  stack?: string;                   // default "java"
  mode?: "hands-on" | "assisted";   // default "hands-on"
  run?: number;                     // default 1
  // Old files are never back-filled; the defaults are applied when reading.
  date: string;                     // ISO date (UTC) — the streak fold reads this
  duration_minutes: number;
  planned_minutes: number;          // typically 150
  xp_earned: number;                // fixed at write time, never recomputed
  events: XpEvent[];                // one entry per award, duplicates allowed ("adr","adr")
  xp_breakdown?: { event: XpEvent; xp: number }[];   // from session-02 on; makes rule changes auditable
  main_quest: {
    goals: { id: string; description: string; status: GoalStatus }[];  // = the day's ## Main Quest items
  };
  decisions: string[];              // "ADR-0001: …" summaries
  blockers: string[];               // open at end of session
  side_quests: { id: string; status: "done" | "in_progress" | "skipped" }[];
  verification: {
    checks?: { label: string; passed: boolean }[];
    all_passed: boolean;
  };
  reflection: string;               // learner's freeform retro text — private, never synced
  buddy_questions_asked: string[];  // private, never synced
  achievements_unlocked: { id: string; evidence: string;
                           stack?: string | null; scope?: AchievementScope; xp?: number }[];   // v2 adds stack/scope/xp
};
```

`xp_earned` stays the sum of everything awarded in the session. For the stack ladder, `xp` of entries with `scope` `common` or `polyglot` is subtracted (that XP is global-only).

## `feed.json` — pre-computed aggregates

Regenerated on every write. One HTTP GET per dashboard load.

```ts
type Feed = {
  generated_at: string;             // ISO date/datetime
  xp_timeseries:      { date: string; session: number; xp_earned: number; xp_total: number }[];
  minutes_timeseries: { date: string; session: number; duration_minutes: number; planned_minutes: number }[];
  goal_completion_rate_by_session: { session: number; day: number; goals_done: number; goals_total: number; rate: number }[];
  achievements_timeline: { id: string; session_id: string; unlocked_at: string }[];
  open_blockers:      { session: number; text: string; resolved: boolean }[];
  recent_decisions:   { session: number; summary: string }[];
  streak_days: number;
  streak_shields: number;
  level_progression:  { date: string; level_id: string; level_name: string; xp_total: number }[];
};
```

v2 (additive, optional): `stack_xp_timeseries: { date; session; stack; xp_total_stack }[]` for the per-stack ladders strip, and `hall_of_runs: HallRun[]` (see below). A feed without them is still valid.

## v2 views (polyglot gamification)

All read-only, from `profile.json`, `achievements.json`, the merged stack definitions and `feed.json`. Each degrades to today's single-ladder look when the v2 fields are absent.

- **Stack ladders strip.** One row per entry in `profile.stacks`: stack label, level name, an `xp_in_level / (xp_in_level + xp_to_next)` bar, and an `assisted` chip (cap shown as a notch at L3 with `level.capped`) when `mode` is `assisted`. Above the strip, the global ladder (`global_level`, L1 to L9) as a wider bar with `xp_total`, and `lifetime_xp` as secondary text when it differs from `xp_total`.
- **Title badges.** `titles.headline` as the primary badge next to the avatar/name, `titles.best_single` as a secondary badge, `titles.combos[]` as a collapsed list ("Bilingual Journeyman, Trilingual Journeyman"). Stars come with the strings (prestige is already in them); show `prestige` as a star count tooltip. Assisted stacks are drawn without the "counts toward titles" tick.
- **Hall of runs.** One card per archived run from `progress/archive/<run-id>/` (`run`, `masterplan`, `xp_total`, final `titles.headline`, `global_level`, `achievements_unlocked`, date range), newest first, plus the live run as the top card. The archive is read-only. Until an archive exists the section is hidden.

```ts
type HallRun = {
  run_id: string;                   // e.g. "run-1-loan-servicing"
  run: number;
  masterplan: string;
  xp_total: number;
  headline: string;
  global_level_id: string;
  achievements_unlocked: number;
  started_at: string | null;
  ended_at: string | null;
};
```

- **Per-stack achievement grid.** In the Achievements artboard: rows are definitions, columns are the stacks in play (+ a "common" column). A `per-stack` or `stack` cell is lit when `id@stack` is unlocked in the current run; a `stack`-scope definition shows only in its own column (other cells blank, not locked). `common` and `polyglot` definitions span the row. Group by tier as before.

## Cloud Sync fields (v2)

`sessions` rows carry `masterplan, stack, mode, run`; `achievement_unlocks` is keyed `(learner, achievement_id, stack, run)` with `stack = ''` for common/polyglot; `profiles` adds `headline_title, global_level_id, lifetime_xp, prestige`; `/api/state` and `/api/leaderboard` expose them. Old records default as above (`java / hands-on / 1 / loan-servicing`).

## Dashboard views (two modes, one data contract)

A top-level toggle switches modes; both read the same files.

### Mode A — Focus (default)

Built for low-friction task initiation and fewer things on screen. No streak shame anywhere.

**Cockpit** — from `profile.json` + `curriculum/day-by-day/day-NN.md` + today's session (if any).
- **One step at a time.** The day's `## Main Quest` items are the micro-steps. Show the first item whose goal is not `done` in today's session (or item 1 if there is no session yet). Never show more than one step's full text.
- **Up next.** One-line preview of the following item, expanded only on click.
- **Copyable commands, not write buttons.** Each step shows the commands that move it forward: `/start`, `/buddy`, the module's `./mvnw -pl … test`, and `/debrief` at the end. Completing steps is recorded by `/debrief` (one `micro_step` per done goal).
- **Timebox nudge.** Purely client-side: a timer from page open with a soft nudge at 20 min on steps that are about writing ADRs/plans. No file-activity tracking — the dashboard cannot see it.
- **Buddy drawer.** Collapsible panel showing today's `## Buddy prompts` and the `/buddy` command.

**Hangar** — from `feed.json` + `achievements.json` + latest session.
- **Blueprint.** An SVG of the target architecture with one region per achievement `tier` (domain-core → hexagonal → event-driven → cloud-infra). A region lights up as its tier's achievements unlock. Nothing in the picture is derived from anything except `tier` + `unlocked[]`.
- **Momentum.** `Day N/30`, shields as 0–3 pips. After a gap, a neutral "Welcome back — today is Day N" with no mention of the broken streak.
- **Retro.** Shows the command `/debrief` and the last reflection's first line. It does not write to `journal.md`.

### Mode B — Analytics

Built for data-driven review and full retrospectives.

#### Start-of-session ("Today")

Renders from `profile.json` + the current `curriculum/day-by-day/day-NN.md` (parse the `## Main Quest`, `## Verification`, and `## Decisions you'll need to make` sections) + the latest session's unfinished goals.

- **Today card**: day NN/30, project name, feature spotlight, ~hours.
- **Loose ends**: yesterday's `in_progress` goals, open blockers, `// LEARNER:` marker count.
- **Goals checklist**: today's main quest goals.
- **Verification checklist**: read-only, one row per item.
- **Side quests strip**: unlocked-but-not-attempted quests with XP and time estimate.
- **Status bar**: `XP • Level • Streak (+shields) • Achievements`.

#### End-of-session ("Retro")

Renders from `feed.json` + the just-ended session + the trailing 6 sessions.

- **Top banner**: today's XP, achievements unlocked, level change, streak.
- **Goals donut**: done / in-progress / not-started for the session vs trailing 7-day average.
- **Time vs target bars**: actual vs planned minutes, last 7 sessions.
- **XP line**: cumulative XP per session, dots on achievement-unlock sessions.
- **Achievements timeline**: one card per unlock, grouped by tier, with evidence.
- **Decisions log**: ADR links open `curriculum/adr/…`.
- **Blockers panel**: open vs resolved, grouped by session.
- **Buddy questions**: the three asked, with the reflection underneath.

## Versioning

This contract was `v1` (`schema_version: 1`). The polyglot changes (stack/mode/run/masterplan, scoped achievements, stack and global ladders, titles) are additive, but files `award-xp` writes from now on carry `schema_version: 2`, and `rules.json` is `schema_version: 2`. A reader must treat every v2 field as optional with the defaults documented above, so v1 files keep rendering. Breaking changes need `v3`.

## Where the data comes from

- `/start` → `award-xp` (`session_ignition`). `/verify` → `award-xp` (`daily_acceptance`, `mutation_score`). `/debrief` → `award-xp` (everything else) and then republishes the Design artifact.
- `feed.json` is a pure function of `profile.json` + all session files + `achievements.json`.

## Deferred: cloud sync

A Cloudflare Workers + D1 sync with Microsoft Entra sign-in lives in [`tools/cloud-sync/`](../tools/cloud-sync/CLOUDFLARE-SYNC-SPEC.md). It is **not** on the critical path: the claude.ai artifact already gives a hosted, private, multi-device view. Its human-only gates are listed in that spec's "Before building" section; the agent work is in [`DASHBOARD-PLAN.md`](DASHBOARD-PLAN.md).
