import { describe, expect, it } from "vitest";
import { getItemVisualAsset, ITEM_VISUAL_ASSETS } from "./itemAssets";
import { ITEM_DEFINITIONS } from "./itemDefinitions";

/**
 * IDENTIDADE VISUAL DEFINITIVA — the item -> real-art registry ItemGlyph
 * reads from. No image-generation tool exists in this environment, so no
 * entry is ever faked as "real art" — all 3 amulets' and the MYTHIC item's
 * imageSrc below are real artwork the user supplied directly (matted to
 * transparency, see itemAssets.ts's own comment); the still-empty entries
 * warden_fragment and ancient_core have painted art made in Canva.
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

  it("every item has artwork: the amulets and the MYTHIC item supplied renders, the fragment and the core painted in Canva", () => {
    expect(getItemVisualAsset("mosswood_charm").imageSrc).toBe("/items/amulets/mosswood_charm.png");
    expect(getItemVisualAsset("hollow_sigil").imageSrc).toBe("/items/amulets/hollow_sigil.png");
    expect(getItemVisualAsset("wardens_eye").imageSrc).toBe("/items/amulets/wardens_eye.png");
    expect(getItemVisualAsset("crown_of_the_hollow_king").imageSrc).toBe("/items/artifacts/crown_of_the_hollow_king.png");
    expect(getItemVisualAsset("warden_fragment").imageSrc).toBe("/items/materials/warden_fragment.png");
    expect(getItemVisualAsset("ancient_core").imageSrc).toBe("/items/runes/ancient_core.png");
  });
});
