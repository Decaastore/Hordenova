import type { BiomeDefinition } from "./types";

/**
 * FROZEN TUNDRA — third phase (waves 51-70). Pale ice-blue and bruised
 * purple over near-white snow, cold instead of warm torchlight. Pure data
 * file, same rendering pipeline as every other biome.
 */
export const FROZEN_TUNDRA: BiomeDefinition = {
  id: "FROZEN_TUNDRA",
  name: "Tundra Congelada",
  atmosphere: "SNOW",
  palette: {
    skyTop: "#c8dceb",
    skyBottom: "#5a7a94",

    groundBase: "#c4d4dc",
    groundShadowed: "#8298a4",
    groundAccentA: "#dce8ee",
    groundAccentB: "#a8bcc6",

    roadFill: "#7e94a0",
    roadFillLight: "#a2b6c0",
    roadEdge: "#4a5e6a",
    roadRut: "rgba(30,50,60,0.3)",

    slotClearing: "#b8ccd6",
    slotStone: "#7c8c94",
    slotRuin: "#6a7e88",
    slotMagic: "#4a7a9a",

    vegetationPrimary: "#4a6a72",
    vegetationSecondary: "#3a545c",
    vegetationDark: "#20343a",
    vegetationHighlight: "#bcecff",

    rock: "#8a98a0",
    rockDark: "#4a5860",

    waterDeep: "#264a5c",
    waterLight: "#7ec4dc",

    accentGlow: "#7ee6ff",
    accentWarm: "#c9a8ff",

    fogColor: "rgba(230,240,248,0.16)",
    vignette: "rgba(6,14,20,0.42)",
  },
  decorationWeights: {
    ROCK: 18,
    CRYSTAL: 12,
    RUIN: 4,
    GRASS: 4,
    TORCH: 5,
  },
};
