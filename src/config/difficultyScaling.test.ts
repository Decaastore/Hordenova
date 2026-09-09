import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_MULTIPLIER_MAX,
  DIFFICULTY_MULTIPLIER_MIN,
  getIndividualDifficultyMultiplier,
  getReferenceCombatPower,
} from "./difficultyScaling";

/**
 * DIFICULDADE INDIVIDUAL POR JOGADOR spec section 2 — the bounded secondary
 * adjustment. Must NEVER: equal player DPS directly, grow unbounded with
 * player power, or make Onda 1 trivial for a strong account.
 */
describe("config/difficultyScaling.ts", () => {
  it("an on-pace account (ratio 1.0) gets exactly the neutral multiplier — no adjustment at all", () => {
    expect(getIndividualDifficultyMultiplier(100, 100)).toBe(1);
  });

  it("a far-ahead account is capped at DIFFICULTY_MULTIPLIER_MAX — never scales infinitely with player power", () => {
    expect(getIndividualDifficultyMultiplier(1_000_000, 100)).toBe(DIFFICULTY_MULTIPLIER_MAX);
    expect(getIndividualDifficultyMultiplier(1_000_000_000, 100)).toBe(DIFFICULTY_MULTIPLIER_MAX);
  });

  it("a far-behind (or zero) account is floored at DIFFICULTY_MULTIPLIER_MIN — never becomes literally free/zero difficulty", () => {
    expect(getIndividualDifficultyMultiplier(0, 100)).toBeCloseTo(DIFFICULTY_MULTIPLIER_MIN, 10);
    expect(getIndividualDifficultyMultiplier(1, 100)).toBeGreaterThanOrEqual(DIFFICULTY_MULTIPLIER_MIN);
  });

  it("a moderately-ahead account gets a moderate, bounded bump — not enemy HP = player DPS", () => {
    const multiplier = getIndividualDifficultyMultiplier(150, 100); // 50% ahead of reference
    expect(multiplier).toBeGreaterThan(1);
    expect(multiplier).toBeLessThan(DIFFICULTY_MULTIPLIER_MAX);
  });

  it("an invalid (zero/negative) reference never divides by zero — returns the neutral multiplier", () => {
    expect(getIndividualDifficultyMultiplier(500, 0)).toBe(1);
    expect(getIndividualDifficultyMultiplier(500, -10)).toBe(1);
  });

  it("the multiplier is a monotonically increasing function of the ratio, within its bounds", () => {
    const low = getIndividualDifficultyMultiplier(80, 100);
    const mid = getIndividualDifficultyMultiplier(100, 100);
    const high = getIndividualDifficultyMultiplier(120, 100);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it("getReferenceCombatPower grows with wave and matches the exact frozen Gold-per-wave growth rate (0.03/wave)", () => {
    const baseline = 10;
    expect(getReferenceCombatPower(baseline, 1)).toBe(10);
    expect(getReferenceCombatPower(baseline, 101)).toBeCloseTo(10 * (1 + 100 * 0.03), 6);
  });

  it("getReferenceCombatPower never produces a negative or NaN value for any finite wave", () => {
    expect(getReferenceCombatPower(10, 0)).toBeGreaterThan(0);
    expect(getReferenceCombatPower(10, 1_000_000)).toBeGreaterThan(0);
    expect(Number.isFinite(getReferenceCombatPower(10, 1_000_000))).toBe(true);
  });
});
