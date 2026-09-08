import { describe, expect, it } from "vitest";
import {
  canUnlockPrestige,
  getPrestigeBonuses,
  getPrestigeTier,
  getPrestigeUpgradeCost,
  PRESTIGE_FUNCTIONAL_CAP_LEVEL,
  PRESTIGE_MIN_BEST_WAVE,
} from "./prestige";

describe("prestige (HORDENOVA Season/Progression v1.0 — final recalibration)", () => {
  describe("requirement gate", () => {
    it("bestWave below PRESTIGE_MIN_BEST_WAVE (100) does not permit Prestige", () => {
      expect(canUnlockPrestige(0)).toBe(false);
      expect(canUnlockPrestige(99)).toBe(false);
    });

    it("bestWave >= 100 permits Prestige", () => {
      expect(canUnlockPrestige(100)).toBe(true);
      expect(canUnlockPrestige(101)).toBe(true);
      expect(canUnlockPrestige(10_000)).toBe(true);
      expect(PRESTIGE_MIN_BEST_WAVE).toBe(100);
    });
  });

  describe("cost curve — round(150 * 1.10^(level+1)) + (level+1)", () => {
    it("matches the exact approved values at levels 1, 5, 10, 20, 30, 40, 50", () => {
      expect(getPrestigeUpgradeCost(0)).toBe(166); // -> level 1
      expect(getPrestigeUpgradeCost(4)).toBe(247); // -> level 5
      expect(getPrestigeUpgradeCost(9)).toBe(399); // -> level 10
      expect(getPrestigeUpgradeCost(19)).toBe(1029); // -> level 20
      expect(getPrestigeUpgradeCost(29)).toBe(2647); // -> level 30
      expect(getPrestigeUpgradeCost(39)).toBe(6829); // -> level 40
      expect(getPrestigeUpgradeCost(49)).toBe(17_659); // -> level 50
    });

    it("cost strictly increases with level", () => {
      let previous = 0;
      for (let level = 0; level < 200; level++) {
        const cost = getPrestigeUpgradeCost(level);
        expect(cost).toBeGreaterThan(previous);
        previous = cost;
      }
    });

    it("stays finite well past any realistically reachable level", () => {
      for (const level of [0, 100, 1000, 5000]) {
        const cost = getPrestigeUpgradeCost(level);
        expect(Number.isFinite(cost)).toBe(true);
        expect(cost).toBeGreaterThan(0);
      }
    });
  });

  describe("economy bonuses — bounded, no combat power", () => {
    it("ramps +0.5% Gold per level up to the 15% cap", () => {
      expect(getPrestigeBonuses(0).goldMultiplier).toBe(1);
      expect(getPrestigeBonuses(1).goldMultiplier).toBeCloseTo(1.005, 5);
      expect(getPrestigeBonuses(10).goldMultiplier).toBeCloseTo(1.05, 5);
      expect(getPrestigeBonuses(20).goldMultiplier).toBeCloseTo(1.1, 5);
      expect(getPrestigeBonuses(30).goldMultiplier).toBeCloseTo(1.15, 5);
    });

    it("ramps +0.5% Gem Shards per level up to the 20% cap", () => {
      expect(getPrestigeBonuses(0).gemShardMultiplier).toBe(1);
      expect(getPrestigeBonuses(10).gemShardMultiplier).toBeCloseTo(1.05, 5);
      expect(getPrestigeBonuses(40).gemShardMultiplier).toBeCloseTo(1.2, 5);
    });

    it("level 40 is the functional cap for both bonuses", () => {
      expect(PRESTIGE_FUNCTIONAL_CAP_LEVEL).toBe(40);
      const at40 = getPrestigeBonuses(40);
      expect(at40.goldMultiplier).toBeCloseTo(1.15, 5); // Gold already capped at level 30
      expect(at40.gemShardMultiplier).toBeCloseTo(1.2, 5);
    });

    it("level 41+ never increases either bonus past its cap, no matter how high", () => {
      const at40 = getPrestigeBonuses(40);
      for (const level of [41, 50, 100, 10_000]) {
        const bonuses = getPrestigeBonuses(level);
        expect(bonuses.goldMultiplier).toBe(at40.goldMultiplier);
        expect(bonuses.gemShardMultiplier).toBe(at40.gemShardMultiplier);
      }
    });

    it("never grants any bonus above its documented cap, at any level", () => {
      for (const level of [0, 15, 30, 40, 41, 1000]) {
        const bonuses = getPrestigeBonuses(level);
        expect(bonuses.goldMultiplier).toBeLessThanOrEqual(1.15 + 1e-9);
        expect(bonuses.gemShardMultiplier).toBeLessThanOrEqual(1.2 + 1e-9);
      }
    });
  });

  describe("Prestige level keeps climbing past the functional cap (status only)", () => {
    it("cost keeps strictly increasing past level 40, even though bonuses no longer do", () => {
      const costAt41 = getPrestigeUpgradeCost(40);
      const costAt100 = getPrestigeUpgradeCost(99);
      expect(costAt100).toBeGreaterThan(costAt41);
    });

    it("tiers cycle through names every 10 levels and never wrap/break at extreme levels", () => {
      expect(getPrestigeTier(0)).toMatchObject({ tier: 0, nameKey: "INITIATE", cycle: 0 });
      expect(getPrestigeTier(9)).toMatchObject({ tier: 0, nameKey: "INITIATE", cycle: 0 });
      expect(getPrestigeTier(10)).toMatchObject({ tier: 1, nameKey: "ADEPT", cycle: 0 });
      // 10 names -> tier 10 cycles back to INITIATE, but with cycle=1 so it's distinguishable.
      expect(getPrestigeTier(100)).toMatchObject({ tier: 10, nameKey: "INITIATE", cycle: 1 });
      const extreme = getPrestigeTier(1_000_000);
      expect(Number.isFinite(extreme.tier)).toBe(true);
      expect(Number.isFinite(extreme.cycle)).toBe(true);
    });
  });
});
