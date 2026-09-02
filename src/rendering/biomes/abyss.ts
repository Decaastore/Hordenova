import type { BiomeDefinition } from "./types";

/**
 * ABYSS — sixth and final phase of this content slice (waves 111-130, then
 * repeats indefinitely — see config/phaseConfig.ts getPhaseForWave). The
 * most extreme identity of the set: near-black ground, a single cold
 * violet accent, everything else drained of color. Pure data file, same
 * rendering pipeline as every other biome.
 */
export const ABYSS: BiomeDefinition = {
  id: "ABYSS",
  name: "Abismo",
  atmosphere: "MIST",
  palette: {
    skyTop: "#0e0a16",
    skyBottom: "#040308",

    groundBase: "#151220",
    groundShadowed: "#06050a",
    groundAccentA: "#1e1a2c",
    groundAccentB: "#120f1a",

    roadFill: "#221c30",
    roadFillLight: "#342a48",
    roadEdge: "#08060c",
    roadRut: "rgba(150,90,255,0.22)",

    slotClearing: "#1a1626",
    slotStone: "#3a3448",
    slotRuin: "#2a2438",
    slotMagic: "#4a1e6a",

    vegetationPrimary: "#1c1830",
    vegetationSecondary: "#120e20",
    vegetationDark: "#08060e",
    vegetationHighlight: "#a86aff",

    rock: "#332c44",
    rockDark: "#16121e",

    waterDeep: "#0a0616",
    waterLight: "#3a1e5a",

    accentGlow: "#b06aff",
    accentWarm: "#ff5a9a",

    fogColor: "rgba(120,80,200,0.1)",
    vignette: "rgba(0,0,2,0.68)",
  },
  decorationWeights: {
    ROCK: 16,
    RUIN: 14,
    CRYSTAL: 14,
    TORCH: 4,
  },
};
