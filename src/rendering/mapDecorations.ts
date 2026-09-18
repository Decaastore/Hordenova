import { WORLD_SIZE } from "@/config/gameBalance";
import { ENEMY_PATH, TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { distanceToPolyline, distance, type Vector2 } from "@/utils/geometry";
import type { BiomeDefinition } from "./biomes";

/**
 * Purely decorative scenery — trees, rocks, roots, ruins, crystals, grass,
 * flowers, water, torches — scattered over the one shared road/slot layout
 * every biome plays on (no gameplay meaning, no engine/config dependency
 * beyond reading the already-approved path/slot geometry to avoid
 * decorating on top of them).
 *
 * BIOME IDENTITY PASS — this used to generate ONE fixed layout from a
 * single hardcoded `ACTIVE_BIOME` (Ancient Forest) constant, so every
 * biome's own `decorationWeights` (each biome file already authors a
 * genuinely distinct kind/count mix — see biomes/*.ts) was dead data: every
 * stage scattered Ancient Forest's exact tree/rock/root layout, just
 * recolored by palette. `getMapDecorations(biome)` now generates (and
 * memoizes) a real layout PER biome, so the composition itself — not just
 * the color — differs stage to stage. Still deterministic per biome (a
 * biome-specific seed, not `Math.random()`) so a reload never reshuffles
 * the scenery underfoot.
 */

export type DecorationKind =
  | "TREE"
  | "ROCK"
  | "ROOT"
  | "RUIN"
  | "CRYSTAL"
  | "GRASS"
  | "FLOWER"
  | "WATER"
  | "TORCH";

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

// Pushed out further than a purely "don't overlap" minimum would require:
// the goal is to keep the road + tower corridors visually clear so the
// composition reads as path-and-defenses first, with scenery concentrated
// toward the map's outer margins framing it — not sprinkled everywhere.
const MIN_DISTANCE_FROM_PATH = 50;
const MIN_DISTANCE_FROM_SLOT = 40;

function isClearOfPlayArea(point: Vector2): boolean {
  if (distanceToPolyline(point, ENEMY_PATH) < MIN_DISTANCE_FROM_PATH) return false;
  for (const slot of TOWER_SLOTS) {
    if (distance(point, slot.position) < MIN_DISTANCE_FROM_SLOT) return false;
  }
  return true;
}

const ALL_DECORATION_KINDS: readonly DecorationKind[] = [
  "TREE",
  "ROCK",
  "ROOT",
  "RUIN",
  "CRYSTAL",
  "GRASS",
  "FLOWER",
  "WATER",
  "TORCH",
];

/** Deterministic string hash — turns a biome id into its own seed offset so two biomes never draw from the same point in the rng stream (e.g. two biomes that both skip TREE would otherwise generate byte-identical ROCK positions with the shared base seed). */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

function generate(biome: BiomeDefinition): Decoration[] {
  const rng = mulberry32(20260831 + hashSeed(biome.id));
  const decorations: Decoration[] = [];

  const counts: Record<DecorationKind, number> = Object.fromEntries(
    ALL_DECORATION_KINDS.map((kind) => [kind, biome.decorationWeights[kind] ?? 0]),
  ) as Record<DecorationKind, number>;

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

const decorationCache = new Map<string, readonly Decoration[]>();

/** Per-biome decoration layout, generated once per biome id and memoized (never per-frame, never per-render) — see the file header for why this replaced a single fixed `MAP_DECORATIONS` constant. */
export function getMapDecorations(biome: BiomeDefinition): readonly Decoration[] {
  let cached = decorationCache.get(biome.id);
  if (!cached) {
    cached = generate(biome);
    decorationCache.set(biome.id, cached);
  }
  return cached;
}
