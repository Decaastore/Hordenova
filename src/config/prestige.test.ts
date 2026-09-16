import { describe, expect, it } from "vitest";
import {
  canUnlockPrestige,
  getEarnedPrestigeMilestoneRewards,
  getNextPrestigeMilestoneReward,
  getPrestigeBonuses,
  getPrestigeMilestoneReward,
  getPrestigeTier,
  getPrestigeUpgradeCost,
  PRESTIGE_FUNCTIONAL_CAP_LEVEL,
  PRESTIGE_MILESTONE_REWARDS,
  PRESTIGE_MIN_BEST_WAVE,
} from "./prestige";

function cumulativePrestigeCost(targetLevel: number): number {
  let sum = 0;
  for (let level = 1; level <= targetLevel; level++) sum += getPrestigeUpgradeCost(level - 1);
  return sum;
}

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

  describe("cost curve — FASE 6, Cenário D + Curva E2 (base=5, growth=1.07, compound cap=50)", () => {
    it("matches the exact approved next-level-cost table at P1/P5/P10/P20/P25/P30/P50/P75/P100", () => {
      expect(getPrestigeUpgradeCost(0)).toBe(6); // -> P1
      expect(getPrestigeUpgradeCost(4)).toBe(12); // -> P5
      expect(getPrestigeUpgradeCost(9)).toBe(20); // -> P10
      expect(getPrestigeUpgradeCost(19)).toBe(39); // -> P20
      expect(getPrestigeUpgradeCost(24)).toBe(52); // -> P25
      expect(getPrestigeUpgradeCost(29)).toBe(68); // -> P30
      expect(getPrestigeUpgradeCost(49)).toBe(197); // -> P50
      expect(getPrestigeUpgradeCost(74)).toBe(471); // -> P75
      expect(getPrestigeUpgradeCost(99)).toBe(746); // -> P100
    });

    it("matches the exact approved CUMULATIVE Gems table (informational only — the player only ever pays the single next-level cost above, never this sum at once)", () => {
      expect(cumulativePrestigeCost(1)).toBe(6);
      expect(cumulativePrestigeCost(5)).toBe(46);
      expect(cumulativePrestigeCost(10)).toBe(130);
      expect(cumulativePrestigeCost(20)).toBe(431);
      expect(cumulativePrestigeCost(25)).toBe(665);
      expect(cumulativePrestigeCost(30)).toBe(972);
      expect(cumulativePrestigeCost(50)).toBe(3452);
      expect(cumulativePrestigeCost(75)).toBe(11_949);
      expect(cumulativePrestigeCost(100)).toBe(27_299);
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

  describe("milestone rewards (FASE 6) — sparse, one-time, permanent", () => {
    it("the exact approved reward table exists at P10/P20/P30/P50/P75/P100, nowhere else", () => {
      expect(PRESTIGE_MILESTONE_REWARDS.map((r) => r.level)).toEqual([10, 20, 30, 50, 75, 100]);
      expect(getPrestigeMilestoneReward(10)?.type).toBe("PROFILE_FRAME");
      expect(getPrestigeMilestoneReward(20)?.type).toBe("PROFILE_FRAME");
      expect(getPrestigeMilestoneReward(30)?.type).toBe("TITLE");
      expect(getPrestigeMilestoneReward(50)?.type).toBe("TOWER_SKIN");
      expect(getPrestigeMilestoneReward(75)?.type).toBe("PROFILE_FRAME");
      expect(getPrestigeMilestoneReward(100)?.type).toBe("CASTLE_SKIN");
      expect(getPrestigeMilestoneReward(11)).toBeNull();
      expect(getPrestigeMilestoneReward(0)).toBeNull();
    });

    it("getEarnedPrestigeMilestoneRewards only ever includes rewards at or below the current level, in level order", () => {
      expect(getEarnedPrestigeMilestoneRewards(0)).toEqual([]);
      expect(getEarnedPrestigeMilestoneRewards(9)).toEqual([]);
      expect(getEarnedPrestigeMilestoneRewards(10).map((r) => r.level)).toEqual([10]);
      expect(getEarnedPrestigeMilestoneRewards(49).map((r) => r.level)).toEqual([10, 20, 30]);
      expect(getEarnedPrestigeMilestoneRewards(100).map((r) => r.level)).toEqual([10, 20, 30, 50, 75, 100]);
      expect(getEarnedPrestigeMilestoneRewards(1000).map((r) => r.level)).toEqual([10, 20, 30, 50, 75, 100]);
    });

    it("getNextPrestigeMilestoneReward points at the next unearned milestone, and null once every reward is earned", () => {
      expect(getNextPrestigeMilestoneReward(0)?.level).toBe(10);
      expect(getNextPrestigeMilestoneReward(10)?.level).toBe(20);
      expect(getNextPrestigeMilestoneReward(99)?.level).toBe(100);
      expect(getNextPrestigeMilestoneReward(100)).toBeNull();
      expect(getNextPrestigeMilestoneReward(1000)).toBeNull();
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
