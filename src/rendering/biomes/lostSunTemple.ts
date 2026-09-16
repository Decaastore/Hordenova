import type { BiomeDefinition } from "./types";

/**
 * LOST_SUN_TEMPLE — 10-biome expansion, waves 191-210. A monumental lost
 * sun-temple civilization — deliberately NOT "just another desert": deep
 * lapis/obsidian shadow contrasted with aged gold stonework and warm
 * sunlit dust, reading as a buried sacred monument rather than open sand.
 * SUNDUST atmosphere — warm-lit slow-falling motes distinct from Ashen
 * Valley's grey ASH or Colossus Graveyard's SETTLING_DUST.
 */
export const LOST_SUN_TEMPLE: BiomeDefinition = {
  id: "LOST_SUN_TEMPLE",
  name: "Templo Solar Perdido",
  atmosphere: "SUNDUST",
  palette: {
    skyTop: "#241a0a",
    skyBottom: "#0c0806",

    groundBase: "#5a4426",
    groundShadowed: "#241a0e",
    groundAccentA: "#705430",
    groundAccentB: "#382614",

    roadFill: "#6a5230",
    roadFillLight: "#8a6c40",
    roadEdge: "#20160a",
    roadRut: "rgba(255,210,110,0.2)",

    slotClearing: "#4a3a20",
    slotStone: "#8a7248",
    slotRuin: "#5e4a2a",
    slotMagic: "#c8901e",

    vegetationPrimary: "#5a4626",
    vegetationSecondary: "#382a16",
    vegetationDark: "#1c140a",
    vegetationHighlight: "#ffdf8a",

    rock: "#7a6440",
    rockDark: "#302410",

    waterDeep: "#1c1608",
    waterLight: "#6a5024",

    accentGlow: "#ffd257",
    accentWarm: "#ff9a3a",

    fogColor: "rgba(255,210,120,0.1)",
    vignette: "rgba(8,5,2,0.68)",
  },
  decorationWeights: {
    RUIN: 22,
    ROCK: 10,
    TORCH: 8,
    CRYSTAL: 4,
  },
};
