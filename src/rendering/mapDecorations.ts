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

/**
 * FLOATING ISLANDS WATER BUG — ROOT CAUSE. Both clearance checks above only
 * ever compared a decoration's PLACEMENT POINT to the path/slots — they
 * never accounted for the decoration's own drawn SIZE. `drawWaterPond`
 * (rendering/MapRenderer.ts) draws an ellipse up to `34 * scale` wide, and
 * `scale` here ranges up to 1.6 (see `generate` below) — a footprint of up
 * to ~54px, bigger than `MIN_DISTANCE_FROM_PATH` (50) itself. A pond's
 * CENTER could legally sit exactly 50px from the path and still visually
 * spill halfway across it — "água atravessa terreno" / water rendering on
 * top of tower slots. Worse, nothing here ever compared one decoration's
 * placement against any OTHER already-placed decoration of any kind — two
 * large WATER ponds (Floating Isles authors WATER: 8, one of this pack's
 * highest counts, only Leviathan Coast's 14 is bigger) could and did land
 * with fully overlapping ellipses, reading as "múltiplos planos de água" /
 * "lagos duplicados" stacked on each other.
 *
 * Fix: every kind gets an approximate visual footprint radius (its own
 * `scale` factored in, exactly like drawWaterPond already does internally),
 * and BOTH checks below now require that footprint to clear the play area
 * / clear every other already-placed decoration — not just the bare point.
 */
const DECORATION_FOOTPRINT_RADIUS: Record<DecorationKind, number> = {
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

function isClearOfPlayArea(point: Vector2, footprint: number): boolean {
  if (distanceToPolyline(point, ENEMY_PATH) < MIN_DISTANCE_FROM_PATH + footprint) return false;
  for (const slot of TOWER_SLOTS) {
    if (distance(point, slot.position) < MIN_DISTANCE_FROM_SLOT + footprint) return false;
  }
  return true;
}

/**
 * Prevents one decoration's drawn shape from visually overlapping another's
 * — the direct fix for "água aparece uma sobre a outra" / duplicate-looking
 * lakes. The 0.8 factor allows a little natural closeness (a rock nudged
 * right up against a pond's edge still reads fine) without permitting the
 * near-total overlap the bug reports described.
 */
function overlapsExistingDecoration(point: Vector2, footprint: number, placed: readonly Decoration[]): boolean {
  for (const other of placed) {
    const otherFootprint = DECORATION_FOOTPRINT_RADIUS[other.kind] * other.scale;
    if (distance(point, other.position) < (footprint + otherFootprint) * 0.8) return true;
  }
  return false;
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
      const scale = 0.7 + rng() * 0.9;
      const footprint = DECORATION_FOOTPRINT_RADIUS[kind] * scale;
      if (!isClearOfPlayArea(point, footprint)) continue;
      if (overlapsExistingDecoration(point, footprint, decorations)) continue;

      decorations.push({
        kind,
        position: point,
        scale,
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
