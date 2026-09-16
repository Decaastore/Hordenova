import { describe, expect, it, vi } from "vitest";
import { tickCombat } from "./CombatSystem";
import { createTowerInstance } from "@/entities/Tower";
import { createEnemyInstance } from "@/entities/Enemy";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";

/**
 * FASE 6 — REAL CombatSystem validation of the Mastery identity axis
 * (config/towerMastery.ts's applyMasteryToSpecial), superseding the earlier
 * analytical proxy model (a standalone Node script, not real engine code)
 * used to derive the approved per-tower rates. This runs the ACTUAL
 * tickCombat pipeline — the same function GameEngine's own tick loop calls
 * — at Mastery levels 0/20/30/60/100/200/400, exactly the checkpoints the
 * user's directive requires.
 *
 * Scope note (honest, not hidden): this measures DIRECT-HIT damage only
 * (the `damageEvents` tickCombat returns). Inferno's burn DOT is applied as
 * a status effect here (see applyBurn calls in CombatSystem.ts) but ticked
 * down elsewhere in GameEngine's own loop, outside tickCombat — so Inferno's
 * measured growth here is a lower bound on its real total damage growth,
 * not the whole picture. The raw special-stat deltas themselves (radius,
 * burnDamagePerSecond, slowPercent, freezeChance, critChance,
 * critMultiplier, chainFalloff, armorPenetration) are validated directly,
 * with exact formulas, in config/towerMastery.test.ts.
 */

function seededRandom(): () => number {
  let seed = 1;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const MASTERY_LEVELS = [0, 20, 30, 60, 100, 200, 400];
const TOWER_LEVEL = 15; // representative mid-game level, matches the earlier calibration's own baseline
const SIMULATED_MS = 20_000;
const TICK_MS = 100;

function measureTotalDamage(type: TowerType, masteryLevel: number): number {
  vi.spyOn(Math, "random").mockImplementation(seededRandom());
  try {
    const tower = createTowerInstance("slot-1", type, { x: 0, y: 0 }, TOWER_LEVEL, null, 0, null, masteryLevel, true);
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.position = { x: 0, y: 0 }; // guaranteed in range
    enemy.hp = 1e9;
    enemy.maxHp = 1e9;
    enemy.damageReduction = 0;

    let total = 0;
    let elapsed = 0;
    while (elapsed < SIMULATED_MS) {
      const result = tickCombat([tower], [enemy], TICK_MS);
      for (const event of result.damageEvents) total += event.amount;
      elapsed += TICK_MS;
    }
    return total;
  } finally {
    vi.restoreAllMocks();
  }
}

describe("Mastery identity axis — REAL CombatSystem validation (FASE 6)", () => {
  for (const type of TOWER_TYPES) {
    it(`${type}: total direct-hit damage over a fixed window is finite and strictly increases with Mastery level (0/20/30/60/100/200/400)`, () => {
      let previous = -Infinity;
      const measurements: number[] = [];
      for (const level of MASTERY_LEVELS) {
        const total = measureTotalDamage(type, level);
        expect(Number.isFinite(total)).toBe(true);
        expect(total).toBeGreaterThan(0);
        expect(total).toBeGreaterThan(previous);
        previous = total;
        measurements.push(total);
      }

      // No significant power creep: the goal is changing HOW a tower gains
      // power (a per-tower identity axis), not increasing TOTAL power. A
      // generous but real regression guard — Mastery 400 is a very deep
      // investment (masteryEffectScale(400) ~ 130), so some real growth is
      // expected and correct; this only catches an accidental explosion.
      const growthRatio = measurements[measurements.length - 1]! / measurements[0]!;
      expect(growthRatio).toBeLessThan(20);
    });
  }
});
