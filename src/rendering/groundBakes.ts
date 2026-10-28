import type { BiomeDefinition } from "./biomes";
import type { DecorationKind } from "./mapDecorations";
import { getMapDecorations } from "./mapDecorations";
import type { VisibleBounds } from "./MapRenderer";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

/** Bumped whenever the baked images change, so browsers never mix new code with an old cached image. */
const BAKE_VERSION = 4;
/** Slot index (index % 6) whose baked platform is the glowing rune altar — see MapRenderer's slot style order. */
const ALTAR_SLOT_STYLE_INDEX = 4;

/**
 * Pre-rendered ("baked") ground for a biome: the whole terrain — ground
 * material, the worn road, and the static scenery at the game's own
 * decoration positions (rocks, ruins, lava fissures/pools) — lit and
 * shadowed offline into one image, plus an emissive layer (only the glowing
 * parts, black elsewhere) that is added on top with a slow pulse so lava
 * still breathes. When a biome has a bake, the 2D ground/road/static-scenery
 * drawing and the 3D terrain layer both stand down for it; anything animated
 * (torches, crystals, the portal, the castle) still draws live. The tower
 * build platforms are baked in too; only their highlight ring is live.
 *
 * Images live in public/sprites/ground/ and load lazily the first time the
 * biome is shown; until then the old drawing is used.
 */
interface GroundBakeDef {
  ground: string;
  emissive?: string;
  /** How the emissive layer pulses: per lava/ice/water region, or the whole map breathing slowly (glowing veins everywhere). */
  glow: "none" | "regions" | "global";
  /** World-space rectangle the image covers (larger than the 1000x600 world so letterbox margins are filled too). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Decoration kinds already painted into the image (skipped in the live 2D pass). */
  bakedKinds: readonly DecorationKind[];
}

const EXTENT = { x0: -200, y0: -120, x1: 1200, y1: 720 } as const;

function bake(file: string, bakedKinds: DecorationKind[], glow: GroundBakeDef["glow"] = "none"): GroundBakeDef {
  return {
    ground: `sprites/ground/${file}.webp`,
    emissive: glow === "none" ? undefined : `sprites/ground/${file}_glow.webp`,
    glow,
    ...EXTENT,
    bakedKinds,
  };
}

const GROUND_BAKES: Record<string, GroundBakeDef> = {
  ANCIENT_FOREST: bake("ancient_forest", ["TREE", "ROCK", "ROOT", "RUIN", "GRASS", "FLOWER", "WATER"], "regions"),
  VOLCANIC_WASTES: bake("volcanic_wastes", ["ROCK", "RUIN", "FISSURE", "WATER"], "regions"),
  FROZEN_TUNDRA: bake("frozen_tundra", ["ROCK", "RUIN", "GRASS", "FISSURE"], "regions"),
  CURSED_DESERT: bake("cursed_desert", ["ROCK", "RUIN", "GRASS"], "regions"),
  DARK_RUINS: bake("dark_ruins", ["ROCK", "RUIN", "GRASS"], "regions"),
  ABYSS: bake("abyss", ["ROCK", "RUIN"], "global"),
};

export interface LoadedGroundBake {
  def: GroundBakeDef;
  ground: HTMLImageElement;
  emissive: HTMLImageElement | null;
  skipKinds: ReadonlySet<DecorationKind>;
}

const cache = new Map<string, { ground: HTMLImageElement; emissive: HTMLImageElement | null; ready: boolean; skip: ReadonlySet<DecorationKind> }>();

function loadImage(src: string, onLoad: () => void): HTMLImageElement {
  const img = new Image();
  img.decoding = "async";
  img.onload = onLoad;
  img.src = `${import.meta.env.BASE_URL}${src}?v=${BAKE_VERSION}`;
  return img;
}

/** True when the biome has a baked ground at all (static — doesn't depend on whether it has finished loading). */
export function hasGroundBake(biomeId: string): boolean {
  return biomeId in GROUND_BAKES;
}

/** The biome's baked ground once its images have loaded, else null (and kicks off the load). */
export function getGroundBake(biomeId: string): LoadedGroundBake | null {
  const def = GROUND_BAKES[biomeId];
  if (!def || typeof Image === "undefined") return null;
  let entry = cache.get(biomeId);
  if (!entry) {
    let pending = def.emissive ? 2 : 1;
    const done = () => {
      pending -= 1;
      if (pending === 0 && entry) entry.ready = true;
    };
    entry = {
      ground: loadImage(def.ground, done),
      emissive: def.emissive ? loadImage(def.emissive, done) : null,
      ready: false,
      skip: new Set(def.bakedKinds),
    };
    cache.set(biomeId, entry);
  }
  if (!entry.ready) return null;
  return { def, ground: entry.ground, emissive: entry.emissive, skipKinds: entry.skip };
}

/** Per-region glow pulse: each lava pool/fissure breathes on its own phase so the map never flashes in unison. */
const glowRegionCache = new Map<string, { x: number; y: number; r: number; phase: number }[]>();

function glowRegions(biome: BiomeDefinition): { x: number; y: number; r: number; phase: number }[] {
  let regions = glowRegionCache.get(biome.id);
  if (!regions) {
    regions = getMapDecorations(biome)
      .filter((d) => d.kind === "WATER" || d.kind === "FISSURE")
      .map((d, i) => ({
        x: d.position.x,
        y: d.position.y,
        r: (d.kind === "WATER" ? 34 * 1.7 : 46 * 0.75) * d.scale,
        phase: i * 1.37 + d.position.x * 0.01,
      }));
    TOWER_SLOTS.forEach((slot, i) => {
      if (i % 6 === ALTAR_SLOT_STYLE_INDEX) regions!.push({ x: slot.position.x, y: slot.position.y + 4.5, r: 30, phase: i * 2.1 });
    });
    glowRegionCache.set(biome.id, regions);
  }
  return regions;
}

export function drawBakedGround(
  ctx: CanvasRenderingContext2D,
  bake: LoadedGroundBake,
  biome: BiomeDefinition,
  bounds: VisibleBounds,
  timeMs: number,
): void {
  const { def, ground, emissive } = bake;
  // Anything beyond the baked rectangle (very wide screens) gets the biome's shadowed ground tone.
  ctx.fillStyle = biome.palette.groundShadowed;
  ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  const w = def.x1 - def.x0;
  const h = def.y1 - def.y0;
  ctx.drawImage(ground, def.x0, def.y0, w, h);

  if (!emissive) return;
  const sx = emissive.naturalWidth / w;
  const sy = emissive.naturalHeight / h;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (def.glow === "global") {
    ctx.globalAlpha = 0.1 + 0.3 * (0.5 + 0.5 * Math.sin(timeMs / 2100) * (0.7 + 0.3 * Math.sin(timeMs / 730)));
    ctx.drawImage(emissive, def.x0, def.y0, w, h);
    ctx.restore();
    return;
  }
  for (const g of glowRegions(biome)) {
    // Slow, uneven breathing: two incommensurate sines so it never looks like a metronome.
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 1300 + g.phase) * (0.7 + 0.3 * Math.sin(timeMs / 470 + g.phase * 2));
    ctx.globalAlpha = 0.15 + 0.45 * pulse;
    const x = Math.max(def.x0, g.x - g.r);
    const y = Math.max(def.y0, g.y - g.r);
    const x2 = Math.min(def.x1, g.x + g.r);
    const y2 = Math.min(def.y1, g.y + g.r);
    if (x2 <= x || y2 <= y) continue;
    ctx.drawImage(emissive, (x - def.x0) * sx, (y - def.y0) * sy, (x2 - x) * sx, (y2 - y) * sy, x, y, x2 - x, y2 - y);
  }
  ctx.restore();
}
