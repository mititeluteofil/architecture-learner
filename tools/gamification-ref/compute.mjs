// Spec oracle for award-xp's level/title computation (gamification v2).
// Pure and dependency-free. NOT the implementation award-xp runs; it exists so the
// algorithm in .claude/skills/award-xp/SKILL.md can be tested.
//
// computeState(sessions, rules, opts?) -> {
//   run, prestige, xp_total, lifetime_xp, global_level,
//   stacks: { <id>: { xp, mode, level: {id,name,xp_in_level,xp_to_next,capped}, counts_for_titles } },
//   titles: { headline, best_single, combos: [{level, count, title}] }
// }

export const DEFAULTS = { stack: "java", mode: "hands-on", run: 1, masterplan: "loan-servicing" };
const STACK_LABELS = { java: "Java", dotnet: ".NET", node: "Node", python: "Python", ruby: "Ruby" };

/** Old records (no stack/mode/run/masterplan) are read with defaults and never back-filled. */
export function normalize(s) {
  return {
    ...s,
    stack: s.stack ?? DEFAULTS.stack,
    mode: s.mode ?? DEFAULTS.mode,
    run: s.run ?? DEFAULTS.run,
    masterplan: s.masterplan ?? DEFAULTS.masterplan,
  };
}

/** Assisted sessions earn daily_acceptance at the multiplier; every other event is unchanged. */
export function applyMode(event, xp, mode, rules) {
  return mode === "assisted" && event === "daily_acceptance" ? Math.floor(xp * rules.assisted.xp_multiplier) : xp;
}

export function levelFor(xp, bands) {
  const i = bands.findIndex((l) => l.max === null || xp <= l.max);
  const idx = i === -1 ? bands.length - 1 : i;
  const l = bands[idx];
  return { index: idx, id: l.id, name: l.name, xp_in_level: xp - l.min, xp_to_next: l.max === null ? 0 : l.max + 1 - xp };
}

/** XP a session contributes to its stack ladder: common/polyglot achievement XP is global-only. */
export function stackXp(s) {
  const globalOnly = (s.achievements_unlocked ?? [])
    .filter((a) => a.scope === "common" || a.scope === "polyglot")
    .reduce((sum, a) => sum + (a.xp ?? 0), 0);
  return s.xp_earned - globalOnly;
}

export function stackLabel(id, labels = STACK_LABELS) {
  return labels[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export function computeState(rawSessions, rules, opts = {}) {
  const all = rawSessions.map(normalize).sort((a, b) => a.session - b.session);
  const run = opts.run ?? Math.max(DEFAULTS.run, ...all.map((s) => s.run));
  const prestige = opts.prestige ?? run - 1;
  const cur = all.filter((s) => s.run === run);
  const xp_total = cur.reduce((n, s) => n + s.xp_earned, 0);
  const lifetime_xp = all.reduce((n, s) => n + s.xp_earned, 0);
  const stars = (rules.prestige?.symbol ?? "").repeat(prestige);
  const star = stars ? `${stars} ` : "";

  // Per-stack ladders. Mode of a stack = mode of its latest session in this run.
  const ids = [...new Set(cur.map((s) => s.stack))].sort();
  const capIdx = rules.levels.findIndex((l) => l.id === rules.assisted.level_cap);
  const stacks = {};
  for (const id of ids) {
    const mine = cur.filter((s) => s.stack === id);
    const xp = mine.reduce((n, s) => n + stackXp(s), 0);
    const mode = mine[mine.length - 1].mode;
    const raw = levelFor(xp, rules.levels);
    const capped = mode === "assisted" && raw.index > capIdx;
    const idx = capped ? capIdx : raw.index;
    const band = rules.levels[idx];
    stacks[id] = {
      xp,
      mode,
      index: idx,
      level: {
        id: band.id,
        name: band.name,
        xp_in_level: capped ? band.max - band.min : raw.xp_in_level,
        xp_to_next: capped ? 0 : raw.xp_to_next,
        capped,
      },
      counts_for_titles: mode === "assisted" ? rules.assisted.counts_for_titles : true,
    };
  }

  const g = levelFor(xp_total, rules.global_levels);
  const global_level = { id: g.id, name: g.name, xp_in_level: g.xp_in_level, xp_to_next: g.xp_to_next };

  // Titles: only stacks with counts_for_titles (hands-on) feed the prefix.
  const eligible = Object.values(stacks).filter((s) => s.counts_for_titles);
  const maxPrefix = Math.max(...Object.keys(rules.title_prefixes).map(Number));
  const sortedIdx = eligible.map((s) => s.index).sort((a, b) => b - a);
  const combos = [];
  for (let n = 2; n <= Math.min(eligible.length, maxPrefix); n++) {
    const L = sortedIdx[n - 1]; // highest level index reached by at least n eligible stacks
    combos.push({ level: rules.levels[L].id, count: n, title: `${star}${rules.title_prefixes[n]} ${rules.levels[L].name}`, _l: L });
  }
  combos.sort((a, b) => b._l - a._l || b.count - a.count);
  combos.forEach((c) => delete c._l);

  let best = null;
  for (const id of ids) {
    const s = stacks[id];
    if (!best || s.index > best.s.index || (s.index === best.s.index && s.xp > best.s.xp)) best = { id, s };
  }
  const best_single = best ? `${star}${best.s.level.name} · ${stackLabel(best.id, opts.stackLabels)}` : null;
  const headline = combos.length ? combos[0].title : best_single;

  return {
    run,
    prestige,
    xp_total,
    lifetime_xp,
    global_level,
    stacks: Object.fromEntries(
      Object.entries(stacks).map(([k, v]) => [k, { xp: v.xp, mode: v.mode, level: v.level, counts_for_titles: v.counts_for_titles }])
    ),
    titles: { headline, best_single, combos },
  };
}
