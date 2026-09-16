import type { BiomeDefinition } from "./types";

/**
 * FLOATING_ISLES — 10-biome expansion, waves 171-190. Sky islands adrift
 * above an open void, waterfalls pouring off their edges into nothing —
 * bright open-air altitude palette (pale sky blue/white), the opposite of
 * every underground/interior biome in this pack. HIGH_WIND atmosphere —
 * fast diagonal streak motion instead of any other biome's drifting motes.
 */
export const FLOATING_ISLES: BiomeDefinition = {
  id: "FLOATING_ISLES",
  name: "Ilhas Flutuantes",
  atmosphere: "HIGH_WIND",
  palette: {
    skyTop: "#4a7ac0",
    skyBottom: "#bfe0f5",

    groundBase: "#6a8a5a",
    groundShadowed: "#324a2a",
    groundAccentA: "#7fa068",
    groundAccentB: "#3e5834",

    roadFill: "#8a8068",
    roadFillLight: "#a89c7e",
    roadEdge: "#3a3428",
    roadRut: "rgba(220,230,240,0.25)",

    slotClearing: "#5e7c50",
    slotStone: "#9a9686",
    slotRuin: "#7a7460",
    slotMagic: "#6ab8d8",

    vegetationPrimary: "#5a8850",
    vegetationSecondary: "#3a6034",
    vegetationDark: "#1e3418",
    vegetationHighlight: "#dfffb0",

    rock: "#8a9088",
    rockDark: "#3e423e",

    waterDeep: "#1e5a8a",
    waterLight: "#8fd8f5",

    accentGlow: "#aee8ff",
    accentWarm: "#fff2c0",

    fogColor: "rgba(210,235,255,0.16)",
    vignette: "rgba(10,18,28,0.42)",
  },
  decorationWeights: {
    ROCK: 14,
    GRASS: 10,
    FLOWER: 6,
    WATER: 8,
    TREE: 4,
  },
};
