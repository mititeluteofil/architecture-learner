import { describe, expect, it } from "vitest";
import { LEVELS, computeLevel, computeStreak } from "../src/rules";

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

// Drift guard: the worker must follow progress/rules.json (the award-xp skill's source of truth).
import rules from "../../../progress/rules.json";

describe("rules.json drift", () => {
  it("worker level table equals rules.json", () => {
    expect(LEVELS).toEqual(rules.levels);
  });

  it("computeLevel matches every rules.json boundary", () => {
    rules.levels.forEach((l, i) => {
      const at = computeLevel(l.min);
      expect(at.id).toBe(l.id);
      expect(at.name).toBe(l.name);
      expect(at.xp_in_level).toBe(0);
      if (l.max === null) {
        expect(i).toBe(rules.levels.length - 1);
        expect(at.xp_to_next).toBe(0);
        expect(computeLevel(l.min + 100_000).id).toBe(l.id);
      } else {
        const top = computeLevel(l.max);
        expect(top.id).toBe(l.id);
        expect(top.xp_to_next).toBe(1);
        expect(computeLevel(l.max + 1).id).toBe(rules.levels[i + 1].id);
      }
    });
  });

  it("shield fold follows shields.every and shields.max", () => {
    const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
    const { every, max } = rules.shields;
    // Consecutive run long enough to hit the cap: shields == min(max, floor(n / every)).
    const n = every * (max + 2);
    const run = Array.from({ length: n }, (_, i) => day(i));
    expect(computeStreak(run)).toEqual({
      streak_days: n,
      streak_shields: Math.min(max, Math.floor(n / every)),
    });
    // First shield appears exactly at day `every`.
    expect(computeStreak(run.slice(0, every - 1)).streak_shields).toBe(0);
    expect(computeStreak(run.slice(0, every)).streak_shields).toBe(1);
  });
});
