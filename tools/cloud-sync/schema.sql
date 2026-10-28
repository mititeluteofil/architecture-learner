-- Cloudflare D1 (SQLite) Schema for Architecture Learner Cloud Sync
-- Target: Free Tier (5GB storage, 5M reads/day, 100k writes/day)
--
-- Source of truth is the sessions + achievement_unlocks ledgers. The profiles row is a
-- cache derived from them on every sync — never merged field-by-field.

PRAGMA foreign_keys = ON;

-- 1. Learners (Microsoft Entra ID identity)
CREATE TABLE IF NOT EXISTS learners (
    id TEXT PRIMARY KEY,                  -- Entra 'oid' (immutable per tenant)
    tenant_id TEXT NOT NULL,              -- Entra 'tid'
    email TEXT NOT NULL,                  -- 'preferred_username'
    display_name TEXT NOT NULL,           -- 'name'
    leaderboard_opt_in INTEGER NOT NULL DEFAULT 0,  -- 0 = invisible to colleagues (default)
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 2. Sessions ledger (1:1 with progress/sessions/session-NN.json, private fields stripped)
CREATE TABLE IF NOT EXISTS sessions (
    learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    session_no INTEGER NOT NULL,          -- 'session' field: 1, 2, …
    day INTEGER NOT NULL,                 -- 1 .. 30
    date TEXT NOT NULL,                   -- ISO date (UTC); feeds the streak fold
    project TEXT NOT NULL,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    all_passed INTEGER NOT NULL DEFAULT 0,
    session_json TEXT NOT NULL,           -- no reflection / buddy_questions_asked
    -- v2 (polyglot). Defaults describe pre-v2 records: java / hands-on / run 1 / loan-servicing.
    masterplan TEXT NOT NULL DEFAULT 'loan-servicing',
    stack TEXT NOT NULL DEFAULT 'java',
    mode TEXT NOT NULL DEFAULT 'hands-on',   -- hands-on | assisted
    run INTEGER NOT NULL DEFAULT 1,          -- bumped by a fresh start (prestige); session numbers restart per run
    PRIMARY KEY (learner_id, run, session_no)
);

-- 3. Achievement unlocks (set union per learner)
CREATE TABLE IF NOT EXISTS achievement_unlocks (
    learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL,
    evidence TEXT NOT NULL,
    -- v2: '' for common/polyglot achievements and for pre-v2 records; the stack id for per-stack/stack scope.
    stack TEXT NOT NULL DEFAULT '',
    run INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (learner_id, achievement_id, stack, run)
);

-- 4. Derived profile cache (rebuilt from 2 + 3 on every sync)
CREATE TABLE IF NOT EXISTS profiles (
    learner_id TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
    current_day INTEGER NOT NULL,
    current_project TEXT NOT NULL,
    xp_total INTEGER NOT NULL,
    level_id TEXT NOT NULL,
    level_name TEXT NOT NULL,
    streak_days INTEGER NOT NULL,
    streak_shields INTEGER NOT NULL,
    achievements_unlocked INTEGER NOT NULL,
    started_at TEXT,
    last_session_at TEXT,
    profile_json TEXT NOT NULL,
    -- v2: derived from the ledgers like everything else here (xp_total / level_* describe the current run).
    headline_title TEXT NOT NULL DEFAULT '',
    global_level_id TEXT NOT NULL DEFAULT 'L1',
    lifetime_xp INTEGER NOT NULL DEFAULT 0,
    prestige INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_learners_tenant ON learners(tenant_id, leaderboard_opt_in);
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON profiles(xp_total DESC, current_day DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_lifetime ON profiles(lifetime_xp DESC);

-- ---------------------------------------------------------------------------------------
-- Upgrading a database created from the v1 schema (CREATE IF NOT EXISTS does not alter
-- existing tables). Run once, BEFORE deploying the v2 worker. Not part of the idempotent
-- statements above and not executed by the tests.
--
--   ALTER TABLE sessions ADD COLUMN masterplan TEXT NOT NULL DEFAULT 'loan-servicing';
--   ALTER TABLE sessions ADD COLUMN stack TEXT NOT NULL DEFAULT 'java';
--   ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'hands-on';
--   ALTER TABLE sessions ADD COLUMN run INTEGER NOT NULL DEFAULT 1;
--   ALTER TABLE profiles ADD COLUMN headline_title TEXT NOT NULL DEFAULT '';
--   ALTER TABLE profiles ADD COLUMN global_level_id TEXT NOT NULL DEFAULT 'L1';
--   ALTER TABLE profiles ADD COLUMN lifetime_xp INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE profiles ADD COLUMN prestige INTEGER NOT NULL DEFAULT 0;
--
-- SQLite cannot change a primary key in place, so sessions and achievement_unlocks are
-- rebuilt (create *_v2 with the definitions above, INSERT INTO *_v2 (...) SELECT ...,
-- DROP the old table, ALTER TABLE *_v2 RENAME TO *). Old rows take the column defaults.
-- The first v2 /api/sync recomputes every profiles row from the ledgers.
-- ---------------------------------------------------------------------------------------
