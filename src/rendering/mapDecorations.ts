import { WORLD_SIZE } from "@/config/gameBalance";
import { fortressAnchorFor, getMapLayout, type MapLayout } from "@/data/mapLayouts";
import { distanceToPolyline, distance, type Vector2 } from "@/utils/geometry";
import type { BiomeDefinition } from "./biomes";
import { BAKED_DECORATIONS, BAKED_KINDS } from "./bakedDecorations";
import { PATH_VISUAL_WIDTH } from "@/config/gameBalance";
import { CITY_PLOT_RADIUS, getCityPlots } from "@/data/cityPlots";

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
  | "TORCH"
  /** Glowing ground crack in the biome's accent color (lava seams, frost fractures) — 2D-only, drawn flat on the terrain. */
  | "FISSURE";

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
  FISSURE: 24,
};

function isClearOfPlayArea(point: Vector2, footprint: number, layout: MapLayout): boolean {
  if (distanceToPolyline(point, layout.path) < MIN_DISTANCE_FROM_PATH + footprint) return false;
  // The castle grounds and the rift stay clear too (castles can sit anywhere on the new maps).
  const castle = fortressAnchorFor(layout.path).position;
  const rift = layout.path[0]!;
  if (distance(point, castle) < 100 + footprint || distance(point, rift) < 55 + footprint) return false;
  for (const slot of layout.sites) {
    if (distance(point, slot.position) < MIN_DISTANCE_FROM_SLOT + footprint) return false;
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
  "FISSURE",
];

/** Deterministic string hash — turns a biome id into its own seed offset so two biomes never draw from the same point in the rng stream (e.g. two biomes that both skip TREE would otherwise generate byte-identical ROCK positions with the shared base seed). */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

/** Kinds that gather into clusters (outcrops, thickets, crystal beds) instead of spreading evenly. */
const CLUSTERED_KINDS: ReadonlySet<DecorationKind> = new Set(["ROCK", "CRYSTAL", "GRASS", "FLOWER", "ROOT", "TREE", "RUIN"]);
const CLUSTER_ANCHOR_COUNT = 7;
const CLUSTER_SPREAD = 46;

/** Cluster centers, each the more-peripheral of two random candidates — so clusters lean toward the map edges and frame the play area. */
function pickClusterAnchors(rng: () => number): Vector2[] {
  const cx = WORLD_SIZE.width / 2;
  const cy = WORLD_SIZE.height / 2;
  const peripheral = (p: Vector2) => Math.abs(p.x - cx) / cx + Math.abs(p.y - cy) / cy;
  const anchors: Vector2[] = [];
  for (let i = 0; i < CLUSTER_ANCHOR_COUNT; i++) {
    const a = { x: rng() * WORLD_SIZE.width, y: rng() * WORLD_SIZE.height };
    const b = { x: rng() * WORLD_SIZE.width, y: rng() * WORLD_SIZE.height };
    anchors.push(peripheral(a) >= peripheral(b) ? a : b);
  }
  return anchors;
}

function samplePlacement(kind: DecorationKind, rng: () => number, anchors: readonly Vector2[]): Vector2 {
  if (CLUSTERED_KINDS.has(kind) && rng() < 0.75) {
    const anchor = anchors[Math.floor(rng() * anchors.length)]!;
    // Approximate gaussian (sum of uniforms) around the anchor.
    const gx = (rng() + rng() + rng() - 1.5) * CLUSTER_SPREAD * 1.4;
    const gy = (rng() + rng() + rng() - 1.5) * CLUSTER_SPREAD;
    return {
      x: Math.max(0, Math.min(WORLD_SIZE.width, anchor.x + gx)),
      y: Math.max(0, Math.min(WORLD_SIZE.height, anchor.y + gy)),
    };
  }
  return { x: rng() * WORLD_SIZE.width, y: rng() * WORLD_SIZE.height };
}

/**
 * ONE SPACING STANDARD (owner's call, Nov 2026: "sem encostar em rocha… tudo
 * realista de um só padrão"). Every piece's real drawn size on the map —
 * not the looser placement footprint above — and a fixed strip of free
 * ground that must separate any two pieces, and any piece from the road,
 * a build site, the castle and the rift.
 */
export const DRAWN_RADIUS: Record<DecorationKind, number> = {
  TREE: 24,
  ROCK: 16,
  ROOT: 12,
  RUIN: 22,
  CRYSTAL: 15,
  GRASS: 6,
  FLOWER: 5,
  WATER: 52,
  TORCH: 10,
  FISSURE: 26,
};
export const FREE_GROUND_GAP = 6;
/** Build sites' platform radius and the castle body's radius on the map (world units). */
const SITE_RADIUS = 30;
const CASTLE_RADIUS = 80;
const RIFT_RADIUS = 40;

export const drawnRadius = (d: Pick<Decoration, "kind" | "scale">) => DRAWN_RADIUS[d.kind] * d.scale;

/** True when a piece of scenery would sit on (or touch) the road, a build site, the castle or the rift. */
export function touchesPlayArea(point: Vector2, radius: number, layout: MapLayout): boolean {
  const gap = radius + FREE_GROUND_GAP;
  if (distanceToPolyline(point, layout.path) < PATH_VISUAL_WIDTH / 2 + 6 + gap) return true;
  if (distance(point, fortressAnchorFor(layout.path).position) < CASTLE_RADIUS + gap) return true;
  if (distance(point, layout.path[0]!) < RIFT_RADIUS + gap) return true;
  return layout.sites.some((slot) => distance(point, slot.position) < SITE_RADIUS + gap);
}

/** True when two pieces would touch (closer than both their drawn sizes plus the free strip). */
function touchesAny(point: Vector2, radius: number, placed: readonly Decoration[]): boolean {
  return placed.some((o) => distance(point, o.position) < radius + drawnRadius(o) + FREE_GROUND_GAP);
}

/** The scenery painted into this biome's ground image that the current roads, sites or castle now sit on — painted over by groundBakes.ts. */
export function getStrayBakedDecorations(biomeId: string): readonly Decoration[] {
  const baked = BAKED_DECORATIONS[biomeId];
  if (!baked) return [];
  const layout = getMapLayout(biomeId);
  return baked.filter(
    (d) => (touchesPlayArea(d.position, drawnRadius(d) * 0.6, layout) || !isClearOfPlayArea(d.position, DECORATION_FOOTPRINT_RADIUS[d.kind] * d.scale, layout)),
  );
}

/** The scenery painted into this biome's ground image that stays on the map (what the roads, sites and castle now cover is painted over). */
export function getPaintedScenery(biomeId: string): readonly Decoration[] {
  const stray = new Set(getStrayBakedDecorations(biomeId));
  return (BAKED_DECORATIONS[biomeId] ?? []).filter((d) => !stray.has(d));
}

function generate(biome: BiomeDefinition): Decoration[] {
  // Scenery keeps clear of THIS biome's own road and build sites.
  const layout = getMapLayout(biome.id);
  const rng = mulberry32(20260831 + hashSeed(biome.id));
  const bakedKinds = new Set(BAKED_KINDS[biome.id] ?? []);
  // what is painted into the ground image stays exactly where it is painted (minus what had to be painted over)
  const decorations: Decoration[] = [...getPaintedScenery(biome.id)];
  // the city's ground stays free too: its buildings rise there as the Season goes on
  const plots = getCityPlots(layout).map((p) => p.position);

  const counts: Record<DecorationKind, number> = Object.fromEntries(
    ALL_DECORATION_KINDS.map((kind) => [kind, bakedKinds.has(kind) ? 0 : (biome.decorationWeights[kind] ?? 0)]),
  ) as Record<DecorationKind, number>;

  // VISUAL POLISH (fase 260 feedback) — "parece confete": most props
  // gather into a handful of per-biome clusters biased toward the map's
  // outer margins, leaving breathing room where the fighting happens.
  // Torches line the trail. Everything placed here keeps the one spacing
  // standard above from the road, the sites, the castle, the rift, the
  // painted scenery and each other. Still fully deterministic per biome.
  const anchors = pickClusterAnchors(rng);

  (Object.entries(counts) as [DecorationKind, number][]).forEach(([kind, count]) => {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 80) {
      attempts++;
      const point = samplePlacement(kind, rng, anchors);
      const scale = 0.7 + rng() * 0.9;
      const rotation = rng() * Math.PI * 2;
      const variant = Math.floor(rng() * 3);
      const footprint = DECORATION_FOOTPRINT_RADIUS[kind] * scale;
      const radius = DRAWN_RADIUS[kind] * scale;
      if (!isClearOfPlayArea(point, footprint, layout) || touchesPlayArea(point, radius, layout)) continue;
      if (kind === "TORCH" && distanceToPolyline(point, layout.path) > MIN_DISTANCE_FROM_PATH + footprint + 34) continue;
      if (touchesAny(point, radius, decorations)) continue;
      if (plots.some((p) => distance(point, p) < CITY_PLOT_RADIUS + radius + FREE_GROUND_GAP)) continue;
      decorations.push({ kind, position: point, scale, rotation, variant });
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
