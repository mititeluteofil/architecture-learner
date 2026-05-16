# Gamification & Dashboard — Data Contract

This spec is the data contract for an Angular app (or any front-end) that visualizes progress and renders the start-of-session brief and end-of-session retro. The CLI is the **only** writer to these files; the dashboard is read-only.

## File map

```
progress/
├── profile.json            # current learner state (single source of truth)
├── achievements.json       # achievement definitions + unlock log
├── sessions/
│   ├── session-01.json     # one file per session (one per day)
│   ├── session-02.json
│   └── …
├── feed.json               # pre-computed aggregates for fast UI reads
└── journal.md              # human-readable, free-form, not for UI parsing
```

The `award-xp` skill is the **sole writer** to `profile.json`, `achievements.json`, every `sessions/session-NN.json`, and `feed.json`. Re-running it is idempotent — same inputs produce the same final state.

## `profile.json`

```ts
type Profile = {
  current_day: number;              // 1..30
  current_project: string;          // e.g., "p3-loan-domain-hex"
  xp_total: number;
  level: {
    id: "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
    name: "Apprentice" | "Journeyman" | "Engineer" | "Senior" | "Staff" | "Architect";
    xp_in_level: number;            // XP earned since hitting this level
    xp_to_next: number;             // XP required to reach the next level
  };
  streak_days: number;              // resets to 1 after a 2+ day gap
  started_at: string | null;        // ISO date of session-01
  last_session_at: string | null;   // ISO datetime
  achievements_unlocked: number;    // count
  achievements_total: number;       // count of definitions[]
};
```

## `achievements.json`

```ts
type AchievementDefinition = {
  id: string;                       // kebab-case stable identifier
  name: string;                     // display name
  xp: number;                       // XP awarded on unlock
  description: string;
  criteria: string;                 // human + machine readable (the skill evaluates)
};
type AchievementUnlock = {
  id: string;
  unlocked_at: string;              // ISO datetime
  session_id: string;               // e.g., "session-06"
  evidence: string;                 // file path or command output snippet
};
type Achievements = {
  definitions: AchievementDefinition[];
  unlocked: AchievementUnlock[];
};
```

## `sessions/session-NN.json`

```ts
type GoalStatus = "done" | "in_progress" | "not_started";
type Session = {
  session_id: string;               // "session-NN" (zero-padded)
  day: number;                      // 1..30
  project: string;
  started_at: string;               // ISO datetime
  ended_at: string;                 // ISO datetime
  duration_minutes: number;
  planned_minutes: number;          // typically 150
  main_quest: {
    title: string;
    goals: { id: string; label: string; status: GoalStatus }[];
  };
  side_quests: {
    id: string;                     // "SQ-01", "SQK-02", "SQN-04", …
    status: "done" | "in_progress" | "skipped";
  }[];
  xp_earned: number;
  xp_breakdown: {
    reason: "daily_acceptance" | "side_quest" | "adr" | "property_bug"
          | "mutation_score" | "debrief" | "public_artifact";
    xp: number;
  }[];
  achievements_unlocked: { id: string; evidence: string }[];
  decisions: { summary: string; adr: string | null }[];
  blockers: { text: string; resolved: boolean }[];
  verification: {
    checks: { label: string; passed: boolean }[];
    all_passed: boolean;
  };
  buddy_questions_asked: string[];
  reflection: string;               // learner's freeform retro text
};
```

## `feed.json` — pre-computed aggregates

Regenerated on every write. Designed for one HTTP GET per dashboard load.

```ts
type Feed = {
  generated_at: string;             // ISO datetime
  xp_timeseries:     { day: number; xp_cumulative: number; xp_delta: number }[];
  minutes_timeseries:{ day: number; planned: number; actual: number }[];
  goal_completion_rate_by_session: { session_id: string; rate: number }[];   // 0..1
  achievements_timeline:            { id: string; session_id: string; unlocked_at: string }[];
  open_blockers:                    { text: string; since_session: string }[];
  recent_decisions:                 { summary: string; session_id: string; adr: string | null }[];
  streak_days: number;
  level_progression:                { day: number; level: string }[];
};
```

## Dashboard views

### Start-of-session ("Today")

Renders from `profile.json` + the current `curriculum/day-by-day/day-NN.md` (parse the `## Main Quest`, `## Verification`, and `## Decisions you'll need to make` sections) + the latest session's unfinished goals.

Components:
- **Today card**: day NN/30, project name, feature spotlight, ~hours.
- **Loose ends**: yesterday's `status: in_progress` goals, unresolved blockers, `// LEARNER:` marker count (the CLI computes and writes this into the most recent session record).
- **Goals checklist**: today's main quest goals (initially empty / not_started).
- **Verification checklist**: read-only, with each item as a row.
- **Side quests strip**: unlocked-but-not-attempted quests with XP and time estimate.
- **Status bar**: `XP • Level • Streak • Achievements`.

### End-of-session ("Retro")

Renders from `feed.json` + the just-ended `sessions/session-NN.json` + the trailing 6 sessions.

Components and recommended chart libs (Angular):
- **Top banner**: today's XP, achievements unlocked, level change, streak. Animated counter.
- **Goals donut** (e.g., `ngx-charts` pie): done / in-progress / not-started for the just-ended session vs trailing 7-day average.
- **Time vs target bars** (ngx-charts vertical bar): actual vs planned minutes per session, last 7.
- **XP line chart** (ngx-charts line): cumulative XP per day, with dots at achievement-unlock days.
- **Achievements timeline**: horizontal strip; each badge is a card with name, description, evidence link.
- **Decisions log**: scrollable list, ADR links open the file (`curriculum/adr/…`).
- **Blockers panel**: two columns — open (orange) and resolved (green), grouped by session.
- **Buddy questions**: the three asked, with the learner's reflection underneath.

## Versioning

This contract is `v1`. Add a `schema_version: 1` field to each JSON file before the dashboard ships. Bumps follow semver — additive changes within `v1.x`, breaking changes only at `v2`.

## Where the data comes from

- `award-xp` skill writes `profile.json`, `sessions/session-NN.json`, and appends to `achievements.json.unlocked` on every `/verify` success and every `/debrief`.
- `feed.json` is regenerated by `award-xp` at the end of each write — pure function of `profile.json` + all session files + `achievements.json`.
- The dashboard polls or watches the filesystem. If hosted, a small Node/Express static server pointed at `progress/` is enough.
