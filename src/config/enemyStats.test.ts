import { describe, expect, it } from "vitest";
import { getScaledEnemyStats, ENEMY_TYPES } from "./enemyStats";

/**
 * Master Implementation Pass spec section 47/52 — numerical safety at
 * extreme wave numbers (the game must keep functioning out to wave
 * 3,000,000+, never MAX_PHASE, never Infinity/NaN enemy HP).
 */
describe("enemyStats — numerical safety at extreme wave numbers", () => {
  const EXTREME_CHECKPOINTS = [1, 100, 1_000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 3_000_000, 10_000_000];

  it("every scaled stat stays finite (never Infinity/NaN) for every enemy type, out to wave 10,000,000", () => {
    for (const type of ENEMY_TYPES) {
      for (const wave of EXTREME_CHECKPOINTS) {
        const stats = getScaledEnemyStats(type, wave);
        expect(Number.isFinite(stats.hp)).toBe(true);
        expect(Number.isFinite(stats.goldReward)).toBe(true);
        expect(Number.isFinite(stats.regenPerSecond)).toBe(true);
        expect(stats.hp).toBeGreaterThan(0);
      }
    }
  });

  it("HP is monotonically non-decreasing as the wave number climbs (difficulty never regresses), even past the compounding cap", () => {
    let previousHp = 0;
    for (const wave of EXTREME_CHECKPOINTS) {
      const hp = getScaledEnemyStats("BRUTE", wave).hp;
      expect(hp).toBeGreaterThanOrEqual(previousHp);
      previousHp = hp;
    }
  });

  it("HP keeps growing well past the compounding cap (linear term alone must still raise difficulty at extreme scale)", () => {
    const at1M = getScaledEnemyStats("BRUTE", 1_000_000).hp;
    const at3M = getScaledEnemyStats("BRUTE", 3_000_000).hp;
    expect(at3M).toBeGreaterThan(at1M);
  });

  it("matches the pre-safety-cap formula EXACTLY for every realistic wave a save could actually reach (regression proof — this fix changes only extreme-scale safety, never real gameplay balance)", () => {
    // Reproduces the OLD unbounded formula directly for comparison — waveIndex
    // here never approaches the 20,000 cap, so both formulas must agree
    // bit-for-bit at the waves anyone has ever actually played to
    // (the documented balance "wall" sits around wave 450-460).
    const HP_GROWTH_PER_WAVE = 0.06;
    const HP_COMPOUND_PER_WAVE = 0.006;
    for (const wave of [1, 2, 10, 30, 100, 160, 250, 460, 1000, 5000, 19999]) {
      const waveIndex = wave - 1;
      const oldMultiplier = (1 + waveIndex * HP_GROWTH_PER_WAVE) * Math.pow(1 + HP_COMPOUND_PER_WAVE, waveIndex);
      const expectedHp = Math.round(40 * oldMultiplier); // CRAWLER baseHp = 40
      expect(getScaledEnemyStats("CRAWLER", wave).hp).toBe(expectedHp);
    }
  });
});
