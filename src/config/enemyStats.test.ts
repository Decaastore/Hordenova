import { describe, expect, it } from "vitest";
import { getScaledEnemyStats, ENEMY_TYPES, hpMultiplierForWaveIndex } from "./enemyStats";

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

  it("HP is monotonically non-decreasing as the wave number climbs (difficulty never regresses), at any wave a save could reach", () => {
    let previousHp = 0;
    for (const wave of EXTREME_CHECKPOINTS) {
      const hp = getScaledEnemyStats("BRUTE", wave).hp;
      expect(hp).toBeGreaterThanOrEqual(previousHp);
      previousHp = hp;
    }
  });

  it("HP keeps growing at extreme scale (the late-game power-law term never flattens into a plateau)", () => {
    const at1M = getScaledEnemyStats("BRUTE", 1_000_000).hp;
    const at3M = getScaledEnemyStats("BRUTE", 3_000_000).hp;
    expect(at3M).toBeGreaterThan(at1M);
  });

  /**
   * INFINITE BALANCE OVERHAUL — the OLD formula this test used to lock in
   * (linear-growth x exponential-compound, hard-capped at a wave-index
   * ceiling of 20,000 purely to avoid Infinity) is gone: it had no way to
   * decelerate except by literally freezing the curve, which is exactly
   * what the user's spec forbade ("nunca congelar a curva"). Replaced by
   * `hpMultiplierForWaveIndex` — an early-surge x late-power-law curve that
   * needs no hard ceiling at all (see enemyStats.ts's own doc comment for
   * the full derivation). This test now locks THAT formula in exactly,
   * against getScaledEnemyStats's real output, so a future change can't
   * silently drift the two apart.
   */
  it("getScaledEnemyStats.hp matches hpMultiplierForWaveIndex EXACTLY, at both realistic and extreme wave numbers (regression proof)", () => {
    for (const wave of [1, 2, 10, 30, 100, 160, 250, 460, 1000, 5000, 19999, 100_000, 10_000_000]) {
      const waveIndex = wave - 1;
      const expectedHp = Math.round(40 * hpMultiplierForWaveIndex(waveIndex)); // CRAWLER baseHp = 40
      expect(getScaledEnemyStats("CRAWLER", wave).hp).toBe(expectedHp);
    }
  });

  it("hpMultiplierForWaveIndex has no hard-coded ceiling wave — it is a single continuous formula, never a frozen/clamped plateau, at any index a save could ever reach", () => {
    const veryLate = hpMultiplierForWaveIndex(50_000_000);
    const evenLater = hpMultiplierForWaveIndex(100_000_000);
    expect(Number.isFinite(veryLate)).toBe(true);
    expect(Number.isFinite(evenLater)).toBe(true);
    expect(evenLater).toBeGreaterThan(veryLate); // still climbing — never plateaus
  });
});

describe("enemyStats — multi-dimensional endgame scaling (Master Implementation Pass spec section 9-10)", () => {
  it("armor and speed scaling never touch waves before 300 (early/mid-game unaffected)", () => {
    for (const wave of [1, 50, 130, 200, 300]) {
      const stats = getScaledEnemyStats("CRAWLER", wave);
      expect(stats.damageReduction).toBe(0); // CRAWLER's base damageReduction is 0
      expect(stats.speed).toBe(60); // CRAWLER's base speed, untouched
    }
  });

  it("armor and speed both climb past wave 300, and armor never removes the base archetype's own resistance identity", () => {
    const early = getScaledEnemyStats("SHIELDBEARER", 300);
    const late = getScaledEnemyStats("SHIELDBEARER", 2000);
    expect(late.damageReduction).toBeGreaterThan(early.damageReduction);
    expect(late.speed).toBeGreaterThan(early.speed);
  });

  it("combined damage reduction never exceeds the 90% cap (never literal invulnerability), even at extreme waves", () => {
    for (const wave of [10_000, 100_000, 1_000_000, 10_000_000]) {
      // IRONCLAD already has the highest base damageReduction (0.55) — the worst case.
      const stats = getScaledEnemyStats("IRONCLAD", wave);
      expect(stats.damageReduction).toBeLessThanOrEqual(0.9);
      expect(Number.isFinite(stats.damageReduction)).toBe(true);
    }
  });

  it("speed multiplier stays bounded (never more than +60% from this dimension) at extreme waves", () => {
    const baseSpeed = 60; // CRAWLER
    for (const wave of [10_000, 100_000, 1_000_000, 10_000_000]) {
      const stats = getScaledEnemyStats("CRAWLER", wave);
      expect(stats.speed).toBeLessThanOrEqual(baseSpeed * 1.6 + 1e-9);
      expect(Number.isFinite(stats.speed)).toBe(true);
    }
  });
});
