import rules from "../../../progress/rules.json";

// Source of truth: progress/rules.json (shared with the award-xp skill). Do not hard-code values here.
export const LEVELS = rules.levels;
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
