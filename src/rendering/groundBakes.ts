import type { BiomeDefinition } from "./biomes";
import type { DecorationKind } from "./mapDecorations";
import { getMapDecorations } from "./mapDecorations";
import type { VisibleBounds } from "./MapRenderer";
import { getMapLayout } from "@/data/mapLayouts";

/** Bumped whenever the baked images change, so browsers never mix new code with an old cached image. */
const BAKE_VERSION = 6;
/** Slot index (index % 6) whose baked platform is the glowing rune altar — see MapRenderer's slot style order. */

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
  // 10-biome expansion
  DWARVEN_UNDERCITY: bake("dwarven_undercity", ["ROCK", "RUIN"], "regions"),
  COLOSSUS_GRAVEYARD: bake("colossus_graveyard", ["ROCK", "ROOT", "RUIN", "GRASS"], "regions"),
  FLOATING_ISLES: bake("floating_isles", ["TREE", "ROCK", "GRASS", "FLOWER", "WATER"], "regions"),
  LOST_SUN_TEMPLE: bake("lost_sun_temple", ["ROCK", "RUIN"], "regions"),
  CRYSTAL_SEA: bake("crystal_sea", ["ROCK", "WATER"], "global"),
  ABYSSAL_FORTRESS: bake("abyssal_fortress", ["ROCK", "RUIN"], "regions"),
  ASHEN_VALLEY: bake("ashen_valley", ["ROCK", "ROOT", "RUIN", "GRASS"], "global"),
  MOON_GARDENS: bake("moon_gardens", ["TREE", "ROOT", "GRASS", "FLOWER"], "global"),
  DEFILED_CATHEDRAL: bake("defiled_cathedral", ["ROCK", "RUIN"], "regions"),
  LEVIATHAN_COAST: bake("leviathan_coast", ["ROCK", "RUIN", "GRASS", "WATER"], "regions"),
};

export interface LoadedGroundBake {
  def: GroundBakeDef;
  ground: HTMLImageElement | HTMLCanvasElement;
  emissive: HTMLImageElement | HTMLCanvasElement | null;
  skipKinds: ReadonlySet<DecorationKind>;
}

const imgW = (i: HTMLImageElement | HTMLCanvasElement) => ("naturalWidth" in i ? i.naturalWidth : i.width);
const imgH = (i: HTMLImageElement | HTMLCanvasElement) => ("naturalHeight" in i ? i.naturalHeight : i.height);

const poolless = new Map<string, LoadedGroundBake>();
/**
 * The same baked ground with its painted lava pools taken out — used while the hybrid 3D layer
 * builds the pools itself, so the 3D pool never sits on top of the old painted one. Each pool is
 * covered with a patch of the ground right next to it (blended in with a soft round edge), and its
 * glow is erased from the emissive layer. Made once per map.
 */
export function withoutLavaPools(bake: LoadedGroundBake, biome: BiomeDefinition): LoadedGroundBake {
  const hit = poolless.get(biome.id);
  if (hit) return hit;
  const { def } = bake;
  const pools = getMapDecorations(biome).filter((d) => d.kind === "WATER");
  if (!pools.length || typeof document === "undefined") return bake;
  const W = def.x1 - def.x0, H = def.y1 - def.y0;
  const gw = imgW(bake.ground), gh = imgH(bake.ground);
  const kx = gw / W, ky = gh / H;
  const ground = document.createElement("canvas");
  ground.width = gw;
  ground.height = gh;
  const g = ground.getContext("2d")!;
  g.drawImage(bake.ground, 0, 0);
  const road = getMapLayout(biome.id).path;
  const nearRoad = (x: number, y: number, r: number) => {
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1]!, b = road[i]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(a.x + dx * t - x, a.y + dy * t - y) < r + 34) return true;
    }
    return false;
  };
  const tmp = document.createElement("canvas");
  for (const d of pools) {
    const R = 34 * 1.55 * d.scale;
    // a donor patch of plain ground beside the pool: clear of the road and of other pools
    let best: { x: number; y: number } | null = null;
    for (let i = 0; i < 16 && !best; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = d.position.x + Math.cos(a) * R * 2.3, y = d.position.y + Math.sin(a) * R * 2.3;
      if (x - R < def.x0 || y - R < def.y0 || x + R > def.x1 || y + R > def.y1) continue;
      if (nearRoad(x, y, R)) continue;
      if (pools.some((o) => o !== d && Math.hypot(o.position.x - x, o.position.y - y) < R + 34 * 1.55 * o.scale)) continue;
      best = { x, y };
    }
    if (!best) best = { x: d.position.x + R * 2.3, y: d.position.y };
    const pw = Math.ceil(R * 2 * kx), ph = Math.ceil(R * 2 * ky);
    tmp.width = pw;
    tmp.height = ph;
    const t = tmp.getContext("2d")!;
    t.clearRect(0, 0, pw, ph);
    t.drawImage(bake.ground, (best.x - R - def.x0) * kx, (best.y - R - def.y0) * ky, pw, ph, 0, 0, pw, ph);
    // soft round edge so the patch melts into what is round it
    t.globalCompositeOperation = "destination-in";
    const gr = t.createRadialGradient(pw / 2, ph / 2, Math.min(pw, ph) * 0.3, pw / 2, ph / 2, Math.min(pw, ph) / 2);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    t.fillStyle = gr;
    t.fillRect(0, 0, pw, ph);
    t.globalCompositeOperation = "source-over";
    g.save();
    g.translate((d.position.x - def.x0) * kx, (d.position.y - def.y0) * ky);
    g.drawImage(tmp, -pw / 2, -ph / 2);
    g.restore();
  }
  let emissive: HTMLCanvasElement | null = null;
  if (bake.emissive) {
    const ew = imgW(bake.emissive), eh = imgH(bake.emissive);
    emissive = document.createElement("canvas");
    emissive.width = ew;
    emissive.height = eh;
    const e = emissive.getContext("2d")!;
    e.drawImage(bake.emissive, 0, 0);
    e.globalCompositeOperation = "destination-out";
    const ex = ew / W, ey = eh / H;
    for (const d of pools) {
      const R = 34 * 1.7 * d.scale;
      const cx = (d.position.x - def.x0) * ex, cy = (d.position.y - def.y0) * ey;
      const gr = e.createRadialGradient(cx, cy, R * ex * 0.55, cx, cy, R * ex);
      gr.addColorStop(0, "rgba(0,0,0,1)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      e.fillStyle = gr;
      e.fillRect(cx - R * ex, cy - R * ey, R * 2 * ex, R * 2 * ey);
    }
  }
  const out: LoadedGroundBake = { def, ground, emissive, skipKinds: bake.skipKinds };
  poolless.set(biome.id, out);
  return out;
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
    // Rune altars glow on their own pulse.
    getMapLayout(biome.id).sites.forEach((slot, i) => {
      if (slot.trait === "RUNE_ALTAR") regions!.push({ x: slot.position.x, y: slot.position.y + 4.5, r: 30, phase: i * 2.1 });
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
  const { def, ground } = bake;
  // Anything beyond the baked rectangle (very wide screens) gets the biome's shadowed ground tone.
  ctx.fillStyle = biome.palette.groundShadowed;
  ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  const w = def.x1 - def.x0;
  const h = def.y1 - def.y0;
  ctx.drawImage(ground, def.x0, def.y0, w, h);

  drawGroundEmissive(ctx, bake, biome, timeMs, 1);
}

/**
 * The baked ground's glowing parts (lava, ice, crystals, veins), added on
 * top with a slow pulse. `gain` scales it — the night lighting pass calls
 * this again so lava and crystals keep shining through the dark.
 */
export function drawGroundEmissive(ctx: CanvasRenderingContext2D, bake: LoadedGroundBake, biome: BiomeDefinition, timeMs: number, gain: number): void {
  const { def, emissive } = bake;
  if (!emissive || gain <= 0) return;
  const w = def.x1 - def.x0;
  const h = def.y1 - def.y0;
  const sx = imgW(emissive) / w;
  const sy = imgH(emissive) / h;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (def.glow === "global") {
    ctx.globalAlpha = gain * (0.1 + 0.3 * (0.5 + 0.5 * Math.sin(timeMs / 2100) * (0.7 + 0.3 * Math.sin(timeMs / 730))));
    ctx.drawImage(emissive, def.x0, def.y0, w, h);
    ctx.restore();
    return;
  }
  for (const g of glowRegions(biome)) {
    // Slow, uneven breathing: two incommensurate sines so it never looks like a metronome.
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 1300 + g.phase) * (0.7 + 0.3 * Math.sin(timeMs / 470 + g.phase * 2));
    ctx.globalAlpha = Math.min(1, gain * (0.15 + 0.45 * pulse));
    const x = Math.max(def.x0, g.x - g.r);
    const y = Math.max(def.y0, g.y - g.r);
    const x2 = Math.min(def.x1, g.x + g.r);
    const y2 = Math.min(def.y1, g.y + g.r);
    if (x2 <= x || y2 <= y) continue;
    ctx.drawImage(emissive, (x - def.x0) * sx, (y - def.y0) * sy, (x2 - x) * sx, (y2 - y) * sy, x, y, x2 - x, y2 - y);
  }
  ctx.restore();
}
