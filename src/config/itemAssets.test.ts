import { describe, expect, it } from "vitest";
import { getItemVisualAsset, ITEM_VISUAL_ASSETS } from "./itemAssets";
import { ITEM_DEFINITIONS } from "./itemDefinitions";

/**
 * IDENTIDADE VISUAL DEFINITIVA — the item -> real-art registry ItemGlyph
 * reads from. No real image-generation tool exists in this environment
 * (confirmed before building this feature), so every entry below is
 * honestly empty rather than faking a placeholder as "real art" — see this
 * file's own header and the feature's delivery report for the exact art
 * brief still needed per item.
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

  it("no entry fakes a real image today — none of the 3 amulets has an imageSrc yet (no image-generation tool available)", () => {
    for (const id of ["mosswood_charm", "hollow_sigil", "wardens_eye"]) {
      expect(getItemVisualAsset(id).imageSrc).toBeUndefined();
    }
  });
});
