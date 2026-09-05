import { describe, expect, it } from "vitest";
import { getMasteryBonusMultipliers, getMasteryUpgradeCost } from "./towerMastery";
import { TOWER_TYPES } from "./towerStats";
import { SPECIALIZATION_UNLOCK_GEM_COST } from "./specializations";

describe("towerMastery (Master Implementation Pass spec sections 3-6, CORREÇÃO DE REQUISITOS — Gems-funded)", () => {
  it("costs strictly increase with mastery level (convex curve — never a bargain to keep buying)", () => {
    for (const type of TOWER_TYPES) {
      let previous = 0;
      for (let level = 0; level < 50; level++) {
        const cost = getMasteryUpgradeCost(type, level);
        expect(cost).toBeGreaterThan(previous);
        previous = cost;
      }
    }
  });

  it("level 1 mastery is accessible — comparable in scale to a Specialization unlock (both premium Gems purchases), not an instant trivial spend nor a wall", () => {
    // CORREÇÃO DE REQUISITOS: Mastery moved from Gold to Gems, so its own
    // scale must be compared against another Gems price, not a Gold one —
    // engine/ProgressionSimulation.test.ts's real 48h bot run is what
    // actually proved this magnitude reachable (a naive Gold->Gems currency
    // swap without rescaling made even level 1 cost ~10,000 Gems).
    for (const type of TOWER_TYPES) {
      const masteryLevel1Cost = getMasteryUpgradeCost(type, 0);
      expect(masteryLevel1Cost).toBeGreaterThan(SPECIALIZATION_UNLOCK_GEM_COST * 0.3);
      expect(masteryLevel1Cost).toBeLessThan(SPECIALIZATION_UNLOCK_GEM_COST * 5);
    }
  });

  it("never returns Infinity/NaN, even at mastery levels far beyond anything reachable in real play (spec section 47 numerical safety)", () => {
    for (const type of TOWER_TYPES) {
      for (const level of [0, 100, 2000, 10_000, 100_000, 1_000_000]) {
        const cost = getMasteryUpgradeCost(type, level);
        expect(Number.isFinite(cost)).toBe(true);
        expect(cost).toBeGreaterThan(0);
      }
    }
  });

  it("a large Gems stockpile cannot buy thousands of levels in one sitting (spec section 5)", () => {
    // A genuinely enormous stockpile (1 quadrillion Gems — many, many orders
    // of magnitude past anything a real save would ever hold) buying
    // greedily, one level at a time, from a completely fresh mastery track
    // must still run out well short of "thousands" of levels — proof the
    // convex curve, not the player's patience, is what limits this.
    const hugeStockpile = 1e15;
    let gems = hugeStockpile;
    let level = 0;
    while (gems >= getMasteryUpgradeCost("IRONWOOD", level)) {
      gems -= getMasteryUpgradeCost("IRONWOOD", level);
      level++;
    }
    expect(level).toBeLessThan(1000);
    expect(level).toBeGreaterThan(0); // and it's not "practically impossible" either
  });

  it("bonus multipliers are 1.0 (no change) at mastery level 0, and grow linearly and small per level", () => {
    expect(getMasteryBonusMultipliers(0)).toEqual({ damage: 1, attackSpeed: 1, range: 1 });
    const at100 = getMasteryBonusMultipliers(100);
    expect(at100.damage).toBeCloseTo(1.4, 5); // +0.4%/level * 100
    expect(at100.attackSpeed).toBeCloseTo(1.2, 5);
    expect(at100.range).toBeCloseTo(1.1, 5);
  });

  it("bonus multipliers never overflow at extreme mastery levels", () => {
    const at1M = getMasteryBonusMultipliers(1_000_000);
    expect(Number.isFinite(at1M.damage)).toBe(true);
    expect(Number.isFinite(at1M.attackSpeed)).toBe(true);
    expect(Number.isFinite(at1M.range)).toBe(true);
  });
});
