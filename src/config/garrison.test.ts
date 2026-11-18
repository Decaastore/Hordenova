import { describe, expect, it } from "vitest";
import { GARRISON_MAX_LEVEL, garrisonSoldiers, garrisonUpgradeCost, garrisonVolleyDamage, sanitizeGarrisonLevel } from "./garrison";

describe("garrison", () => {
  it("costs more gold every level and stops at the top", () => {
    let prev = 0;
    for (let l = 0; l < GARRISON_MAX_LEVEL; l++) {
      const c = garrisonUpgradeCost(l)!;
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
    expect(garrisonUpgradeCost(GARRISON_MAX_LEVEL)).toBeNull();
  });
  it("puts more soldiers on the walls as it grows", () => {
    expect(garrisonSoldiers(0)).toBe(0);
    expect(garrisonSoldiers(1)).toBe(2);
    expect(garrisonSoldiers(GARRISON_MAX_LEVEL)).toBe(11);
  });
  it("hits a share of the boss's life, halved in a hunt", () => {
    expect(garrisonVolleyDamage(0, 1000)).toBe(0);
    const full = garrisonVolleyDamage(10, 100000);
    expect(full).toBeCloseTo(100000 * 0.04 * 0.9, 6);
    expect(garrisonVolleyDamage(10, 100000, true)).toBeCloseTo(full / 2, 6);
  });
  it("sanitizes", () => {
    expect(sanitizeGarrisonLevel("x")).toBe(0);
    expect(sanitizeGarrisonLevel(99)).toBe(GARRISON_MAX_LEVEL);
  });
});
