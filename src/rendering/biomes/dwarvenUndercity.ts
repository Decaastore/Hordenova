import type { BiomeDefinition } from "./types";

/**
 * DWARVEN_UNDERCITY — 10-biome expansion, waves 131-150. An abandoned
 * underground dwarven mining civilization: warm forge-ember light cutting
 * through cold rock dark, iron scaffolding, veins of raw ore still glowing
 * faintly in the walls. STEAM atmosphere (see MapRenderer's
 * ATMOSPHERE_MOTION) — vents of steam/smoke/sparks drifting up from old
 * forges, not the cold mist/snow of any existing biome.
 */
export const DWARVEN_UNDERCITY: BiomeDefinition = {
  id: "DWARVEN_UNDERCITY",
  name: "Cidade Subterrânea dos Anões",
  atmosphere: "STEAM",
  palette: {
    skyTop: "#140f0a",
    skyBottom: "#050403",

    groundBase: "#3a2e22",
    groundShadowed: "#1a140e",
    groundAccentA: "#4a3a28",
    groundAccentB: "#241c14",

    roadFill: "#4a3c2a",
    roadFillLight: "#6a5638",
    roadEdge: "#160f0a",
    roadRut: "rgba(255,140,50,0.18)",

    slotClearing: "#342a1e",
    slotStone: "#5a5048",
    slotRuin: "#3c3226",
    slotMagic: "#8a4a1e",

    vegetationPrimary: "#463824",
    vegetationSecondary: "#2c2418",
    vegetationDark: "#181208",
    vegetationHighlight: "#ffb84a",

    rock: "#5a4c3a",
    rockDark: "#241c14",

    waterDeep: "#1a1410",
    waterLight: "#5a4020",

    accentGlow: "#ff8a2e",
    accentWarm: "#ffcf6a",

    fogColor: "rgba(255,140,50,0.08)",
    vignette: "rgba(6,4,2,0.7)",
  },
  decorationWeights: {
    ROCK: 18,
    RUIN: 16,
    TORCH: 10,
    CRYSTAL: 6,
  },
};
