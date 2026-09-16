import type { BiomeDefinition } from "./types";

/**
 * MOON_GARDENS — 10-biome expansion, waves 271-290. A nocturnal,
 * supernatural vegetation realm — deliberately mysterious/elegant/dark
 * rather than childish or bright: deep blue-black foliage lit by cold
 * silver moonlight and a single eerie violet bloom-accent, never a
 * saturated cartoon-garden palette. LUMINOUS_SPORES atmosphere — slow
 * upward-floating motes with a strong pulse, distinct from Crystal Sea's
 * sharp MINERAL_GLINT flashes.
 */
export const MOON_GARDENS: BiomeDefinition = {
  id: "MOON_GARDENS",
  name: "Jardins da Lua",
  atmosphere: "LUMINOUS_SPORES",
  palette: {
    skyTop: "#0e1428",
    skyBottom: "#040610",

    groundBase: "#20263a",
    groundShadowed: "#0c0e18",
    groundAccentA: "#282e46",
    groundAccentB: "#161a28",

    roadFill: "#282c40",
    roadFillLight: "#3e4460",
    roadEdge: "#0a0c14",
    roadRut: "rgba(180,160,255,0.2)",

    slotClearing: "#1c2032",
    slotStone: "#464a60",
    slotRuin: "#2c3044",
    slotMagic: "#8a5ad8",

    vegetationPrimary: "#242a44",
    vegetationSecondary: "#141830",
    vegetationDark: "#0a0c18",
    vegetationHighlight: "#c9b0ff",

    rock: "#3a3e52",
    rockDark: "#181a26",

    waterDeep: "#0a0c1c",
    waterLight: "#2e3a5e",

    accentGlow: "#b090ff",
    accentWarm: "#e8ddff",

    fogColor: "rgba(160,140,255,0.1)",
    vignette: "rgba(2,2,8,0.7)",
  },
  decorationWeights: {
    TREE: 14,
    FLOWER: 12,
    GRASS: 10,
    ROOT: 6,
  },
};
