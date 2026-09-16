# Item art — amulets

This folder holds the amulets' real artwork. `mosswood_charm.png` and
`hollow_sigil.png` are real, user-supplied art already wired up (see
`src/config/itemAssets.ts`); `wardens_eye.png` is still the empty,
ready-to-receive slot the code already points at — no image-generation
tool is available in the development environment this was built in, so
that file has **not** been generated, and is not a placeholder standing in
as real art.

Drop each file here with **exactly** this name, then set the matching
`imageSrc` in `src/config/itemAssets.ts` (e.g.
`mosswood_charm: { imageSrc: "/items/amulets/mosswood_charm.png" }`) — that
one line is the only code change needed; `ItemGlyph` picks it up everywhere
the item is shown (Inventory, tooltip, item modal, boss-drop banner, tower
equipment, every Marketplace surface) automatically.

## Format for every file

- PNG (or WebP), **transparent background**
- The item alone, no rarity border/glow/background baked in — the UI adds
  all of that around whatever image is here
- No text, no letters, no numbers, no watermark
- Square canvas, ~1024×1024 recommended (comfortably downscales to a 44px
  inventory tile and up to an 84px Marketplace/modal view)
- Clear, readable silhouette — the item must read correctly at both sizes

## `mosswood_charm.png` — Amuleto do Bosque Musgoso (UNCOMMON)

A small, aged pendant of weathered metal and natural wood/stone,
partly overtaken by moss — an ancient-forest, nature-bound object that
still reads as dark fantasy, not whimsical. Must be clearly a physical
amulet (cord/chain + pendant body), not just a green stone.
Suggested elements: pendant, cord/chain, aged metal, petrified wood, moss,
a small green core/crystal, worn ancient markings.

## `hollow_sigil.png` — Sigilo Oco (EPIC)

Visually very different from Mosswood Charm: an old, sinister sigil/amulet
tied to the "Hollow" concept — an artifact that could have been found
inside a corrupted boss. A strong **hollow/vacant center** is the key
visual trait. Suggested elements: aged black metal, circular or geometric
shape, a hollowed-out center, an engraved sigil/symbol, very subtle
spectral energy, ancient markings, small cracks, a forbidden-artifact feel.
Not a purple glowing rock.

## `wardens_eye.png` — Olho do Guardião (LEGENDARY)

The most visually powerful of the three: an amulet/relic built around a
supernatural eye associated with the Warden. The eye must be the clear
central element, set inside physical amulet construction (dark ornamented
metal, small structures framing the eye) — not a loose human eyeball.
Suggested elements: eye-shaped gem, supernatural iris, dark ornamented
metal, small framing structures, extremely subtle energy, an ancient/
legendary finish more elaborate than the two items above.

## Shared direction

All three need to read as the same universe: dark fantasy, sombre,
aggressive, premium, realistic materials, cinematic lighting — a modern
RPG item, never flat/cartoon/generic-AI/emoji-like. A player should
recognize which item is which by the picture alone, before reading the
name.
