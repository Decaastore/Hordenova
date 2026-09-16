import type { BiomeDefinition } from "./types";

/**
 * DEFILED_CATHEDRAL — 10-biome expansion, waves 291-310. An enormous
 * destroyed gothic cathedral taken over by supernatural corruption —
 * deliberately more than "a dark church": towering broken stonework, cold
 * stained-glass violet bleeding through incense haze. INCENSE_SMOKE
 * atmosphere — upward wisps with a wide horizontal sway suggesting
 * light-shaft movement through a ruined nave.
 */
export const DEFILED_CATHEDRAL: BiomeDefinition = {
  id: "DEFILED_CATHEDRAL",
  name: "Catedral Profanada",
  atmosphere: "INCENSE_SMOKE",
  palette: {
    skyTop: "#161020",
    skyBottom: "#06040a",

    groundBase: "#332c38",
    groundShadowed: "#14111a",
    groundAccentA: "#3e3644",
    groundAccentB: "#201c26",

    roadFill: "#3a3240",
    roadFillLight: "#544a5e",
    roadEdge: "#0e0c12",
    roadRut: "rgba(180,140,220,0.18)",

    slotClearing: "#282230",
    slotStone: "#544c5c",
    slotRuin: "#3a3240",
    slotMagic: "#7a3ab0",

    vegetationPrimary: "#2c2634",
    vegetationSecondary: "#18141e",
    vegetationDark: "#0c0a10",
    vegetationHighlight: "#b88ae0",

    rock: "#463c4e",
    rockDark: "#1c1822",

    waterDeep: "#100c16",
    waterLight: "#3a2c46",

    accentGlow: "#a860e8",
    accentWarm: "#ff8ac8",

    fogColor: "rgba(170,130,220,0.12)",
    vignette: "rgba(3,2,5,0.74)",
  },
  decorationWeights: {
    RUIN: 26,
    ROCK: 8,
    TORCH: 6,
  },
};
