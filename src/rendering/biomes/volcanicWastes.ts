import type { BiomeDefinition } from "./types";

/**
 * VOLCANIC WASTES — second phase (waves 31-50). Scorched black rock,
 * cooling lava in the road's ruts, ash instead of mist. Reuses the exact
 * same rendering pipeline as Ancient Forest — this file is purely data
 * (palette/atmosphere/decoration weights), per the "architecture over art
 * for now" instruction.
 */
export const VOLCANIC_WASTES: BiomeDefinition = {
  id: "VOLCANIC_WASTES",
  name: "Terras Vulcânicas",
  atmosphere: "EMBERS",
  palette: {
    skyTop: "#3a1a12",
    skyBottom: "#1a0a06",

    groundBase: "#2a1a14",
    groundShadowed: "#150a06",
    groundAccentA: "#4a2416",
    groundAccentB: "#3a2418",

    roadFill: "#3a281e",
    roadFillLight: "#5a3624",
    roadEdge: "#180d08",
    roadRut: "rgba(255,90,30,0.28)",

    slotClearing: "#3a2418",
    slotStone: "#5a4a40",
    slotRuin: "#4a3428",
    slotMagic: "#6a2e16",

    vegetationPrimary: "#4a2c1a",
    vegetationSecondary: "#3a2214",
    vegetationDark: "#1a0f0a",
    vegetationHighlight: "#ff8a3a",

    rock: "#4a3a34",
    rockDark: "#221812",

    waterDeep: "#5a1e0c",
    waterLight: "#ff6a2e",

    accentGlow: "#ff7a2e",
    accentWarm: "#ffb04a",

    fogColor: "rgba(255,140,60,0.07)",
    vignette: "rgba(20,4,2,0.55)",
  },
  decorationWeights: {
    ROCK: 24,
    RUIN: 10,
    CRYSTAL: 6,
    GRASS: 3,
    TORCH: 9,
  },
};
