import type { BiomeDefinition } from "./types";

/**
 * ABYSSAL_FORTRESS — 10-biome expansion, waves 231-250. A fortress built
 * INSIDE a giant abyss — heavy dark stonework ringed by a bottomless drop,
 * distinct from the (already-shipped) ABYSS biome's near-black open-void
 * identity: here the read is "built structure clinging to a chasm wall",
 * a warmer iron-grey rather than cold violet-black. DEEP_FOG atmosphere —
 * a bigger, slower fog bank than any other biome's fog (see MapRenderer's
 * drawFog DEEP_FOG branch).
 */
export const ABYSSAL_FORTRESS: BiomeDefinition = {
  id: "ABYSSAL_FORTRESS",
  name: "Fortaleza Abissal",
  atmosphere: "DEEP_FOG",
  palette: {
    skyTop: "#181c22",
    skyBottom: "#08090c",

    groundBase: "#343a40",
    groundShadowed: "#14171a",
    groundAccentA: "#404850",
    groundAccentB: "#22262a",

    roadFill: "#3a4046",
    roadFillLight: "#565e66",
    roadEdge: "#0c0e10",
    roadRut: "rgba(150,180,200,0.16)",

    slotClearing: "#282e32",
    slotStone: "#565e64",
    slotRuin: "#3a4044",
    slotMagic: "#4a6a8a",

    vegetationPrimary: "#2c3236",
    vegetationSecondary: "#181c1e",
    vegetationDark: "#0c0e10",
    vegetationHighlight: "#7aa8c8",

    rock: "#484e54",
    rockDark: "#1c2024",

    waterDeep: "#08090c",
    waterLight: "#2a3844",

    accentGlow: "#6ab0e0",
    accentWarm: "#8a7aff",

    fogColor: "rgba(140,170,200,0.18)",
    vignette: "rgba(2,3,4,0.74)",
  },
  decorationWeights: {
    RUIN: 20,
    ROCK: 16,
    TORCH: 6,
  },
};
