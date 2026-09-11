import { TOWERS_3D, FOREST } from "@/lab3d/palette";
import type { TowerSkinDefinition } from "../towerSkinTypes";

/**
 * IRONWOOD — BASE. The free, default look every player starts with:
 * the same identity already validated in the first hybrid POC (dark
 * broken-rock skirt, weathered wood trunk, curled iron prongs, green
 * rune-crystal core). Kept as its own explicit `TowerSkinDefinition`
 * (not a hardcoded fallback) so it proves the architecture by being the
 * FIRST citizen of it, not a special case outside it.
 */
export const ironwoodBaseSkin: TowerSkinDefinition = {
  id: "ironwood-base",
  name: "Ironwood",
  description: "A torre inicial: pedra fraturada, madeira envelhecida e um núcleo de cristal-runa verde.",
  base: {
    variant: "broken-rock",
    color: FOREST.rockDark,
    roughness: 0.95,
    metalness: 0,
    veinColor: 0,
  },
  body: {
    variant: "gnarled-trunk",
    textureBase: TOWERS_3D.IRONWOOD.primary,
    textureDark: TOWERS_3D.IRONWOOD.secondary,
    // A distinct mid-grey stone for the drum — lighter than the
    // foundation's near-black broken rock so the two visually separate
    // instead of fusing into one dark mass (see the readback in the
    // final report on why this mattered more than any geometry change).
    stoneColor: 0x4c4842,
    roughness: 0.88,
    metalness: 0,
    bandColor: 0x9a8a5f,
    bandRoughness: 0.5,
    bandMetalness: 0.55,
  },
  ornaments: {
    variant: "curled-iron-prongs",
    count: 3,
    // A worn-bronze metal tone, NOT the palette's darkest color (the
    // original `TOWERS_3D.IRONWOOD.secondary` is near-black — using it
    // for "the metal that should read as a bright accent" was the reason
    // the collar/struts were invisible against the equally dark body).
    color: 0x9a8a5f,
    roughness: 0.4,
    metalness: 0.65,
    tipGlow: 0,
  },
  core: {
    variant: "faceted-rune-crystal",
    shellColor: 0x0c1410,
    emissive: TOWERS_3D.IRONWOOD.accent,
    emissiveIntensity: 2.2,
    crackColor: TOWERS_3D.IRONWOOD.accent,
    scale: 1,
    pulseSpeed: 1.6,
  },
  sideElements: {
    chainColor: 0x2a241c,
    chainCount: 2,
    glowColor: TOWERS_3D.IRONWOOD.accent,
  },
  effects: {
    boltColor: TOWERS_3D.IRONWOOD.accent,
    impactColor: TOWERS_3D.IRONWOOD.accent,
  },
};
