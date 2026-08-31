import { describe, expect, it } from "vitest";
import { tickCombat } from "./CombatSystem";
import { createTowerInstance } from "@/entities/Tower";
import { createEnemyInstance, isEnemyDead } from "@/entities/Enemy";
import { TOWER_TYPES } from "@/config/towerStats";

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
});
