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
    PRIMARY KEY (learner_id, session_no)
);

-- 3. Achievement unlocks (set union per learner)
CREATE TABLE IF NOT EXISTS achievement_unlocks (
    learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL,
    evidence TEXT NOT NULL,
    PRIMARY KEY (learner_id, achievement_id)
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
    profile_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learners_tenant ON learners(tenant_id, leaderboard_opt_in);
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON profiles(xp_total DESC, current_day DESC);
