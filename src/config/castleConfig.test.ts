import { describe, expect, it } from "vitest";
import { CASTLE_TIERS, getCastleHpTier, getCastleTierDefinition } from "./castleConfig";

describe("Castle Visual State (Progression 2.0 spec section 12-15)", () => {
  it("maps hpPercent to the 5 documented tiers", () => {
    expect(getCastleHpTier(1)).toBe(1);
    expect(getCastleHpTier(0.9)).toBe(1);
    expect(getCastleHpTier(0.75)).toBe(2);
    expect(getCastleHpTier(0.6)).toBe(2);
    expect(getCastleHpTier(0.5)).toBe(3);
    expect(getCastleHpTier(0.3)).toBe(3);
    expect(getCastleHpTier(0.25)).toBe(4);
    expect(getCastleHpTier(0.05)).toBe(4);
    expect(getCastleHpTier(0)).toBe(5);
  });

  it("clamps out-of-range input instead of throwing", () => {
    expect(getCastleHpTier(-5)).toBe(5);
    expect(getCastleHpTier(50)).toBe(1);
  });

  it("every tier 1-5 has a definition", () => {
    for (let tier = 1; tier <= 5; tier++) {
      const def = getCastleTierDefinition(tier as 1 | 2 | 3 | 4 | 5);
      expect(def.tier).toBe(tier);
    }
    expect(CASTLE_TIERS).toHaveLength(5);
  });
});
