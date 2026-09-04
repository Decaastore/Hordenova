import { describe, expect, it } from "vitest";
import { CC_DR_MAX_STACKS, getCcDurationMultiplier, getCcResistanceTier } from "./ccResistance";

describe("ccResistance (AUDITORIA E CORREÇÃO GERAL spec sections 24-25)", () => {
  it("getCcResistanceTier maps isBoss/isMainBoss/isElite to the correct tier", () => {
    expect(getCcResistanceTier(false, false, false)).toBe("NORMAL");
    expect(getCcResistanceTier(false, false, true)).toBe("ELITE");
    expect(getCcResistanceTier(true, false, false)).toBe("MINI_BOSS");
    expect(getCcResistanceTier(true, true, false)).toBe("BOSS");
  });

  it("NORMAL tier always returns a 1.0 multiplier, at any stack count — spec section 23's 'Normal -> CC normal'", () => {
    for (const stacks of [0, 1, 2, 3, 10]) {
      expect(getCcDurationMultiplier("NORMAL", stacks)).toBe(1);
    }
  });

  it("every elevated tier's baseline (stack 0) is already reduced from 1.0 — spec section 24's tiered baseline resistance", () => {
    expect(getCcDurationMultiplier("ELITE", 0)).toBeLessThan(1);
    expect(getCcDurationMultiplier("MINI_BOSS", 0)).toBeLessThan(1);
    expect(getCcDurationMultiplier("BOSS", 0)).toBeLessThan(1);
  });

  it("BOSS has the strictest baseline, then MINI_BOSS, then ELITE — a real hierarchy, not arbitrary numbers", () => {
    const bossBase = getCcDurationMultiplier("BOSS", 0);
    const miniBossBase = getCcDurationMultiplier("MINI_BOSS", 0);
    const eliteBase = getCcDurationMultiplier("ELITE", 0);
    expect(bossBase).toBeLessThan(miniBossBase);
    expect(miniBossBase).toBeLessThan(eliteBase);
    expect(eliteBase).toBeLessThan(1);
  });

  it("diminishing returns strictly decrease with each additional stack, for every elevated tier", () => {
    for (const tier of ["ELITE", "MINI_BOSS", "BOSS"] as const) {
      let previous = Infinity;
      for (let stacks = 0; stacks <= CC_DR_MAX_STACKS; stacks++) {
        const mult = getCcDurationMultiplier(tier, stacks);
        expect(mult).toBeLessThanOrEqual(previous);
        previous = mult;
      }
    }
  });

  it("reaching CC_DR_MAX_STACKS forces full temporary immunity (multiplier 0) for every elevated tier — the actual fix for 'boss stuck forever'", () => {
    expect(getCcDurationMultiplier("ELITE", CC_DR_MAX_STACKS)).toBe(0);
    expect(getCcDurationMultiplier("MINI_BOSS", CC_DR_MAX_STACKS)).toBe(0);
    expect(getCcDurationMultiplier("BOSS", CC_DR_MAX_STACKS)).toBe(0);
  });

  it("stacks beyond CC_DR_MAX_STACKS are clamped, never producing a negative or out-of-range multiplier", () => {
    expect(getCcDurationMultiplier("BOSS", CC_DR_MAX_STACKS + 5)).toBe(0);
    expect(getCcDurationMultiplier("BOSS", -1)).toBe(getCcDurationMultiplier("BOSS", 0));
  });
});
