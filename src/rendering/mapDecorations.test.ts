import { describe, expect, it } from "vitest";
import { getMapDecorations, type Decoration } from "./mapDecorations";
import { BIOMES } from "./biomes";
import { ENEMY_PATH, TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { distance, distanceToPolyline } from "@/utils/geometry";

const ALL_BIOMES = Object.values(BIOMES);

/**
 * FLOATING ISLANDS WATER BUG — regression coverage. The bug (duplicate-
 * looking/overlapping water planes, water spilling onto the path or tower
 * slots) traced back to mapDecorations.ts's placement loop only ever
 * checking a decoration's PLACEMENT POINT against the play area and never
 * against any other already-placed decoration — see that file's own
 * DECORATION_FOOTPRINT_RADIUS doc comment for the full root-cause writeup.
 * These tests assert the fix holds for every real biome, not just Floating
 * Isles, since the underlying generator is shared by all of them.
 */

// Approximate visual footprint per kind, mirroring mapDecorations.ts's own
// (private) DECORATION_FOOTPRINT_RADIUS table — kept as a second, independent
// copy here so this test still catches a regression if that table is ever
// hollowed out rather than actually enforced.
const FOOTPRINT: Record<Decoration["kind"], number> = {
  TREE: 22,
  ROCK: 12,
  ROOT: 10,
  RUIN: 20,
  CRYSTAL: 14,
  GRASS: 6,
  FLOWER: 5,
  WATER: 38,
  TORCH: 8,
};

describe("mapDecorations — Floating Islands water duplication/overlap bug fix", () => {
  for (const biome of ALL_BIOMES) {
    describe(`biome: ${biome.id}`, () => {
      const decorations = getMapDecorations(biome);

      it("no two decorations' drawn footprints overlap each other", () => {
        for (let i = 0; i < decorations.length; i++) {
          for (let j = i + 1; j < decorations.length; j++) {
            const a = decorations[i]!;
            const b = decorations[j]!;
            const minSeparation = (FOOTPRINT[a.kind] * a.scale + FOOTPRINT[b.kind] * b.scale) * 0.8;
            expect(distance(a.position, b.position)).toBeGreaterThanOrEqual(minSeparation - 0.01);
          }
        }
      });

      it("no decoration's footprint reaches the enemy path", () => {
        for (const deco of decorations) {
          const footprint = FOOTPRINT[deco.kind] * deco.scale;
          expect(distanceToPolyline(deco.position, ENEMY_PATH)).toBeGreaterThanOrEqual(50 + footprint - 0.01);
        }
      });

      it("no decoration's footprint reaches a tower slot", () => {
        for (const deco of decorations) {
          const footprint = FOOTPRINT[deco.kind] * deco.scale;
          for (const slot of TOWER_SLOTS) {
            expect(distance(deco.position, slot.position)).toBeGreaterThanOrEqual(40 + footprint - 0.01);
          }
        }
      });

      it("specifically: no WATER decoration ever overlaps another WATER decoration (the reported 'duplicate lake' symptom)", () => {
        const waters = decorations.filter((d) => d.kind === "WATER");
        for (let i = 0; i < waters.length; i++) {
          for (let j = i + 1; j < waters.length; j++) {
            const a = waters[i]!;
            const b = waters[j]!;
            const minSeparation = (FOOTPRINT.WATER * a.scale + FOOTPRINT.WATER * b.scale) * 0.8;
            expect(distance(a.position, b.position)).toBeGreaterThanOrEqual(minSeparation - 0.01);
          }
        }
      });
    });
  }

  it("layout is still deterministic per biome (same seed, same result — no per-frame reshuffling)", () => {
    const biome = ALL_BIOMES[0]!;
    const a = getMapDecorations(biome);
    const b = getMapDecorations(biome);
    expect(a).toBe(b); // memoized — literally the same array reference
  });
});
