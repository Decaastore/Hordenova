/**
 * IDENTIDADE VISUAL DEFINITIVA — the single registry mapping an item's
 * `visualAssetId` (declared on its ItemDefinition, see itemDefinitions.ts)
 * to its real artwork. `ui/ItemGlyph.tsx` is the ONLY component that reads
 * this file, and every screen that shows an item's picture — Inventory,
 * hover tooltip, item details modal, boss-drop reward banner, tower
 * equipment slots/picker, and every Marketplace surface (cards, detail
 * modal, create-listing flow, My Market) — renders through ItemGlyph. That
 * means dropping a real image in here is the ONE change ever needed to
 * make it appear correctly everywhere at once; no per-screen wiring, no
 * hardcoded paths anywhere else in the app.
 *
 * WHAT `imageSrc` MUST BE: a real, standalone picture of the item alone —
 * transparent background, no rarity border/glow/background baked in, no
 * text, no letters, no numbers, no watermark. Rarity presentation (border,
 * glow, background wash, tooltip color) is entirely the UI's job, applied
 * by the wrapper `ItemGlyph` already draws around whatever it renders —
 * the same wrapper for a real image as for the fallback icon below. This
 * keeps one asset usable at every rarity treatment without ever burning a
 * color into the art.
 *
 * FILE CONVENTION: static image files (once supplied) belong in
 * `public/items/<category-lowercase>/<visualAssetId>.<ext>` — e.g.
 * `public/items/amulets/mosswood_charm.png` served at
 * `/items/amulets/mosswood_charm.png`. This mirrors the one binary-asset
 * convention this project already has (`public/audio/...`) and needs zero
 * bundler configuration: Vite serves anything under `public/` verbatim at
 * the site root.
 *
 * AN ENTRY WITH NO `imageSrc` IS NOT A BUG. It means real art hasn't been
 * supplied yet for that item — this repo has no image-generation tool
 * available, so no entry below is ever faked with a placeholder or stock
 * image standing in as "real art". `ItemGlyph` falls back to a generic,
 * hand-drawn category icon in that case (see icons.tsx), so nothing ever
 * renders broken or blank — the fallback is a graceful placeholder, never
 * the intended final look. See this feature's delivery report for the
 * exact art brief per item still needed.
 *
 * NEW ITEM RULE: every future item (weapon, armor, boss trophy, resource,
 * rare relic, whatever comes next) declares its own `visualAssetId` on its
 * ItemDefinition and gets its own entry here — never a shared
 * "category -> one generic icon" mapping as the real design. The generic
 * icon only ever exists as ItemGlyph's own fallback for an item whose real
 * art hasn't shipped yet.
 */
export interface ItemVisualAsset {
  /** Public path to the item's real artwork. Undefined = not supplied yet; ItemGlyph falls back to a generic category icon. */
  imageSrc?: string;
}

export const ITEM_VISUAL_ASSETS: Record<string, ItemVisualAsset> = {
  warden_fragment: {},
  // AMULETOS — IDENTIDADE VISUAL DEFINITIVA: real art requested (dark-fantasy,
  // premium, physically distinct per item) but no image-generation tool is
  // available in this environment. See the delivery report for the exact
  // brief to commission/generate for each of these three `imageSrc` paths.
  mosswood_charm: {},
  ancient_core: {},
  hollow_sigil: {},
  wardens_eye: {},
  crown_of_the_hollow_king: {},
};

export function getItemVisualAsset(visualAssetId: string): ItemVisualAsset {
  return ITEM_VISUAL_ASSETS[visualAssetId] ?? {};
}
