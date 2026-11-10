import { WORLD_SIZE } from "@/config/gameBalance";
import { CITY_BUILDINGS, type CityBuildingId } from "@/config/city";
import { fortressAnchorFor, type MapLayout } from "./mapLayouts";
import { distance, type Vector2 } from "@/utils/geometry";

/**
 * Where each city building stands on a map (config/city.ts). Plots are found
 * around the castle, nearest first, on ground that keeps clear of the road,
 * the build sites (and the towers standing on them), the rift and the castle
 * itself — so the city never covers anything the player has to see or click.
 * Deterministic per layout, computed once.
 */

/** A building's sprite rises this far above its plot (world units) — checked against the road and sites too. */
const SPRITE_RISE = 44;
const BASE_CLEAR_OF_ROAD = 50;
const CLEAR_OF_SITE = 62;
const PLOT_SPACING = 78;
const MAX_RADIUS = 440;

function distanceToSegment(p: Vector2, a: Vector2, b: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToPath(p: Vector2, path: readonly Vector2[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, distanceToSegment(p, path[i - 1]!, path[i]!));
  return best;
}

function isFreeGround(p: Vector2, layout: MapLayout, castle: Vector2, relax: number): boolean {
  const CLEAR_OF_ROAD = BASE_CLEAR_OF_ROAD - relax;
  if (p.x < 34 || p.x > WORLD_SIZE.width - 34 || p.y < 60 || p.y > WORLD_SIZE.height - 26) return false;
  const dx = p.x - castle.x;
  const dy = p.y - castle.y;
  if (Math.abs(dx) < 118 && dy > -190 && dy < 70) return false;
  if (distance(p, layout.path[0]!) < 95) return false;
  const top = { x: p.x, y: p.y - SPRITE_RISE };
  if (distanceToPath(p, layout.path) < CLEAR_OF_ROAD || distanceToPath(top, layout.path) < CLEAR_OF_ROAD - 10) return false;
  for (const site of layout.sites) {
    if (distance(p, site.position) < CLEAR_OF_SITE || distance(top, site.position) < CLEAR_OF_SITE - 8) return false;
  }
  return true;
}

export interface CityPlot {
  id: CityBuildingId;
  position: Vector2;
  /** Mirror the sprite so the buildings don't all face the same way. */
  flip: boolean;
}

const cache = new Map<string, readonly CityPlot[]>();

export function getCityPlots(layout: MapLayout): readonly CityPlot[] {
  const cached = cache.get(layout.id);
  if (cached) return cached;
  const castle = fortressAnchorFor(layout.path, 130).position;
  let chosen: Vector2[] = [];
  // Tight maps relax the clearances a little (never onto the road or a site) until all buildings fit.
  for (let relax = 0; relax <= 16 && chosen.length < CITY_BUILDINGS.length; relax += 4) {
    const candidates: Vector2[] = [];
    for (let r = 125; r <= MAX_RADIUS; r += 16) {
      const steps = Math.max(12, Math.round((2 * Math.PI * r) / 22));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const p = { x: Math.round(castle.x + Math.cos(a) * r), y: Math.round(castle.y + Math.sin(a) * r * 0.8) };
        if (isFreeGround(p, layout, castle, relax)) candidates.push(p);
      }
    }
    candidates.sort((a, b) => distance(a, castle) - distance(b, castle));
    chosen = [];
    for (const c of candidates) {
      if (chosen.length >= CITY_BUILDINGS.length) break;
      if (chosen.every((o) => Math.hypot(o.x - c.x, (o.y - c.y) * 1.3) >= PLOT_SPACING - relax)) chosen.push(c);
    }
  }
  const plots = chosen.map((position, i) => ({ id: CITY_BUILDINGS[i]!.id, position, flip: position.x > castle.x }));
  cache.set(layout.id, plots);
  return plots;
}
