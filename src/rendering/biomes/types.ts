import type { DecorationKind } from "../mapDecorations";

/**
 * Everything about a level's terrain identity — the piece that was
 * missing before: the whole game shared one hardcoded green palette, so
 * every stage looked like the same forest. A BiomeDefinition is the unit
 * a new stage plugs in to get its own bioma/paleta/vegetação/iluminação
 * without touching any drawing code.
 *
 * To add a biome later: create one file here (see ancientForest.ts as the
 * reference shape), tune palette + decorationWeights + atmosphere, and
 * register it in ./index.ts. MapRenderer/mapDecorations never hardcode
 * colors themselves — they only read whatever BiomeDefinition they're
 * given, so a new biome is a data file, not a rendering rewrite.
 */
export interface BiomePalette {
  skyTop: string;
  skyBottom: string;

  /** Terrain base — deliberately 3+ tones, not one flat fill, so the ground reads as real material, not a color swatch. */
  groundBase: string;
  groundShadowed: string;
  groundAccentA: string;
  groundAccentB: string;

  roadFill: string;
  roadFillLight: string;
  roadEdge: string;
  roadRut: string;

  slotClearing: string;
  slotStone: string;
  slotRuin: string;
  slotMagic: string;

  vegetationPrimary: string;
  vegetationSecondary: string;
  vegetationDark: string;
  vegetationHighlight: string;

  rock: string;
  rockDark: string;

  waterDeep: string;
  waterLight: string;

  /** The biome's one strong, saturated "magic/life" accent — used sparingly so it pops instead of blending in. */
  accentGlow: string;
  accentWarm: string;

  fogColor: string;
  vignette: string;
}

/**
 * The 5 original values (MIST/EMBERS/SNOW/SANDSTORM/SPORES) drive the
 * ORIGINAL, unchanged drawAmbientParticles/drawFog formula in MapRenderer.ts
 * — no visual regression for the 6 existing biomes. The 10 new values below
 * (10-biome expansion) each get their own genuinely distinct particle
 * motion (see MapRenderer.ts's ATMOSPHERE_MOTION table) instead of sharing
 * one recolored shape — this is what makes `atmosphere` a real, read field
 * instead of the write-only one it used to be.
 */
export type AtmosphereKind =
  | "MIST"
  | "EMBERS"
  | "SNOW"
  | "SANDSTORM"
  | "SPORES"
  | "STEAM"
  | "SETTLING_DUST"
  | "HIGH_WIND"
  | "SUNDUST"
  | "MINERAL_GLINT"
  | "DEEP_FOG"
  | "ASH"
  | "LUMINOUS_SPORES"
  | "INCENSE_SMOKE"
  | "SEA_SPRAY";

export interface BiomeDefinition {
  id: string;
  name: string;
  palette: BiomePalette;
  atmosphere: AtmosphereKind;
  /** How many of each decoration kind to scatter — a biome can omit a kind entirely (e.g. no WATER in a desert). */
  decorationWeights: Partial<Record<DecorationKind, number>>;
}
