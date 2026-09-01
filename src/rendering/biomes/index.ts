import type { BiomeDefinition } from "./types";
import { ANCIENT_FOREST } from "./ancientForest";

export type { BiomeDefinition, BiomePalette, AtmosphereKind } from "./types";

/**
 * Registry of every biome the renderer knows about. Adding a new one
 * (Terras Vulcânicas, Tundra, Deserto Amaldiçoado, Ruínas Sombrias, ...)
 * means: create biomes/<name>.ts following ancientForest.ts's shape, then
 * add it here. Nothing in MapRenderer or mapDecorations needs to change.
 */
export const BIOMES: Record<string, BiomeDefinition> = {
  ANCIENT_FOREST,
};

/**
 * Whispering Woods' biome for now — once levels exist, this becomes a
 * per-level lookup (`BIOMES[level.biomeId]`) instead of a single constant.
 */
export const ACTIVE_BIOME: BiomeDefinition = ANCIENT_FOREST;
