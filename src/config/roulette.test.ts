import { describe, expect, it } from "vitest";
import { ROULETTE_ENTRIES, rollRoulette, totalRouletteWeightPercent, castleHpForReward } from "./roulette";

describe("roulette (Master Implementation spec section 46-48)", () => {
  it("weights sum to exactly 100 — displayed chances must be mathematically real, no hidden pity", () => {
    expect(totalRouletteWeightPercent()).toBeCloseTo(100, 5);
  });

  it("rollRoulette is a pure function of its rng: a fixed sequence always resolves to the expected outcome", () => {
    // Cumulative bands: [0,55) CASTLE_HP_5, [55,80) CASTLE_HP_10, [80,90) CASTLE_HP_20, [90,99) GEM, [99,100) CASTLE_SKIN.
    expect(rollRoulette(() => 0)).toBe("CASTLE_HP_5");
    expect(rollRoulette(() => 0.549)).toBe("CASTLE_HP_5");
    expect(rollRoulette(() => 0.56)).toBe("CASTLE_HP_10");
    expect(rollRoulette(() => 0.81)).toBe("CASTLE_HP_20");
    expect(rollRoulette(() => 0.91)).toBe("GEM");
    expect(rollRoulette(() => 0.995)).toBe("CASTLE_SKIN");
  });

  it("never returns undefined even at the theoretical top edge (roll approaches 1)", () => {
    expect(rollRoulette(() => 0.999999999)).toBe("CASTLE_SKIN");
  });

  it("castleHpForReward maps each HP outcome to its real amount and 0 for non-HP outcomes", () => {
    expect(castleHpForReward("CASTLE_HP_5")).toBe(5);
    expect(castleHpForReward("CASTLE_HP_10")).toBe(10);
    expect(castleHpForReward("CASTLE_HP_20")).toBe(20);
    expect(castleHpForReward("GEM")).toBe(0);
    expect(castleHpForReward("CASTLE_SKIN")).toBe(0);
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
    expect(castleHp5Rate).toBeGreaterThan(0.5);
    expect(castleHp5Rate).toBeLessThan(0.6);
    const skinRate = (counts["CASTLE_SKIN"] ?? 0) / N;
    expect(skinRate).toBeGreaterThan(0.003);
    expect(skinRate).toBeLessThan(0.02);
  });

  it("ROULETTE_ENTRIES exposes the exact same weights the roll uses — nothing display-only, nothing hidden", () => {
    const weights = Object.fromEntries(ROULETTE_ENTRIES.map((e) => [e.type, e.weightPercent]));
    expect(weights).toEqual({ CASTLE_HP_5: 55, CASTLE_HP_10: 25, CASTLE_HP_20: 10, GEM: 9, CASTLE_SKIN: 1 });
  });
});
