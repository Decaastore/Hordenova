import type { BiomeDefinition } from "./types";

/**
 * DARK RUINS — fifth phase (waves 91-110). Collapsed stone and dead earth
 * under a sickly green-black corruption, spore motes instead of mist.
 * Pure data file, same rendering pipeline as every other biome.
 */
export const DARK_RUINS: BiomeDefinition = {
  id: "DARK_RUINS",
  name: "Ruínas Sombrias",
  atmosphere: "SPORES",
  palette: {
    skyTop: "#2a2432",
    skyBottom: "#100c14",

    groundBase: "#2e2820",
    groundShadowed: "#141210",
    groundAccentA: "#3a3226",
    groundAccentB: "#26221c",

    roadFill: "#403a38",
    roadFillLight: "#5a5250",
    roadEdge: "#161414",
    roadRut: "rgba(120,200,90,0.14)",

    slotClearing: "#302a2c",
    slotStone: "#5a5458",
    slotRuin: "#4a4448",
    slotMagic: "#3a2a5a",

    vegetationPrimary: "#2c3020",
    vegetationSecondary: "#1c2014",
    vegetationDark: "#0c0e08",
    vegetationHighlight: "#8cff6a",

    rock: "#5a5458",
    rockDark: "#28242a",

    waterDeep: "#141824",
    waterLight: "#3a5048",

    accentGlow: "#8aff5a",
    accentWarm: "#b06aff",

    fogColor: "rgba(140,255,120,0.05)",
    vignette: "rgba(4,4,8,0.6)",
  },
  decorationWeights: {
    RUIN: 22,
    ROCK: 12,
    CRYSTAL: 8,
    TORCH: 10,
    GRASS: 3,
  },
};
