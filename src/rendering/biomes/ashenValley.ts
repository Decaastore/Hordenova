import type { BiomeDefinition } from "./types";

/**
 * ASHEN_VALLEY — 10-biome expansion, waves 251-270. The site of an ancient
 * catastrophe, NOT a volcanic biome — no lava, no fire monsters: a dead
 * grey-brown wasteland of drifting ash over scorched, petrified ground,
 * cold and desolate rather than hot. ASH atmosphere — heavier sway/drift
 * than SETTLING_DUST or SUNDUST, its own irregular flake motion.
 */
export const ASHEN_VALLEY: BiomeDefinition = {
  id: "ASHEN_VALLEY",
  name: "Vale das Cinzas Mortas",
  atmosphere: "ASH",
  palette: {
    skyTop: "#2a2622",
    skyBottom: "#100e0c",

    groundBase: "#4a443c",
    groundShadowed: "#201c18",
    groundAccentA: "#5a5248",
    groundAccentB: "#2c2822",

    roadFill: "#524a40",
    roadFillLight: "#726858",
    roadEdge: "#181614",
    roadRut: "rgba(180,170,160,0.16)",

    slotClearing: "#3a3630",
    slotStone: "#6a645a",
    slotRuin: "#4a443c",
    slotMagic: "#8a5a3a",

    vegetationPrimary: "#3c362e",
    vegetationSecondary: "#221e1a",
    vegetationDark: "#100e0c",
    vegetationHighlight: "#c4a888",

    rock: "#5e564c",
    rockDark: "#26221e",

    waterDeep: "#181412",
    waterLight: "#4a4038",

    accentGlow: "#d89468",
    accentWarm: "#a86848",

    fogColor: "rgba(160,150,140,0.16)",
    vignette: "rgba(6,5,4,0.72)",
  },
  decorationWeights: {
    ROCK: 14,
    RUIN: 10,
    ROOT: 8,
    GRASS: 2,
  },
};
