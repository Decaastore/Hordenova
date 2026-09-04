import { describe, expect, it } from "vitest";
import { ROULETTE_ENTRIES, rollRoulette, totalRouletteWeightPercent, castleHpForReward } from "./roulette";

describe("roulette (Master Implementation spec section 46-48 + AUDITORIA E CORREÇÃO GERAL section 4-5)", () => {
  it("weights sum to exactly 100 — displayed chances must be mathematically real, no hidden pity, even after recalibrating for NOTHING", () => {
    expect(totalRouletteWeightPercent()).toBeCloseTo(100, 5);
  });

  it("rollRoulette is a pure function of its rng: a fixed sequence always resolves to the expected outcome", () => {
    // Cumulative bands: [0,45) CASTLE_HP_5, [45,67) CASTLE_HP_10, [67,76) CASTLE_HP_20, [76,84) GEM, [84,85) CASTLE_SKIN, [85,100) NOTHING.
    expect(rollRoulette(() => 0)).toBe("CASTLE_HP_5");
    expect(rollRoulette(() => 0.449)).toBe("CASTLE_HP_5");
    expect(rollRoulette(() => 0.46)).toBe("CASTLE_HP_10");
    expect(rollRoulette(() => 0.68)).toBe("CASTLE_HP_20");
    expect(rollRoulette(() => 0.77)).toBe("GEM");
    expect(rollRoulette(() => 0.845)).toBe("CASTLE_SKIN");
    expect(rollRoulette(() => 0.9)).toBe("NOTHING");
  });

  it("never returns undefined even at the theoretical top edge (roll approaches 1)", () => {
    expect(rollRoulette(() => 0.999999999)).toBe("NOTHING");
  });

  it("castleHpForReward maps each HP outcome to its real amount and 0 for every non-HP outcome, NOTHING included", () => {
    expect(castleHpForReward("CASTLE_HP_5")).toBe(5);
    expect(castleHpForReward("CASTLE_HP_10")).toBe(10);
    expect(castleHpForReward("CASTLE_HP_20")).toBe(20);
    expect(castleHpForReward("GEM")).toBe(0);
    expect(castleHpForReward("CASTLE_SKIN")).toBe(0);
    expect(castleHpForReward("NOTHING")).toBe(0);
  });

  it("over many rolls, the empirical distribution roughly matches the declared weights (statistical sanity, not exact)", () => {
    const counts: Record<string, number> = {};
    const N = 20_000;
    let seed = 7;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < N; i++) {
      const outcome = rollRoulette(rng);
      counts[outcome] = (counts[outcome] ?? 0) + 1;
    }
    const castleHp5Rate = (counts["CASTLE_HP_5"] ?? 0) / N;
    expect(castleHp5Rate).toBeGreaterThan(0.4);
    expect(castleHp5Rate).toBeLessThan(0.5);
    const nothingRate = (counts["NOTHING"] ?? 0) / N;
    expect(nothingRate).toBeGreaterThan(0.1);
    expect(nothingRate).toBeLessThan(0.2);
    const skinRate = (counts["CASTLE_SKIN"] ?? 0) / N;
    expect(skinRate).toBeGreaterThan(0.003);
    expect(skinRate).toBeLessThan(0.02);
  });

  it("ROULETTE_ENTRIES exposes the exact same weights the roll uses — nothing display-only, nothing hidden", () => {
    const weights = Object.fromEntries(ROULETTE_ENTRIES.map((e) => [e.type, e.weightPercent]));
    expect(weights).toEqual({ CASTLE_HP_5: 45, CASTLE_HP_10: 22, CASTLE_HP_20: 9, GEM: 8, CASTLE_SKIN: 1, NOTHING: 15 });
  });
});
