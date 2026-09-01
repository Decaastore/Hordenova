import type { BiomeDefinition } from "./types";

/**
 * FLORESTA ANTIGA — first biome, home of Whispering Woods.
 *
 * Deliberately NOT a uniform bright green: the ground reads as dark,
 * damp earth and moss (olive/brown/near-black), with cold pine-green
 * vegetation and grey stone doing the "forest" work instead of one
 * saturated green fill. The only strong saturated colors are the toxic
 * rune-green magic accent and warm amber torchlight — both used sparingly
 * so towers/enemies/VFX still pop against the terrain instead of
 * blending into it.
 */
export const ANCIENT_FOREST: BiomeDefinition = {
  id: "ANCIENT_FOREST",
  name: "Floresta Antiga",
  atmosphere: "MIST",
  palette: {
    skyTop: "#cdd6b8",
    skyBottom: "#26361e",

    groundBase: "#3c3524",
    groundShadowed: "#211c13",
    groundAccentA: "#4a5730",
    groundAccentB: "#5c4a32",

    roadFill: "#8a7150",
    roadFillLight: "#ab9569",
    roadEdge: "#43331f",
    roadRut: "rgba(35,27,15,0.45)",

    slotClearing: "#59692f",
    slotStone: "#847d6c",
    slotRuin: "#6c6250",
    slotMagic: "#4d6a3c",

    vegetationPrimary: "#2f4a26",
    vegetationSecondary: "#24361d",
    vegetationDark: "#141f10",
    vegetationHighlight: "#8faa54",

    rock: "#6d6c62",
    rockDark: "#39392f",

    waterDeep: "#1c3634",
    waterLight: "#4c766c",

    accentGlow: "#9dff6a",
    accentWarm: "#ffb04a",

    fogColor: "rgba(205,217,190,0.09)",
    vignette: "rgba(8,12,6,0.46)",
  },
  decorationWeights: {
    TREE: 22,
    ROCK: 15,
    ROOT: 11,
    RUIN: 5,
    CRYSTAL: 5,
    GRASS: 11,
    FLOWER: 6,
    WATER: 2,
    TORCH: 7,
  },
};
