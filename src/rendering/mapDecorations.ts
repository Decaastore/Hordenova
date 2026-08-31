import { WORLD_SIZE } from "@/config/gameBalance";
import { ENEMY_PATH, TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { distanceToPolyline, distance, type Vector2 } from "@/utils/geometry";

/**
 * Purely decorative scenery for Whispering Woods — trees, rocks, roots,
 * ruins, magic crystals. Generated once with a fixed seed so the layout is
 * stable across reloads (no gameplay meaning, no engine/config dependency
 * beyond reading the already-approved path/slot geometry to avoid
 * decorating on top of them).
 */

export type DecorationKind = "TREE" | "ROCK" | "ROOT" | "RUIN" | "CRYSTAL" | "GRASS";

export interface Decoration {
  kind: DecorationKind;
  position: Vector2;
  scale: number;
  rotation: number;
  variant: number;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN_DISTANCE_FROM_PATH = 26;
const MIN_DISTANCE_FROM_SLOT = 34;

function isClearOfPlayArea(point: Vector2): boolean {
  if (distanceToPolyline(point, ENEMY_PATH) < MIN_DISTANCE_FROM_PATH) return false;
  for (const slot of TOWER_SLOTS) {
    if (distance(point, slot.position) < MIN_DISTANCE_FROM_SLOT) return false;
  }
  return true;
}

function generate(): Decoration[] {
  const rng = mulberry32(20260831);
  const decorations: Decoration[] = [];

  const counts: Record<DecorationKind, number> = {
    TREE: 34,
    ROCK: 16,
    ROOT: 10,
    RUIN: 4,
    CRYSTAL: 6,
    GRASS: 22,
  };

  (Object.entries(counts) as [DecorationKind, number][]).forEach(([kind, count]) => {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 40) {
      attempts++;
      const point: Vector2 = {
        x: rng() * WORLD_SIZE.width,
        y: rng() * WORLD_SIZE.height,
      };
      if (!isClearOfPlayArea(point)) continue;

      decorations.push({
        kind,
        position: point,
        scale: 0.7 + rng() * 0.9,
        rotation: rng() * Math.PI * 2,
        variant: Math.floor(rng() * 3),
      });
      placed++;
    }
  });

  return decorations;
}

export const MAP_DECORATIONS: readonly Decoration[] = generate();
