import { describe, expect, it } from "vitest";
import { BIOMES } from "@/rendering/biomes";
import { PHASES } from "@/config/phaseConfig";
import { distanceToPolyline, getPathLength } from "@/utils/geometry";
import { ENEMY_PATH, isTowerPositionValid, MIN_TOWER_SPACING, TOWER_SLOTS } from "./mapWhisperingWoods";
import { fortressAnchorFor, getMapLayout, HIGH_GROUND_RANGE_MULT, isInsideCastleFootprint, MAP_LAYOUTS, MAX_TOWERS_ON_MAP, REFERENCE_PATH_LENGTH, SITES_PER_MAP, type MapLayout } from "./mapLayouts";
import { roadCoverage } from "@/engine/MapDeployment";

/** Summed road share the best 12 sites reach at `range` (high ground included) — the map's "how much can be defended" number. */
function bestTwelveCoverage(layout: MapLayout, range: number): number {
  return layout.sites
    .map((s) => roadCoverage(layout, s.position, range * (s.trait === "HIGH_GROUND" ? HIGH_GROUND_RANGE_MULT : 1)).fraction)
    .sort((a, b) => b - a)
    .slice(0, MAX_TOWERS_ON_MAP)
    .reduce((a, b) => a + b, 0);
}

const forest = getMapLayout("ANCIENT_FOREST");

describe("map layouts — one battlefield per phase", () => {
  it("every biome (and so every phase, endgame laps included) has its own layout", () => {
    for (const id of Object.keys(BIOMES)) expect(MAP_LAYOUTS[id]?.id).toBe(id);
    for (const phase of PHASES) expect(getMapLayout(phase.biomeId).id).toBe(phase.biomeId);
  });

  it("every road is different", () => {
    const signatures = new Set(Object.values(MAP_LAYOUTS).map((l) => l.controlPoints.map((p) => `${p.x},${p.y}`).join(";")));
    expect(signatures.size).toBe(Object.keys(MAP_LAYOUTS).length);
  });

  it("Ancient Forest keeps its original road and its original 12 sites exactly", () => {
    expect(forest.path).toBe(ENEMY_PATH);
    for (const slot of TOWER_SLOTS) expect(forest.sites.find((s) => s.id === slot.id)?.position).toEqual(slot.position);
    expect(forest.speedScale).toBe(1);
  });

  for (const layout of Object.values(MAP_LAYOUTS)) {
    describe(layout.id, () => {
      it(`has ${SITES_PER_MAP} uniquely named sites, more than the ${MAX_TOWERS_ON_MAP}-tower cap, with two high grounds and two rune altars`, () => {
        expect(layout.sites).toHaveLength(SITES_PER_MAP);
        expect(new Set(layout.sites.map((s) => s.id)).size).toBe(SITES_PER_MAP);
        expect(layout.sites.filter((s) => s.trait === "HIGH_GROUND")).toHaveLength(2);
        expect(layout.sites.filter((s) => s.trait === "RUNE_ALTAR")).toHaveLength(2);
        expect(SITES_PER_MAP).toBeGreaterThan(MAX_TOWERS_ON_MAP);
      });

      it("every site passes the structural placement rules and can actually reach the road", () => {
        const end = layout.path[layout.path.length - 1]!;
        const positions = layout.sites.map((s) => s.position);
        for (const site of layout.sites) {
          expect(isTowerPositionValid(site.position, positions, layout.path, end), site.id).toBeNull();
          expect(distanceToPolyline(site.position, layout.path), site.id).toBeLessThanOrEqual(100);
        }
        for (let i = 0; i < positions.length; i++)
          for (let j = i + 1; j < positions.length; j++)
            expect(Math.hypot(positions[i]!.x - positions[j]!.x, positions[i]!.y - positions[j]!.y)).toBeGreaterThanOrEqual(MIN_TOWER_SPACING);
      });

      it("crossing time matches the original map (speedScale normalises road length)", () => {
        const ratio = layout.length / REFERENCE_PATH_LENGTH;
        expect(ratio).toBeGreaterThan(0.8);
        expect(ratio).toBeLessThan(1.2);
        expect(layout.length / layout.speedScale).toBeCloseTo(REFERENCE_PATH_LENGTH, 6);
        expect(getPathLength(layout.path)).toBeCloseTo(layout.length, 6);
      });

      it("is as defensible as the original map: best-12 road coverage within 8% at short, medium and long range", () => {
        for (const range of [150, 190, 240]) {
          const ratio = bestTwelveCoverage(layout, range) / bestTwelveCoverage(forest, range);
          expect(ratio, `range ${range}`).toBeGreaterThan(0.92);
          expect(ratio, `range ${range}`).toBeLessThan(1.08);
        }
      });

      it("no build site sits under the castle's walls", () => {
        const castle = fortressAnchorFor(layout.path).position;
        for (const site of layout.sites) expect(isInsideCastleFootprint(site.position, castle), site.id).toBe(false);
      });

      it("leaves room for the castle: no other stretch of road runs through the castle grounds", () => {
        const end = layout.path[layout.path.length - 1]!;
        let walked = 0;
        for (let i = 0; i < layout.path.length - 1; i++) {
          const a = layout.path[i]!;
          const b = layout.path[i + 1]!;
          walked += Math.hypot(b.x - a.x, b.y - a.y);
          if (layout.length - walked < 170) break;
          expect(Math.hypot(b.x - end.x, b.y - end.y)).toBeGreaterThan(105);
        }
      });
    });
  }
});
