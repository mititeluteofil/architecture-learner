import { describe, expect, it } from "vitest";
import { computeLevel, computeStreak } from "../src/rules";

describe("computeLevel", () => {
  it.each([
    [0, "L1", 0, 601],
    [600, "L1", 600, 1],
    [601, "L2", 0, 1000],
    [1600, "L2", 999, 1],
    [1601, "L3", 0, 1600],
    [9000, "L5", 3399, 1],
    [9001, "L6", 0, 0],
  ])("xp %i -> %s (in level %i, to next %i)", (xp, id, inLevel, toNext) => {
    const lvl = computeLevel(xp);
    expect(lvl.id).toBe(id);
    expect(lvl.xp_in_level).toBe(inLevel);
    expect(lvl.xp_to_next).toBe(toNext);
  });
});

describe("computeStreak", () => {
  it("single day is a streak of 1, no shields", () => {
    expect(computeStreak(["2026-05-30"])).toEqual({ streak_days: 1, streak_shields: 0 });
  });

  it("a 1-day gap is bridged by the shield earned on day 3", () => {
    expect(computeStreak(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-05"])).toEqual({
      streak_days: 4,
      streak_shields: 0,
    });
  });

  it("a 2-day gap exceeds the shield and resets", () => {
    expect(computeStreak(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-06"])).toEqual({
      streak_days: 1,
      streak_shields: 1,
    });
  });

  // Dedupe of same-day sessions lives in rebuildProfile (Set over date.slice(0,10)),
  // so it is covered in sync.test.ts; computeStreak expects unique sorted dates.
});
