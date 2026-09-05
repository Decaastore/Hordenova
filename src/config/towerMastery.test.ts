import { describe, expect, it } from "vitest";
import {
  getAvailableRespecTokens,
  getMasteryCosmeticTier,
  getMasteryRespecTokensEarned,
  getMasteryUpgradeCost,
  getNextMasteryCosmeticTier,
  MASTERY_COSMETIC_TIERS,
  MASTERY_RESPEC_TOKEN_INTERVAL,
} from "./towerMastery";
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

  // CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — Mastery no longer grants
  // any damage/attackSpeed/range multiplier at all (see entities/Tower.ts's
  // own permanent regression test for the getTowerStats side of this
  // guarantee). What it grants instead — Respec Tokens and cosmetic
  // tiers — is exercised below.

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
