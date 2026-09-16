import type { BiomeDefinition } from "./types";

/**
 * LEVIATHAN_COAST — 10-biome expansion, waves 311-330. A rocky coast where
 * giant sea creatures died eons ago — deliberately NOT just a beach: dark
 * wet stone, bleached bone-white leviathan remains jutting from the surf,
 * a cold deep-teal sea rather than a bright tropical one. SEA_SPRAY
 * atmosphere — genuine parabolic spray-arc motion off the surf line.
 */
export const LEVIATHAN_COAST: BiomeDefinition = {
  id: "LEVIATHAN_COAST",
  name: "Península dos Leviatãs",
  atmosphere: "SEA_SPRAY",
  palette: {
    skyTop: "#1a2a34",
    skyBottom: "#08121a",

    groundBase: "#3a4442",
    groundShadowed: "#161e1c",
    groundAccentA: "#465250",
    groundAccentB: "#242e2c",

    roadFill: "#424c4a",
    roadFillLight: "#5e6c68",
    roadEdge: "#0e1414",
    roadRut: "rgba(140,210,220,0.2)",

    slotClearing: "#2e3836",
    slotStone: "#5e6864",
    slotRuin: "#465250",
    slotMagic: "#2ea0b0",

    vegetationPrimary: "#324440",
    vegetationSecondary: "#1a2624",
    vegetationDark: "#0e1614",
    vegetationHighlight: "#a8e8d8",

    rock: "#4e5a58",
    rockDark: "#1e2624",

    waterDeep: "#0a2430",
    waterLight: "#2e7888",

    accentGlow: "#5adfe0",
    accentWarm: "#d8e8d0",

    fogColor: "rgba(140,210,220,0.12)",
    vignette: "rgba(3,6,7,0.68)",
  },
  decorationWeights: {
    ROCK: 18,
    WATER: 14,
    RUIN: 8,
    GRASS: 2,
  },
};
