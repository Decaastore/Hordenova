import { describe, expect, it } from "vitest";
import {
  applyMasteryToSpecial,
  getMasteryBonuses,
  getMasteryCosmeticTier,
  getMasteryUnlockGoldCost,
  getMasteryUpgradeCost,
  getNextMasteryCosmeticTier,
  masteryEffectScale,
  MASTERY_COSMETIC_TIERS,
  MASTERY_EFFECT_EXPONENT,
} from "./towerMastery";
import { getTowerSpecialAtLevel, TOWER_DEFINITIONS, TOWER_TYPES } from "./towerStats";

describe("towerMastery (Master Implementation Pass spec sections 3-6, FASE 6 — Gold-only unlock and levels)", () => {
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

  it("FASE 6 currency division: the one-time unlock is GOLD, never Gems — anchored to each tower type's own upgradeCostBase, not an arbitrary flat number", () => {
    for (const type of TOWER_TYPES) {
      expect(getMasteryUnlockGoldCost(type)).toBe(TOWER_DEFINITIONS[type].upgradeCostBase * 300);
    }
  });

  it("the one-time Gold unlock cost is a considerable but real amount — same order of magnitude as leveling a tower to 10 (Specialization's own unlock milestone), never a trivial tax nor an impossible wall", () => {
    for (const type of TOWER_TYPES) {
      const cost = getMasteryUnlockGoldCost(type);
      expect(cost).toBeGreaterThan(5000);
      expect(cost).toBeLessThan(25000);
    }
  });

  it("HORDENOVA Season/Progression v1.0 contract: MASTERY_EFFECT_EXPONENT stays frozen at 0.45", () => {
    expect(MASTERY_EFFECT_EXPONENT).toBe(0.45);
  });

  it("HORDENOVA Season/Progression v1.0 contract: the Season Gold cost curve uses multiplier 55 / growth 1.07 / compound cap 40", () => {
    const MASTERY_BASE_COST_MULTIPLIER = 55;
    const MASTERY_COST_GROWTH_FACTOR = 1.07;
    const MASTERY_COST_COMPOUND_LEVEL_CAP = 40;
    const linearTailGrowth = Math.log(MASTERY_COST_GROWTH_FACTOR);
    for (const type of TOWER_TYPES) {
      const def = TOWER_DEFINITIONS[type];
      for (const currentLevel of [0, 1, 10, 39, 40, 41, 100]) {
        const targetLevel = Math.max(1, currentLevel + 1);
        const base = def.upgradeCostBase * MASTERY_BASE_COST_MULTIPLIER;
        const cappedLevel = Math.min(targetLevel, MASTERY_COST_COMPOUND_LEVEL_CAP);
        const compound = Math.pow(MASTERY_COST_GROWTH_FACTOR, cappedLevel - 1);
        const tailLevels = Math.max(0, targetLevel - MASTERY_COST_COMPOUND_LEVEL_CAP);
        const linearTail = 1 + tailLevels * linearTailGrowth;
        const expected = Math.round(base * compound * linearTail) + targetLevel;
        expect(getMasteryUpgradeCost(type, currentLevel)).toBe(expected);
      }
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

  describe("applyMasteryToSpecial — FASE 6 identity axis", () => {
    it("masteryLevel 0 (or below) never changes the base special", () => {
      for (const type of TOWER_TYPES) {
        const base = getTowerSpecialAtLevel(type, 15);
        expect(applyMasteryToSpecial(base, 0)).toEqual(base);
        expect(applyMasteryToSpecial(base, -5)).toEqual(base);
      }
    });

    it("Ironwood: crit chance and crit multiplier strictly increase with mastery level, never exceeding sane bounds", () => {
      const base = getTowerSpecialAtLevel("IRONWOOD", 15);
      let previousChance = (base as Extract<typeof base, { type: "IRONWOOD" }>).critChance;
      let previousMult = (base as Extract<typeof base, { type: "IRONWOOD" }>).critMultiplier;
      for (const level of [1, 20, 30, 60, 100, 200, 400]) {
        const result = applyMasteryToSpecial(base, level) as Extract<typeof base, { type: "IRONWOOD" }>;
        expect(result.critChance).toBeGreaterThan(previousChance);
        expect(result.critChance).toBeLessThanOrEqual(0.9);
        expect(result.critMultiplier).toBeGreaterThan(previousMult);
        previousChance = result.critChance;
        previousMult = result.critMultiplier;
      }
    });

    it("Inferno: AoE radius and burn damage strictly increase (proportionally) with mastery level", () => {
      const base = getTowerSpecialAtLevel("INFERNO", 15) as Extract<ReturnType<typeof getTowerSpecialAtLevel>, { type: "INFERNO" }>;
      let previousRadius = base.aoeRadius;
      let previousBurn = base.burnDamagePerSecond;
      for (const level of [1, 20, 30, 60, 100, 200, 400]) {
        const result = applyMasteryToSpecial(base, level) as typeof base;
        expect(result.aoeRadius).toBeGreaterThan(previousRadius);
        expect(result.burnDamagePerSecond).toBeGreaterThan(previousBurn);
        previousRadius = result.aoeRadius;
        previousBurn = result.burnDamagePerSecond;
      }
    });

    it("Frostborn: slow potency and freeze chance strictly increase, never exceeding sane bounds", () => {
      const base = getTowerSpecialAtLevel("FROSTBORN", 15) as Extract<ReturnType<typeof getTowerSpecialAtLevel>, { type: "FROSTBORN" }>;
      let previousSlow = base.slowPercent;
      let previousFreeze = base.freezeChance;
      for (const level of [1, 20, 30, 60, 100, 200, 400]) {
        const result = applyMasteryToSpecial(base, level) as typeof base;
        expect(result.slowPercent).toBeGreaterThan(previousSlow);
        expect(result.slowPercent).toBeLessThanOrEqual(0.95);
        expect(result.freezeChance).toBeGreaterThan(previousFreeze);
        expect(result.freezeChance).toBeLessThanOrEqual(0.85);
        previousSlow = result.slowPercent;
        previousFreeze = result.freezeChance;
      }
    });

    it("Stormcaller: chain falloff strictly decreases (stronger chain) and armor penetration strictly increases, never exceeding sane bounds", () => {
      const base = getTowerSpecialAtLevel("STORMCALLER", 15) as Extract<ReturnType<typeof getTowerSpecialAtLevel>, { type: "STORMCALLER" }>;
      let previousFalloff = base.chainFalloff;
      let previousPen = base.armorPenetration;
      for (const level of [1, 20, 30, 60, 100, 200, 400]) {
        const result = applyMasteryToSpecial(base, level) as typeof base;
        expect(result.chainFalloff).toBeLessThan(previousFalloff);
        expect(result.chainFalloff).toBeGreaterThanOrEqual(0.05);
        expect(result.armorPenetration).toBeGreaterThan(previousPen);
        expect(result.armorPenetration).toBeLessThanOrEqual(0.95);
        previousFalloff = result.chainFalloff;
        previousPen = result.armorPenetration;
      }
    });

    it("never returns Infinity/NaN at extreme mastery levels", () => {
      for (const type of TOWER_TYPES) {
        const base = getTowerSpecialAtLevel(type, 15);
        for (const level of [1000, 100_000, 1_000_000]) {
          const result = applyMasteryToSpecial(base, level);
          for (const value of Object.values(result)) {
            if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
          }
        }
      }
    });
  });
});
