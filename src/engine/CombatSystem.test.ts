import { afterEach, describe, expect, it, vi } from "vitest";
import { tickCombat } from "./CombatSystem";
import { createTowerInstance } from "@/entities/Tower";
import { createEnemyInstance, isEnemyDead } from "@/entities/Enemy";
import { getTowerLevelStats, TOWER_TYPES } from "@/config/towerStats";

const TICK_MS = 50;
const MAX_SIMULATED_MS = 15_000; // a whole Crawler must die well within this on Wave 1

describe("CombatSystem", () => {
  it.each(TOWER_TYPES)(
    "a Level 1 %s can kill a Wave 1 Crawler standing in range",
    (type) => {
      const tower = createTowerInstance("slot-test", type, { x: 0, y: 0 });
      const enemy = createEnemyInstance("CRAWLER", 1);
      enemy.position = { x: 20, y: 0 }; // well within every tower's Level 1 range
      enemy.distanceTraveled = 0;

      let elapsed = 0;
      while (!isEnemyDead(enemy) && elapsed < MAX_SIMULATED_MS) {
        tickCombat([tower], [enemy], TICK_MS);
        elapsed += TICK_MS;
      }

      expect(isEnemyDead(enemy)).toBe(true);
    },
  );

  it("a tower with no enemy in range deals no damage", () => {
    const tower = createTowerInstance("slot-test", "IRONWOOD", { x: 0, y: 0 });
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.position = { x: 9999, y: 9999 };

    tickCombat([tower], [enemy], 5000);

    expect(enemy.hp).toBe(enemy.maxHp);
  });

  it("Frostborn applies a slow effect on hit", () => {
    const tower = createTowerInstance("slot-test", "FROSTBORN", { x: 0, y: 0 });
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.position = { x: 20, y: 0 };

    tickCombat([tower], [enemy], 1100); // one attack cycle at ~1.1 atk/s

    expect(enemy.slow).not.toBeNull();
  });

  it("Inferno damages every enemy within its AoE radius, not just the primary target", () => {
    const tower = createTowerInstance("slot-test", "INFERNO", { x: 0, y: 0 });
    const primary = createEnemyInstance("CRAWLER", 1);
    primary.position = { x: 20, y: 0 };
    const bystander = createEnemyInstance("CRAWLER", 1);
    bystander.position = { x: 30, y: 0 }; // within Inferno's AoE radius of the primary target

    tickCombat([tower], [primary, bystander], 1000);

    expect(primary.hp).toBeLessThan(primary.maxHp);
    expect(bystander.hp).toBeLessThan(bystander.maxHp);
  });

  describe("role differentiation (Core Gameplay polish)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("Stormcaller's Arcane Surge (armor penetration, unlocked at level 10) lets a higher fraction of raw damage through an armored target than Level 1", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99); // no crit/other RNG to worry about on this tower

      const lowLevel = createTowerInstance("slot-test", "STORMCALLER", { x: 0, y: 0 }, 1);
      const highLevel = createTowerInstance("slot-test", "STORMCALLER", { x: 0, y: 0 }, 20);
      const lowTarget = createEnemyInstance("SHIELDBEARER", 1);
      const highTarget = createEnemyInstance("SHIELDBEARER", 1);
      lowTarget.position = { x: 20, y: 0 };
      highTarget.position = { x: 20, y: 0 };

      tickCombat([lowLevel], [lowTarget], 50);
      tickCombat([highLevel], [highTarget], 50);

      // Normalize by each level's raw damage so the comparison isolates
      // armor penetration instead of just "higher level hits harder".
      const lowRetainedFraction = (lowTarget.maxHp - lowTarget.hp) / getTowerLevelStats("STORMCALLER", 1).damage;
      const highRetainedFraction = (highTarget.maxHp - highTarget.hp) / getTowerLevelStats("STORMCALLER", 20).damage;

      expect(lowRetainedFraction).toBeCloseTo(1 - 0.35, 2); // Level 1: zero penetration, Shieldbearer's flat 35% reduction applies fully
      expect(highRetainedFraction).toBeGreaterThan(lowRetainedFraction);
    });

    it("Frostborn's Deep Freeze (unlocked at level 10) can fully stop a target, unlike Level 1's partial slow", () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // guarantees the freeze-chance roll succeeds

      const tower = createTowerInstance("slot-test", "FROSTBORN", { x: 0, y: 0 }, 10);
      const target = createEnemyInstance("CRAWLER", 1);
      target.position = { x: 20, y: 0 };

      tickCombat([tower], [target], 50);

      expect(target.slow).not.toBeNull();
      expect(target.slow!.percent).toBe(1);
    });

    it("Frostborn below level 10 never freezes, only ever partially slows", () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // would trigger freeze if it were possible

      const tower = createTowerInstance("slot-test", "FROSTBORN", { x: 0, y: 0 }, 1);
      const target = createEnemyInstance("CRAWLER", 1);
      target.position = { x: 20, y: 0 };

      tickCombat([tower], [target], 50);

      expect(target.slow).not.toBeNull();
      expect(target.slow!.percent).toBeLessThan(1);
    });

    it("Inferno's Wildfire (burn stacking, unlocked at level 10) deals more sustained damage than a Level 1 Inferno's single burn", () => {
      const lowLevel = createTowerInstance("slot-test", "INFERNO", { x: 0, y: 0 }, 1);
      const highLevel = createTowerInstance("slot-test", "INFERNO", { x: 0, y: 0 }, 10);
      const lowTarget = createEnemyInstance("CRAWLER", 1);
      const highTarget = createEnemyInstance("CRAWLER", 1);
      lowTarget.position = { x: 20, y: 0 };
      highTarget.position = { x: 20, y: 0 };

      // Two attack cycles so a second burn application can stack on the high-level tower.
      tickCombat([lowLevel], [lowTarget], 1200);
      tickCombat([lowLevel], [lowTarget], 1200);
      tickCombat([highLevel], [highTarget], 1200);
      tickCombat([highLevel], [highTarget], 1200);

      expect(highTarget.burn!.stacks).toBeGreaterThan(1);
      expect(highTarget.burn!.damagePerSecond).toBeGreaterThan(lowTarget.burn!.damagePerSecond);
    });

    it("Ironwood's Giant Slayer (unlocked at level 15) deals bonus damage specifically against bosses", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99); // never crit, isolate the boss-damage multiplier

      const tower = createTowerInstance("slot-test", "IRONWOOD", { x: 0, y: 0 }, 15);
      const bossTarget = createEnemyInstance("BRUTE", 1);
      const regularTarget = createEnemyInstance("BRUTE", 1);
      bossTarget.position = { x: 20, y: 0 };
      regularTarget.position = { x: 20, y: 0 };
      bossTarget.boss = {
        bossId: "test",
        name: "Test Boss",
        isMainBoss: true,
        ability: "NONE",
        abilityIntervalMs: 1000,
        baseDamageReduction: 0,
        shieldUntilMs: null,
        nextAbilityAtMs: 0,
        enraged: false,
      };

      tickCombat([tower], [bossTarget], 50);
      // Separate tower instance for the second hit — reusing one tower
      // across two tickCombat calls this close together would leave it on
      // cooldown for the second shot, which isn't what this test is about.
      const towerForRegular = createTowerInstance("slot-test-2", "IRONWOOD", { x: 0, y: 0 }, 15);
      tickCombat([towerForRegular], [regularTarget], 50);

      const bossDamageTaken = bossTarget.maxHp - bossTarget.hp;
      const regularDamageTaken = regularTarget.maxHp - regularTarget.hp;
      expect(bossDamageTaken).toBeGreaterThan(regularDamageTaken);
    });

    it("Ironwood below level 15 deals identical damage to bosses and regular enemies", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);

      const tower = createTowerInstance("slot-test", "IRONWOOD", { x: 0, y: 0 }, 5);
      const bossTarget = createEnemyInstance("BRUTE", 1);
      const regularTarget = createEnemyInstance("BRUTE", 1);
      bossTarget.position = { x: 20, y: 0 };
      regularTarget.position = { x: 20, y: 0 };
      bossTarget.boss = {
        bossId: "test",
        name: "Test Boss",
        isMainBoss: true,
        ability: "NONE",
        abilityIntervalMs: 1000,
        baseDamageReduction: 0,
        shieldUntilMs: null,
        nextAbilityAtMs: 0,
        enraged: false,
      };

      tickCombat([tower], [bossTarget], 50);
      const towerForRegular = createTowerInstance("slot-test-2", "IRONWOOD", { x: 0, y: 0 }, 5);
      tickCombat([towerForRegular], [regularTarget], 50);

      expect(bossTarget.hp).toBe(regularTarget.hp);
    });
  });
});
