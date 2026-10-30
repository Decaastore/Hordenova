import type { Vector2 } from "@/utils/geometry";
import { HIGH_GROUND_RANGE_MULT, RUNE_ALTAR_DAMAGE_MULT, type BuildSite, type MapLayout, type SiteTrait } from "@/data/mapLayouts";
import { getTowerStats, type TowerInstance } from "@/entities/Tower";

/**
 * MAP DEPLOYMENT — the shared math behind choosing where towers stand on a
 * map: how much of the road a spot reaches ("coverage"), and the automatic
 * arrangement used when the run moves onto a new map (the player can then
 * rearrange freely before the phase starts — see GameEngine's DEPLOY phase).
 */

const SAMPLE_STEP = 6;
const sampleCache = new Map<string, Vector2[]>();

/** The road resampled at an even spacing (cached per layout). */
export function roadSamples(layout: MapLayout): readonly Vector2[] {
  let samples = sampleCache.get(layout.id);
  if (samples) return samples;
  samples = [];
  const path = layout.path;
  let carry = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    let d = carry;
    while (d <= seg) {
      const t = seg === 0 ? 0 : d / seg;
      samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += SAMPLE_STEP;
    }
    carry = d - seg;
  }
  samples.push(path[path.length - 1]!);
  sampleCache.set(layout.id, samples);
  return samples;
}

export interface RoadCoverage {
  /** 0..1 share of the whole road within range. */
  fraction: number;
  /** Index ranges into roadSamples(layout) that are within range — for drawing the covered stretches. */
  runs: [number, number][];
}

/** How much of `layout`'s road a tower at `position` with `range` reaches. */
export function roadCoverage(layout: MapLayout, position: Vector2, range: number): RoadCoverage {
  const samples = roadSamples(layout);
  const r2 = range * range;
  const runs: [number, number][] = [];
  let inside = 0;
  let runStart = -1;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    const hit = (s.x - position.x) ** 2 + (s.y - position.y) ** 2 <= r2;
    if (hit) {
      inside++;
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      runs.push([runStart, i - 1]);
      runStart = -1;
    }
  }
  if (runStart >= 0) runs.push([runStart, samples.length - 1]);
  return { fraction: samples.length ? inside / samples.length : 0, runs };
}

/** A tower's range/damage as it would be on a given kind of site (its current site's bonus removed first). */
function statsOn(tower: TowerInstance, trait: SiteTrait): { range: number; damageMult: number } {
  const base = getTowerStats({ ...tower, siteTrait: "NONE" });
  return {
    range: base.range * (trait === "HIGH_GROUND" ? HIGH_GROUND_RANGE_MULT : 1),
    damageMult: trait === "RUNE_ALTAR" ? RUNE_ALTAR_DAMAGE_MULT : 1,
  };
}

/** Value of putting `tower` on `site`: road it covers there, scaled by any damage bonus. */
export function placementValue(tower: TowerInstance, site: BuildSite, layout: MapLayout): number {
  const { range, damageMult } = statsOn(tower, site.trait);
  return roadCoverage(layout, site.position, range).fraction * damageMult;
}

/**
 * Suggested arrangement of `towers` on `layout`: strongest towers first
 * (level, then range), each onto the free site where it covers the most
 * road (bonuses included). Deterministic. Returns towerId -> siteId.
 */
export function autoArrange(towers: readonly TowerInstance[], layout: MapLayout): Map<string, string> {
  const order = [...towers].sort((a, b) => b.level - a.level || getTowerStats(b).range - getTowerStats(a).range || a.id.localeCompare(b.id));
  const free = new Set(layout.sites.map((s) => s.id));
  const result = new Map<string, string>();
  for (const tower of order) {
    let best: BuildSite | null = null;
    let bestValue = -1;
    for (const site of layout.sites) {
      if (!free.has(site.id)) continue;
      const value = placementValue(tower, site, layout);
      if (value > bestValue) {
        bestValue = value;
        best = site;
      }
    }
    if (!best) break;
    free.delete(best.id);
    result.set(tower.id, best.id);
  }
  return result;
}
