# Item art — artifacts

This folder holds `crown_of_the_hollow_king.png` — real, user-supplied art
already wired up (see `src/config/itemAssets.ts`). It was the last of the
game's 4 fully-art'd items (the 3 confirmed amulets plus this MYTHIC one);
only `warden_fragment` (MATERIAL) and `ancient_core` (RUNE) still fall back
to a generic icon.

If a future artifact needs its own art, drop the file here with its own
`<visualAssetId>.png` name, then set
`imageSrc: "/items/artifacts/<visualAssetId>.png"` on its entry in
`src/config/itemAssets.ts` — that one line is the only code change needed;
`ItemGlyph` picks it up everywhere the item is shown (Inventory, tooltip,
item modal, boss-drop banner, tower equipment, every Marketplace surface)
automatically.

## Format

- PNG (or WebP), **transparent background**
- The item alone, no rarity border/glow/background baked in — the UI adds
  all of that around whatever image is here
- No text, no letters, no numbers, no watermark
- Square canvas, ~1024×1024 recommended (comfortably downscales to a 44px
  inventory tile and up to an 84px Marketplace/modal view)
- Clear, readable silhouette — the item must read correctly at both sizes

## `crown_of_the_hollow_king.png` — Coroa do Rei Oco (MYTHIC)

The rarest item in the entire game (0.10% drop weight) — its art must read
as more powerful and ornate than even Warden's Eye (LEGENDARY), the most
elaborate of the three amulets. A corrupted royal crown, not a pendant: a
physical circlet/crown object, dark cursed metal, gothic asymmetric
spikes, ornamental filigree — regal construction that has decayed into
something dreadful. Tie it to the "Hollow" lore already established by
`hollow_sigil` (a hollow/vacant motif) without repeating that item's
design: a void-black or absent-light accent (an empty central socket, a
gem that swallows light rather than one that glows) reads better here than
another glowing gem. Battle-worn but unmistakably a king's crown.

## Shared direction

Same universe as the three amulets (see `public/items/amulets/README.md`):
dark fantasy, sombre, aggressive, premium, realistic materials, cinematic
lighting — a modern RPG item, never flat/cartoon/generic-AI/emoji-like. As
the game's single mythic item, this one should be instantly recognizable
as the top of the entire item hierarchy.
