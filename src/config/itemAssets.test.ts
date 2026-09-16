import { describe, expect, it } from "vitest";
import { getItemVisualAsset, ITEM_VISUAL_ASSETS } from "./itemAssets";
import { ITEM_DEFINITIONS } from "./itemDefinitions";

/**
 * IDENTIDADE VISUAL DEFINITIVA — the item -> real-art registry ItemGlyph
 * reads from. No image-generation tool exists in this environment, so no
 * entry is ever faked as "real art" — mosswood_charm's imageSrc below is
 * real artwork the user supplied directly (matted to transparency, see
 * itemAssets.ts's own comment); the still-empty entries are honestly
 * empty, not placeholders. See public/items/amulets/README.md for the
 * exact brief the remaining amulets need.
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

  it("mosswood_charm has real supplied artwork; hollow_sigil and wardens_eye are still honestly empty (no image-generation tool available for those)", () => {
    expect(getItemVisualAsset("mosswood_charm").imageSrc).toBe("/items/amulets/mosswood_charm.png");
    expect(getItemVisualAsset("hollow_sigil").imageSrc).toBeUndefined();
    expect(getItemVisualAsset("wardens_eye").imageSrc).toBeUndefined();
  });
});
