import type { BiomeDefinition } from "./types";

/**
 * CRYSTAL_SEA — 10-biome expansion, waves 211-230. Giant mineral crystal
 * formations rising like a frozen sea — deliberately NOT all-neon: the
 * crystal reads as real, cold physical mineral (deep teal/cyan facets over
 * dark rock), with color used sparingly as an accent, not as the whole
 * palette. MINERAL_GLINT atmosphere — sharp, brief static flashes off
 * crystal facets, distinct from any drifting-particle biome.
 */
export const CRYSTAL_SEA: BiomeDefinition = {
  id: "CRYSTAL_SEA",
  name: "Mar de Cristal",
  atmosphere: "MINERAL_GLINT",
  palette: {
    skyTop: "#0e1e28",
    skyBottom: "#040a10",

    groundBase: "#243844",
    groundShadowed: "#0e181e",
    groundAccentA: "#2e4a56",
    groundAccentB: "#182a32",

    roadFill: "#304854",
    roadFillLight: "#48697a",
    roadEdge: "#0a1216",
    roadRut: "rgba(120,230,255,0.22)",

    slotClearing: "#1e343e",
    slotStone: "#4a6470",
    slotRuin: "#2c4650",
    slotMagic: "#3ab8d8",

    vegetationPrimary: "#22424a",
    vegetationSecondary: "#12262c",
    vegetationDark: "#081416",
    vegetationHighlight: "#9af0ff",

    rock: "#3a5864",
    rockDark: "#16262c",

    waterDeep: "#0a2028",
    waterLight: "#2a6a7e",

    accentGlow: "#7fe8ff",
    accentWarm: "#c8b0ff",

    fogColor: "rgba(120,220,255,0.08)",
    vignette: "rgba(2,6,10,0.68)",
  },
  decorationWeights: {
    CRYSTAL: 24,
    ROCK: 12,
    WATER: 6,
  },
};
