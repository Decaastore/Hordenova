import type { BiomeDefinition } from "./types";

/**
 * FROZEN TUNDRA — third phase (waves 51-70). Pale ice-blue and bruised
 * purple over near-white snow, cold instead of warm torchlight. Pure data
 * file, same rendering pipeline as every other biome.
 *
 * VISUAL POLISH (feedback: "fase de gelo parece jogo de criança") — the
 * ground/road tones were deepened and `accentWarm` (which also drives the
 * 3D key light color) changed from lavender to a cold white-blue: the
 * lavender light was washing the whole map into a flat pastel. Less fog,
 * stronger vignette, so the ice reads cold and deep instead of candy-like.
 */
export const FROZEN_TUNDRA: BiomeDefinition = {
  id: "FROZEN_TUNDRA",
  name: "Tundra Congelada",
  atmosphere: "SNOW",
  palette: {
    skyTop: "#a9c3d6",
    skyBottom: "#5a7a94",

    groundBase: "#aebfcb",
    groundShadowed: "#5f7684",
    groundAccentA: "#d4e2ea",
    groundAccentB: "#8ea4b2",

    roadFill: "#6f8796",
    roadFillLight: "#93aab8",
    roadEdge: "#36505e",
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
    accentWarm: "#e2f2ff",

    fogColor: "rgba(230,240,248,0.1)",
    vignette: "rgba(6,14,24,0.55)",
  },
  decorationWeights: {
    ROCK: 14,
    CRYSTAL: 12,
    RUIN: 4,
    GRASS: 2,
    TORCH: 5,
    // Frost fractures glowing cyan in the ice (same FISSURE renderer as the volcanic lava seams, recolored by this palette).
    FISSURE: 8,
  },
};
