import { describe, expect, it } from "vitest";
import { CASTLE_DAMAGE_BASE_PERCENT, computeCastleDamage, getCastleDamageMultiplier } from "./castleDamage";

describe("Castle Damage — BALANCEAMENTO DEFINITIVO spec section 5", () => {
  it("category base percentages follow the exact spec hierarchy: Normal < Mini-Boss < Boss", () => {
    expect(CASTLE_DAMAGE_BASE_PERCENT.NORMAL).toBe(0.1);
    expect(CASTLE_DAMAGE_BASE_PERCENT.MINI_BOSS).toBe(0.25);
    expect(CASTLE_DAMAGE_BASE_PERCENT.BOSS).toBe(0.5);
  });

  it("the multiplier is a smooth, strictly increasing function of wave — no artificial jumps, no plateau", () => {
    const waves = [0, 1, 50, 100, 300, 500, 800, 1000, 1500, 1595, 2000, 3000, 5000, 10_000];
    let previous = -Infinity;
    for (const wave of waves) {
      const m = getCastleDamageMultiplier(wave);
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBeGreaterThan(previous);
      previous = m;
    }
  });

  it("the multiplier never flattens or caps at extreme waves — endgame pressure keeps growing forever", () => {
    const at5000 = getCastleDamageMultiplier(5000);
    const at50000 = getCastleDamageMultiplier(50_000);
    const at1M = getCastleDamageMultiplier(1_000_000);
    expect(at50000).toBeGreaterThan(at5000);
    expect(at1M).toBeGreaterThan(at50000);
  });

  it("wave 1 lands close to the spec's own starting-point reference (~0.25x) — the early game is not unfairly punished", () => {
    expect(getCastleDamageMultiplier(1)).toBeCloseTo(0.25, 1);
  });

  it("wave 1000 lands close to the spec's own starting-point reference (~1.0x)", () => {
    expect(getCastleDamageMultiplier(1000)).toBeCloseTo(1.0, 0);
  });

  it("computeCastleDamage scales proportionally with the Castle's current max HP — a Roulette-won HP bonus makes each hit absorb more, not happen less often", () => {
    const small = computeCastleDamage("NORMAL", 500, 10_000);
    const large = computeCastleDamage("NORMAL", 500, 10_000_000);
    const ratio = large / small;
    expect(ratio).toBeGreaterThan(990);
    expect(ratio).toBeLessThan(1010);
  });

  it("at the identical wave and max HP, Boss > Mini-Boss > Normal, matching the spec's fixed category hierarchy", () => {
    const wave = 800;
    const maxHp = 500;
    const normal = computeCastleDamage("NORMAL", wave, maxHp);
    const miniBoss = computeCastleDamage("MINI_BOSS", wave, maxHp);
    const boss = computeCastleDamage("BOSS", wave, maxHp);
    expect(boss).toBeGreaterThan(miniBoss);
    expect(miniBoss).toBeGreaterThan(normal);
  });

  it("never produces negative, zero-when-it-shouldn't, NaN, or infinite damage across the full supported wave range", () => {
    const waves = [0, 1, 100, 1595, 5000, 100_000, 1_000_000];
    for (const wave of waves) {
      for (const category of ["NORMAL", "MINI_BOSS", "BOSS"] as const) {
        const damage = computeCastleDamage(category, wave, 100);
        expect(Number.isFinite(damage)).toBe(true);
        expect(damage).toBeGreaterThan(0);
      }
    }
  });
});
