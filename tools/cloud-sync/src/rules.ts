import rules from "../../../progress/rules.json";

// Source of truth: progress/rules.json (shared with the award-xp skill). Do not hard-code values here.
export const LEVELS = rules.levels;
export const GLOBAL_LEVELS = rules.global_levels;
const SHIELD_EVERY = rules.shields.every;
const SHIELD_MAX = rules.shields.max;

export function computeLevel(xpTotal: number) {
  const lvl =
    LEVELS.find((l) => l.max === null || xpTotal <= l.max) ?? LEVELS[LEVELS.length - 1];
  return {
    id: lvl.id,
    name: lvl.name,
    xp_in_level: xpTotal - lvl.min,
    xp_to_next: lvl.max === null ? 0 : lvl.max + 1 - xpTotal,
  };
}

/** Same fold as award-xp's "Streak & Shield rule". */
export function computeStreak(sortedDates: string[]) {
  let streak = 0;
  let shields = 0;
  let prev: number | null = null;
  for (const iso of sortedDates) {
    const d = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000;
    if (prev === null) {
      streak = 1;
    } else {
      const missed = d - prev - 1;
      if (missed === 0) {
        streak += 1;
      } else if (missed <= shields) {
        shields -= missed;
        streak += 1;
      } else {
        streak = 1;
      }
    }
    if (streak % SHIELD_EVERY === 0) shields = Math.min(SHIELD_MAX, shields + 1);
    prev = d;
  }
  return { streak_days: streak, streak_shields: shields };
}

// ---------------------------------------------------------------------------------------
// Gamification v2: stacks, global ladder, titles. Mirrors tools/gamification-ref/compute.mjs
// (the spec oracle for award-xp); test/rules.test.ts keeps the two in step.
// ---------------------------------------------------------------------------------------

export const DEFAULT_STACK = "java";
export const DEFAULT_MODE = "hands-on";
export const DEFAULT_RUN = 1;
export const DEFAULT_MASTERPLAN = "loan-servicing";
export const MODES = ["hands-on", "assisted"] as const;
export type Mode = (typeof MODES)[number];

export interface LedgerSession {
  session_no: number;
  stack: string;
  mode: string;
  run: number;
  xp_earned: number;
  /** Public session_json; only achievements_unlocked[] is read (to exclude global-only XP). */
  session_json?: string;
}

type Band = { id: string; name: string; min: number; max: number | null };

function bandFor(xp: number, bands: Band[]) {
  const i = bands.findIndex((l) => l.max === null || xp <= l.max);
  const idx = i === -1 ? bands.length - 1 : i;
  const l = bands[idx];
  return { index: idx, id: l.id, name: l.name, xp_in_level: xp - l.min, xp_to_next: l.max === null ? 0 : l.max + 1 - xp };
}

export function computeGlobalLevel(xp: number) {
  const { index: _i, ...rest } = bandFor(xp, GLOBAL_LEVELS);
  return rest;
}

/** XP a session adds to its stack ladder: common/polyglot achievement XP is global-only. */
function stackXpOf(s: LedgerSession): number {
  let globalOnly = 0;
  if (s.session_json) {
    try {
      const ach = (JSON.parse(s.session_json) as { achievements_unlocked?: Array<{ scope?: string; xp?: number }> })
        .achievements_unlocked;
      for (const a of ach ?? []) {
        if ((a.scope === "common" || a.scope === "polyglot") && typeof a.xp === "number") globalOnly += a.xp;
      }
    } catch {
      /* unreadable session_json: count everything toward the stack */
    }
  }
  return s.xp_earned - globalOnly;
}

const STACK_LABELS: Record<string, string> = { java: "Java", dotnet: ".NET", node: "Node", python: "Python", ruby: "Ruby" };
export const stackLabel = (id: string) => STACK_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

/**
 * sessions: every ledger row of one learner, ordered by (run, session_no) ascending.
 * Returns the v2 profile fields; xp_total is the current (highest) run only.
 */
export function computeStacksAndTitles(sessions: LedgerSession[]) {
  const run = sessions.reduce((m, s) => Math.max(m, s.run), DEFAULT_RUN);
  const cur = sessions.filter((s) => s.run === run);
  const xp_total = cur.reduce((n, s) => n + s.xp_earned, 0);
  const lifetime_xp = sessions.reduce((n, s) => n + s.xp_earned, 0);
  const prestige = run - 1;
  const star = prestige > 0 ? `${rules.prestige.symbol.repeat(prestige)} ` : "";
  const capIdx = LEVELS.findIndex((l) => l.id === rules.assisted.level_cap);

  const ids = [...new Set(cur.map((s) => s.stack))].sort();
  const stacks: Record<
    string,
    { xp: number; mode: string; level: ReturnType<typeof computeLevel> & { capped: boolean }; index: number; counts: boolean }
  > = {};
  for (const id of ids) {
    const mine = cur.filter((s) => s.stack === id);
    const xp = mine.reduce((n, s) => n + stackXpOf(s), 0);
    const mode = mine[mine.length - 1].mode;
    const raw = bandFor(xp, LEVELS);
    const capped = mode === "assisted" && raw.index > capIdx;
    const index = capped ? capIdx : raw.index;
    const band = LEVELS[index];
    stacks[id] = {
      xp,
      mode,
      index,
      counts: mode === "assisted" ? rules.assisted.counts_for_titles : true,
      level: {
        id: band.id,
        name: band.name,
        xp_in_level: capped ? (band.max as number) - band.min : raw.xp_in_level,
        xp_to_next: capped ? 0 : raw.xp_to_next,
        capped,
      },
    };
  }

  const eligible = Object.values(stacks).filter((s) => s.counts);
  const prefixes = rules.title_prefixes as Record<string, string>;
  const maxPrefix = Math.max(...Object.keys(prefixes).map(Number));
  const idx = eligible.map((s) => s.index).sort((a, b) => b - a);
  const combos: Array<{ level: string; count: number; title: string; l: number }> = [];
  for (let n = 2; n <= Math.min(eligible.length, maxPrefix); n++) {
    const l = idx[n - 1];
    combos.push({ level: LEVELS[l].id, count: n, title: `${star}${prefixes[String(n)]} ${LEVELS[l].name}`, l });
  }
  combos.sort((a, b) => b.l - a.l || b.count - a.count);

  let best: { id: string; s: (typeof stacks)[string] } | null = null;
  for (const id of ids) {
    const s = stacks[id];
    if (!best || s.index > best.s.index || (s.index === best.s.index && s.xp > best.s.xp)) best = { id, s };
  }
  const best_single = best ? `${star}${best.s.level.name} · ${stackLabel(best.id)}` : null;
  const outCombos = combos.map(({ level, count, title }) => ({ level, count, title }));

  return {
    run,
    prestige,
    xp_total,
    lifetime_xp,
    global_level: computeGlobalLevel(xp_total),
    stacks: Object.fromEntries(
      Object.entries(stacks).map(([id, s]) => [id, { xp: s.xp, level: s.level, mode: s.mode }])
    ),
    /** Alias source for profile.level: the stack of the latest session of the run. */
    active_stack: cur.length ? cur[cur.length - 1].stack : DEFAULT_STACK,
    titles: { headline: outCombos[0]?.title ?? best_single, best_single, combos: outCombos },
  };
}
