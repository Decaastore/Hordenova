import type { BiomeDefinition } from "./types";

/**
 * COLOSSUS_GRAVEYARD — 10-biome expansion, waves 151-170. A field of
 * ancient giant-creature remains, their bones grown into the landscape's
 * own architecture — bleached bone-white against a dead grey sky, not the
 * warm forge-tones of Dwarven Undercity or the cold blue of Frozen Tundra.
 * SETTLING_DUST atmosphere — heavy, barely-drifting dust settling over the
 * bone-fields, distinct from every other biome's particle motion.
 */
export const COLOSSUS_GRAVEYARD: BiomeDefinition = {
  id: "COLOSSUS_GRAVEYARD",
  name: "Cemitério dos Colossos",
  atmosphere: "SETTLING_DUST",
  palette: {
    skyTop: "#3a362e",
    skyBottom: "#1a1814",

    groundBase: "#584f3e",
    groundShadowed: "#282218",
    groundAccentA: "#6a6050",
    groundAccentB: "#38321f",

    roadFill: "#665c48",
    roadFillLight: "#87795e",
    roadEdge: "#221e16",
    roadRut: "rgba(160,150,120,0.2)",

    slotClearing: "#4a4232",
    slotStone: "#8a806c",
    slotRuin: "#645a46",
    slotMagic: "#5a6a58",

    vegetationPrimary: "#454234",
    vegetationSecondary: "#2c2a20",
    vegetationDark: "#18160f",
    vegetationHighlight: "#a8b088",

    rock: "#7a7060",
    rockDark: "#332e24",

    waterDeep: "#221e18",
    waterLight: "#4a4636",

    accentGlow: "#9ab088",
    accentWarm: "#c8bfa0",

    fogColor: "rgba(170,160,130,0.14)",
    vignette: "rgba(8,7,5,0.66)",
  },
  decorationWeights: {
    RUIN: 20,
    ROCK: 10,
    ROOT: 6,
    GRASS: 4,
  },
};
