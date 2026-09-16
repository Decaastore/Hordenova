import { describe, expect, it } from "vitest";
import { BIOMES, getBiome } from "./index";
import { PHASES } from "@/config/phaseConfig";

/**
 * 10-biome expansion — invariant coverage for the biome data layer (no
 * prior test file existed for rendering/biomes/ at all). Confirms every
 * phase's biomeId resolves to a real, fully-populated BiomeDefinition, and
 * that the 10 new worlds are genuinely distinct from each other and from
 * the 6 pre-existing biomes (never a silent palette/atmosphere duplicate).
 */
describe("biomes registry", () => {
  it("every PhaseDefinition.biomeId resolves to a real entry in BIOMES", () => {
    for (const phase of PHASES) {
      expect(BIOMES[phase.biomeId]).toBeDefined();
      expect(BIOMES[phase.biomeId]!.id).toBe(phase.biomeId);
    }
  });

  it("has exactly 16 biomes registered (6 original + 10-biome expansion)", () => {
    expect(Object.keys(BIOMES).length).toBe(16);
  });

  it("every biome has a non-empty name, a palette with no blank fields, and at least one decoration weight", () => {
    for (const [id, biome] of Object.entries(BIOMES)) {
      expect(biome.name.length).toBeGreaterThan(0);
      for (const [field, value] of Object.entries(biome.palette)) {
        expect(value, `${id}.palette.${field}`).toBeTruthy();
      }
      const totalDecorations = Object.values(biome.decorationWeights).reduce((sum, n) => sum + (n ?? 0), 0);
      expect(totalDecorations, `${id} decorationWeights`).toBeGreaterThan(0);
    }
  });

  it("no two biomes share the same atmosphere+skyTop combination (each of the 10 new worlds reads as visually distinct)", () => {
    const seen = new Map<string, string>();
    for (const [id, biome] of Object.entries(BIOMES)) {
      const key = `${biome.atmosphere}|${biome.palette.skyTop}`;
      const existing = seen.get(key);
      expect(existing, `${id} shares atmosphere+skyTop with ${existing}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it("getBiome falls back to Ancient Forest for an unknown id, and resolves every known id to itself", () => {
    expect(getBiome("NOT_A_REAL_BIOME").id).toBe("ANCIENT_FOREST");
    for (const id of Object.keys(BIOMES)) {
      expect(getBiome(id).id).toBe(id);
    }
  });

  it("the 10-biome expansion worlds are registered under their own ids", () => {
    const expansionIds = [
      "DWARVEN_UNDERCITY",
      "COLOSSUS_GRAVEYARD",
      "FLOATING_ISLES",
      "LOST_SUN_TEMPLE",
      "CRYSTAL_SEA",
      "ABYSSAL_FORTRESS",
      "ASHEN_VALLEY",
      "MOON_GARDENS",
      "DEFILED_CATHEDRAL",
      "LEVIATHAN_COAST",
    ];
    for (const id of expansionIds) {
      expect(BIOMES[id]).toBeDefined();
    }
  });
});
