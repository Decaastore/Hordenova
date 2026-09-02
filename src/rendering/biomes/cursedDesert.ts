import type { BiomeDefinition } from "./types";

/**
 * CURSED DESERT — fourth phase (waves 71-90). Sun-bleached sand over
 * buried ruins, a sickly magic-purple accent instead of a natural one.
 * Pure data file, same rendering pipeline as every other biome.
 */
export const CURSED_DESERT: BiomeDefinition = {
  id: "CURSED_DESERT",
  name: "Deserto Amaldiçoado",
  atmosphere: "SANDSTORM",
  palette: {
    skyTop: "#d8b878",
    skyBottom: "#8a5a38",

    groundBase: "#c4a066",
    groundShadowed: "#7a5a34",
    groundAccentA: "#d8bc84",
    groundAccentB: "#9a7648",

    roadFill: "#a4835a",
    roadFillLight: "#c4a478",
    roadEdge: "#5c4426",
    roadRut: "rgba(60,40,20,0.35)",

    slotClearing: "#b89a68",
    slotStone: "#8a7a62",
    slotRuin: "#6e5a44",
    slotMagic: "#6a3a8a",

    vegetationPrimary: "#6a5a34",
    vegetationSecondary: "#4a3e26",
    vegetationDark: "#241e12",
    vegetationHighlight: "#c9a0ff",

    rock: "#8a7458",
    rockDark: "#443a28",

    waterDeep: "#3a2e1a",
    waterLight: "#8a6a3a",

    accentGlow: "#b06aff",
    accentWarm: "#ffcf6a",

    fogColor: "rgba(210,180,120,0.18)",
    vignette: "rgba(24,14,4,0.5)",
  },
  decorationWeights: {
    ROCK: 14,
    RUIN: 16,
    CRYSTAL: 7,
    GRASS: 2,
    TORCH: 6,
  },
};
