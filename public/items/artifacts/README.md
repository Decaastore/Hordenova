# Item art — artifacts

This folder is where `crown_of_the_hollow_king`'s real artwork goes once it
exists. No image-generation tool is available in the development
environment this was built in, so this file has **not** been generated —
this is the empty, ready-to-receive slot the code already points at (see
`src/config/itemAssets.ts`), not a placeholder standing in as real art.

Drop the file here as `crown_of_the_hollow_king.png`, then set
`imageSrc: "/items/artifacts/crown_of_the_hollow_king.png"` on its entry in
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
