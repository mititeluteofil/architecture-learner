/** Keep in sync with .claude/skills/award-xp/SKILL.md "Levels". */
export const LEVELS = [
  { id: "L1", name: "Apprentice", min: 0, max: 600 },
  { id: "L2", name: "Journeyman", min: 601, max: 1600 },
  { id: "L3", name: "Engineer", min: 1601, max: 3200 },
  { id: "L4", name: "Senior", min: 3201, max: 5600 },
  { id: "L5", name: "Staff", min: 5601, max: 9000 },
  { id: "L6", name: "Architect", min: 9001, max: Infinity },
] as const;

export function computeLevel(xpTotal: number) {
  const lvl = LEVELS.find((l) => xpTotal <= l.max) ?? LEVELS[LEVELS.length - 1];
  return {
    id: lvl.id,
    name: lvl.name,
    xp_in_level: xpTotal - lvl.min,
    xp_to_next: lvl.max === Infinity ? 0 : lvl.max + 1 - xpTotal,
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
    if (streak % 3 === 0) shields = Math.min(3, shields + 1);
    prev = d;
  }
  return { streak_days: streak, streak_shields: shields };
}
