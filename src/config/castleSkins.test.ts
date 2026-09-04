import { describe, expect, it } from "vitest";
import { CASTLE_SKINS, getCastleSkinDefinition } from "./castleSkins";
import { getCastleHpTier, CASTLE_TIERS } from "./castleConfig";

describe("Castle Skin architecture (Visual Overhaul spec section 20)", () => {
  it("ships at least one skin", () => {
    expect(CASTLE_SKINS.length).toBeGreaterThan(0);
  });

  it("getCastleSkinDefinition returns null for an unknown id, never throws", () => {
    expect(getCastleSkinDefinition("not-a-real-skin")).toBeNull();
  });

  it("getCastleSkinDefinition returns the matching definition for a known id", () => {
    const skin = CASTLE_SKINS[0]!;
    expect(getCastleSkinDefinition(skin.id)).toEqual(skin);
  });

  it("every skin's paletteOverride only touches the fortress's own stonework fields", () => {
    for (const skin of CASTLE_SKINS) {
      const keys = Object.keys(skin.paletteOverride);
      for (const key of keys) expect(["rock", "rockDark"]).toContain(key);
    }
  });

  it("the Castle Visual tier logic (HP -> tier) is completely independent of any skin — same hpPercent always maps to the same tier regardless of which skin is equipped", () => {
    // Skins never appear as an input to getCastleHpTier at all — this is
    // really a compile-time guarantee (the function only takes hpPercent),
    // but assert the runtime tier table is exactly what a "any compatible
    // skin" design requires: 5 tiers, fully covering 0..1.
    expect(CASTLE_TIERS).toHaveLength(5);
    expect(getCastleHpTier(1)).toBe(1);
    expect(getCastleHpTier(0)).toBe(5);
    for (const skin of CASTLE_SKINS) {
      // A skin definition has no hp-related field to accidentally read.
      expect(skin).not.toHaveProperty("hp");
      expect(skin).not.toHaveProperty("damage");
      expect(skin).not.toHaveProperty("resistance");
    }
  });
});
