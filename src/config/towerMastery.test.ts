import { describe, expect, it } from "vitest";
import {
  getAvailableRespecTokens,
  getMasteryBonuses,
  getMasteryCosmeticTier,
  getMasteryRespecTokensEarned,
  getMasteryUpgradeCost,
  getNextMasteryCosmeticTier,
  masteryEffectScale,
  MASTERY_COSMETIC_TIERS,
  MASTERY_RESPEC_TOKEN_INTERVAL,
  MASTERY_UNLOCK_GEM_COST,
} from "./towerMastery";
import { TOWER_TYPES } from "./towerStats";
import { SPECIALIZATION_UNLOCK_GEM_COST } from "./specializations";

describe("towerMastery (Master Implementation Pass spec sections 3-6, INFINITE BALANCE OVERHAUL — Gems-once, Gold-forever)", () => {
  it("GOLD upgrade costs strictly increase with mastery level FOREVER — never a bargain to keep buying, never capped", () => {
    for (const type of TOWER_TYPES) {
      let previous = 0;
      for (const level of [0, 1, 2, 5, 10, 25, 50, 100, 1000, 10_000]) {
        const cost = getMasteryUpgradeCost(type, level);
        expect(cost).toBeGreaterThan(previous);
        previous = cost;
      }
    }
  });

  it("the one-time unlock cost is comparable in scale to Specialization's own one-time unlock (both premium Gems purchases), not a trivial spend nor a wall", () => {
    expect(MASTERY_UNLOCK_GEM_COST).toBeGreaterThan(SPECIALIZATION_UNLOCK_GEM_COST * 0.3);
    expect(MASTERY_UNLOCK_GEM_COST).toBeLessThan(SPECIALIZATION_UNLOCK_GEM_COST * 5);
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

  it("a large Gold stockpile cannot buy thousands of levels in one sitting (spec section 5)", () => {
    // A stockpile (100 million Gold — many orders of magnitude past a
    // typical Season balance) buying greedily, one level at a time, from an
    // already-unlocked (level 1) mastery track must still run out well
    // short of "thousands" of extra levels — proof the convex-then-linear
    // curve, not the player's patience, limits this. (The curve's linear
    // tail is DELIBERATELY asymptotically linear rather than ever re-capping
    // — see this file's own doc comment on getMasteryUpgradeCost — so an
    // astronomically larger stockpile, e.g. 1e15, CAN buy past 1000 levels;
    // that is the intended "no wall, ever" shape, not a bug.)
    const hugeStockpile = 1e8;
    let gold = hugeStockpile;
    let level = 1;
    while (gold >= getMasteryUpgradeCost("IRONWOOD", level)) {
      gold -= getMasteryUpgradeCost("IRONWOOD", level);
      level++;
    }
    expect(level).toBeLessThan(1000);
    expect(level).toBeGreaterThan(1); // and it's not "practically impossible" either
  });

  it("masteryEffectScale is a strictly increasing, diminishing-returns, never-flat function of level — the same shape as Specialization's own scale, with a different exponent", () => {
    const levels = [0, 1, 5, 10, 50, 100, 1000, 1_000_000];
    let previousScale = -Infinity;
    for (const level of levels) {
      const scale = masteryEffectScale(level);
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(0);
      expect(scale).toBeGreaterThan(previousScale);
      previousScale = scale;
    }
  });

  it("getMasteryBonuses grants small, real, ever-growing damage/attackSpeed/range multipliers, with bounded goldCostReduction/siegeResistance that never exceed their caps", () => {
    let previous = getMasteryBonuses(0);
    for (const level of [1, 10, 100, 1000, 100_000]) {
      const bonuses = getMasteryBonuses(level);
      expect(bonuses.damageMultiplier).toBeGreaterThan(previous.damageMultiplier);
      expect(bonuses.attackSpeedMultiplier).toBeGreaterThan(previous.attackSpeedMultiplier);
      expect(bonuses.rangeMultiplier).toBeGreaterThan(previous.rangeMultiplier);
      expect(bonuses.goldCostReduction).toBeLessThanOrEqual(0.5);
      expect(bonuses.siegeResistance).toBeLessThanOrEqual(0.8);
      for (const value of Object.values(bonuses)) expect(Number.isFinite(value)).toBe(true);
      previous = bonuses;
    }
  });

  // Respec Tokens and cosmetic tiers are unchanged from the original design
  // (see this file's exports) — exercised below.

  it("Respec Tokens: 0 below the first interval, then exactly 1 every MASTERY_RESPEC_TOKEN_INTERVAL levels", () => {
    expect(getMasteryRespecTokensEarned(0)).toBe(0);
    expect(getMasteryRespecTokensEarned(MASTERY_RESPEC_TOKEN_INTERVAL - 1)).toBe(0);
    expect(getMasteryRespecTokensEarned(MASTERY_RESPEC_TOKEN_INTERVAL)).toBe(1);
    expect(getMasteryRespecTokensEarned(MASTERY_RESPEC_TOKEN_INTERVAL * 2)).toBe(2);
    expect(getMasteryRespecTokensEarned(MASTERY_RESPEC_TOKEN_INTERVAL * 3)).toBe(3);
  });

  it("Respec Tokens: is a PURE function of masteryLevel — calling it repeatedly (simulating a reload/restart) never changes the result, so it can never double-grant", () => {
    const level = MASTERY_RESPEC_TOKEN_INTERVAL * 4;
    const first = getMasteryRespecTokensEarned(level);
    const second = getMasteryRespecTokensEarned(level);
    const third = getMasteryRespecTokensEarned(level);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("getAvailableRespecTokens subtracts what's already been spent, and never goes negative", () => {
    expect(getAvailableRespecTokens(MASTERY_RESPEC_TOKEN_INTERVAL * 3, 0)).toBe(3);
    expect(getAvailableRespecTokens(MASTERY_RESPEC_TOKEN_INTERVAL * 3, 2)).toBe(1);
    expect(getAvailableRespecTokens(MASTERY_RESPEC_TOKEN_INTERVAL * 3, 3)).toBe(0);
    expect(getAvailableRespecTokens(MASTERY_RESPEC_TOKEN_INTERVAL * 3, 999)).toBe(0);
  });

  it("cosmetic tiers unlock in order as masteryLevel rises, and are never affected by combat state (pure function of level)", () => {
    expect(getMasteryCosmeticTier(0)).toBeNull();
    for (const tier of MASTERY_COSMETIC_TIERS) {
      expect(getMasteryCosmeticTier(tier.level)?.id).toBe(tier.id);
    }
    const highestTier = MASTERY_COSMETIC_TIERS[MASTERY_COSMETIC_TIERS.length - 1]!;
    expect(getMasteryCosmeticTier(highestTier.level + 10_000)?.id).toBe(highestTier.id);
  });

  it("getNextMasteryCosmeticTier points at the next unearned tier, and null once every tier is unlocked", () => {
    expect(getNextMasteryCosmeticTier(0)?.id).toBe(MASTERY_COSMETIC_TIERS[0]!.id);
    const highestTier = MASTERY_COSMETIC_TIERS[MASTERY_COSMETIC_TIERS.length - 1]!;
    expect(getNextMasteryCosmeticTier(highestTier.level)).toBeNull();
  });
});
