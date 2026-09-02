import type { BiomeDefinition } from "./types";
import { ANCIENT_FOREST } from "./ancientForest";
import { VOLCANIC_WASTES } from "./volcanicWastes";
import { FROZEN_TUNDRA } from "./frozenTundra";
import { CURSED_DESERT } from "./cursedDesert";
import { DARK_RUINS } from "./darkRuins";
import { ABYSS } from "./abyss";

export type { BiomeDefinition, BiomePalette, AtmosphereKind } from "./types";

/**
 * Registry of every biome the renderer knows about, keyed by the same id a
 * PhaseDefinition points at (config/phaseConfig.ts PhaseDefinition.biomeId)
 * — adding a 7th biome later is one more file here plus one more phase
 * entry, nothing in MapRenderer/mapDecorations/CanvasRenderer changes.
 */
export const BIOMES: Record<string, BiomeDefinition> = {
  ANCIENT_FOREST,
  VOLCANIC_WASTES,
  FROZEN_TUNDRA,
  CURSED_DESERT,
  DARK_RUINS,
  ABYSS,
};

/** Looks up a biome by id, falling back to Ancient Forest if the id is somehow unknown (should never happen — every PhaseDefinition.biomeId has a matching entry above). */
export function getBiome(biomeId: string): BiomeDefinition {
  return BIOMES[biomeId] ?? ANCIENT_FOREST;
}

/** Kept for anything that still wants a single default biome reference (e.g. a menu preview). Gameplay rendering now looks up the CURRENT phase's biome via getBiome(renderSnapshot.biomeId) instead. */
export const ACTIVE_BIOME: BiomeDefinition = ANCIENT_FOREST;
