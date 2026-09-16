import { describe, expect, it } from "vitest";
import { getItemVisualAsset, ITEM_VISUAL_ASSETS } from "./itemAssets";
import { ITEM_DEFINITIONS } from "./itemDefinitions";

/**
 * IDENTIDADE VISUAL DEFINITIVA — the item -> real-art registry ItemGlyph
 * reads from. No image-generation tool exists in this environment, so no
 * entry is ever faked as "real art" — all 3 amulets' imageSrc below are
 * real artwork the user supplied directly (matted to transparency, see
 * itemAssets.ts's own comment); the still-empty entries are honestly
 * empty, not placeholders. See public/items/artifacts/README.md for the
 * exact brief the MYTHIC item still needs.
 */
describe("itemAssets — ITEM_VISUAL_ASSETS registry", () => {
  it("has a registry entry for every real item in the catalog", () => {
    for (const def of Object.values(ITEM_DEFINITIONS)) {
      expect(ITEM_VISUAL_ASSETS).toHaveProperty(def.visualAssetId);
    }
  });

  it("getItemVisualAsset returns an empty object (not undefined) for an unregistered id", () => {
    expect(getItemVisualAsset("does-not-exist")).toEqual({});
  });

  it("getItemVisualAsset returns the exact registered entry for a known id", () => {
    expect(getItemVisualAsset("mosswood_charm")).toBe(ITEM_VISUAL_ASSETS.mosswood_charm);
  });

  it("all 3 amulets have real supplied artwork; the MYTHIC item is still honestly empty (no image-generation tool available for it)", () => {
    expect(getItemVisualAsset("mosswood_charm").imageSrc).toBe("/items/amulets/mosswood_charm.png");
    expect(getItemVisualAsset("hollow_sigil").imageSrc).toBe("/items/amulets/hollow_sigil.png");
    expect(getItemVisualAsset("wardens_eye").imageSrc).toBe("/items/amulets/wardens_eye.png");
    expect(getItemVisualAsset("crown_of_the_hollow_king").imageSrc).toBeUndefined();
  });
});
