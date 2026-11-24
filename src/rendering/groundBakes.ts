import type { BiomeDefinition } from "./biomes";
import type { DecorationKind } from "./mapDecorations";
import { drawnRadius, getMapDecorations, getStrayBakedDecorations } from "./mapDecorations";
import { BAKED_DECORATIONS, BAKED_SITES } from "./bakedDecorations";
import type { VisibleBounds } from "./MapRenderer";
import { getMapLayout } from "@/data/mapLayouts";
import type { Vector2 } from "@/utils/geometry";

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

const tidy = new Map<string, LoadedGroundBake>();

/**
 * The baked ground with the painted scenery that the newer roads, build sites
 * or castle now sit on painted over (rendering/mapDecorations.ts
 * getStrayBakedDecorations): each stray rock, ruin or tree is covered with a
 * soft round patch of plain ground taken from right beside it — ground that
 * is clear of the road, the sites and every other painted piece. Made once per map.
 */
export function withoutStrayScenery(bake: LoadedGroundBake, biome: BiomeDefinition): LoadedGroundBake {
  const hit = tidy.get(biome.id);
  if (hit) return hit;
  const layout = getMapLayout(biome.id);
  // painted build platforms whose site has since moved are painted over too
  const oldPads = (BAKED_SITES[biome.id] ?? []).filter((o) => !layout.sites.some((c) => Math.hypot(c.position.x - o.x, c.position.y - o.y) < 12));
  const stray: { position: { x: number; y: number }; R: number }[] = [
    ...getStrayBakedDecorations(biome.id).map((d) => ({ position: d.position, R: drawnRadius(d) * 1.35 + 6 })),
    ...oldPads.map((p) => ({ position: p, R: 34 })),
  ];
  if (!stray.length || typeof document === "undefined") {
    tidy.set(biome.id, bake);
    return bake;
  }
  const { def } = bake;
  const W = def.x1 - def.x0, H = def.y1 - def.y0;
  const gw = imgW(bake.ground), gh = imgH(bake.ground);
  const kx = gw / W, ky = gh / H;
  const ground = document.createElement("canvas");
  ground.width = gw;
  ground.height = gh;
  const g = ground.getContext("2d")!;
  g.drawImage(bake.ground, 0, 0);
  const painted = BAKED_DECORATIONS[biome.id] ?? [];
  const nearPath = (x: number, y: number, r: number) => {
    const road = layout.path;
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1]!, b = road[i]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(a.x + dx * t - x, a.y + dy * t - y) < r + 30) return true;
    }
    return false;
  };
  const cleanAt = (x: number, y: number, R: number) =>
    x - R >= def.x0 && y - R >= def.y0 && x + R <= def.x1 && y + R <= def.y1 &&
    !nearPath(x, y, R) &&
    !layout.sites.some((s) => Math.hypot(s.position.x - x, s.position.y - y) < R + 32) &&
    !painted.some((o) => Math.hypot(o.position.x - x, o.position.y - y) < R + drawnRadius(o) + 4) &&
    !oldPads.some((o) => Math.hypot(o.x - x, o.y - y) < R + 34);
  const tmp = document.createElement("canvas");
  for (const d of stray) {
    const R = d.R;
    let best: { x: number; y: number } | null = null;
    for (let ring = 2.2; ring <= 6 && !best; ring += 0.9) {
      for (let i = 0; i < 20 && !best; i++) {
        const a = (i / 20) * Math.PI * 2 + ring;
        const x = d.position.x + Math.cos(a) * R * ring, y = d.position.y + Math.sin(a) * R * ring;
        if (cleanAt(x, y, R)) best = { x, y };
      }
    }
    if (!best) continue;
    const pw = Math.ceil(R * 2 * kx), ph = Math.ceil(R * 2 * ky);
    tmp.width = pw;
    tmp.height = ph;
    const t = tmp.getContext("2d")!;
    t.clearRect(0, 0, pw, ph);
    t.drawImage(ground, (best.x - R - def.x0) * kx, (best.y - R - def.y0) * ky, pw, ph, 0, 0, pw, ph);
    t.globalCompositeOperation = "destination-in";
    const gr = t.createRadialGradient(pw / 2, ph / 2, Math.min(pw, ph) * 0.32, pw / 2, ph / 2, Math.min(pw, ph) / 2);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    t.fillStyle = gr;
    t.fillRect(0, 0, pw, ph);
    t.globalCompositeOperation = "source-over";
    // stamped twice, a little apart, so no hard copy of the donor shows
    for (const [ox, oy] of [[0, 0], [R * 0.25, -R * 0.15]] as const) {
      g.save();
      g.translate((d.position.x + ox - def.x0) * kx, (d.position.y + oy - def.y0) * ky);
      g.drawImage(tmp, -pw / 2, -ph / 2);
      g.restore();
    }
  }
  let emissive = bake.emissive;
  if (bake.emissive) {
    const ew = imgW(bake.emissive), eh = imgH(bake.emissive);
    const e2 = document.createElement("canvas");
    e2.width = ew;
    e2.height = eh;
    const e = e2.getContext("2d")!;
    e.drawImage(bake.emissive, 0, 0);
    e.globalCompositeOperation = "destination-out";
    const ex = ew / W, ey = eh / H;
    for (const d of stray) {
      const R = d.R;
      const cx = (d.position.x - def.x0) * ex, cy = (d.position.y - def.y0) * ey;
      const gr = e.createRadialGradient(cx, cy, R * ex * 0.5, cx, cy, R * ex);
      gr.addColorStop(0, "rgba(0,0,0,1)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      e.fillStyle = gr;
      e.fillRect(cx - R * ex, cy - R * ey, R * 2 * ex, R * 2 * ey);
    }
    emissive = e2;
  }
  const out: LoadedGroundBake = { def, ground, emissive, skipKinds: bake.skipKinds };
  tidy.set(biome.id, out);
  return out;
}

const roadless = new Map<string, LoadedGroundBake>();

/**
 * The baked ground with the stretch of road that used to run on past the
 * castle to the map's edge painted over (every road now ends at the castle
 * gate — data/mapLayouts.ts cutRoadAtGate). Plain ground from beside the
 * road is stamped along that stretch in soft round patches. Made once per map.
 */
export function withoutRoadPastGate(bake: LoadedGroundBake, biome: BiomeDefinition): LoadedGroundBake {
  const hit = roadless.get(biome.id);
  if (hit) return hit;
  const layout = getMapLayout(biome.id);
  const past = layout.roadPastGate;
  if ((past.length < 2 && layout.roadToGate.length < 2) || typeof document === "undefined") return bake;
  const { def } = bake;
  const W = def.x1 - def.x0, H = def.y1 - def.y0;
  const gw = imgW(bake.ground), gh = imgH(bake.ground);
  const kx = gw / W, ky = gh / H;
  const ground = document.createElement("canvas");
  ground.width = gw;
  ground.height = gh;
  const g = ground.getContext("2d")!;
  g.drawImage(bake.ground, 0, 0);

  const road = layout.path;
  if (past.length >= 2) {
  // the stretch to cover, carried on past the map's edge to the bake's own edge
  const a = past[past.length - 2]!, b = past[past.length - 1]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const pts = [...past, { x: b.x + dir.x * 260, y: b.y + dir.y * 260 }];
  const clearOfRoad = (x: number, y: number, r: number) => {
    for (let i = 1; i < road.length; i++) {
      const p = road[i - 1]!, q = road[i]!;
      const dx = q.x - p.x, dy = q.y - p.y;
      const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(p.x + dx * t - x, p.y + dy * t - y) < r + 36) return false;
    }
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]!, q = pts[i]!;
      const dx = q.x - p.x, dy = q.y - p.y;
      const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(p.x + dx * t - x, p.y + dy * t - y) < r + 30) return false;
    }
    return true;
  };

  const R = 50;
  const tmp = document.createElement("canvas");
  const pw = Math.ceil(R * 2 * kx), ph = Math.ceil(R * 2 * ky);
  tmp.width = pw;
  tmp.height = ph;
  const t = tmp.getContext("2d")!;
  // walk the stretch in short steps, starting a little inside the castle so no seam shows at the gate
  const stamps: { x: number; y: number; nx: number; ny: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!, q = pts[i]!;
    const segLen = Math.hypot(q.x - p.x, q.y - p.y);
    const n = Math.max(1, Math.ceil(segLen / 22));
    for (let k = 0; k <= n; k++) {
      const x = p.x + ((q.x - p.x) * k) / n, y = p.y + ((q.y - p.y) * k) / n;
      stamps.push({ x, y, nx: -(q.y - p.y) / (segLen || 1), ny: (q.x - p.x) / (segLen || 1) });
    }
  }
  for (const st of stamps) {
    let donor: { x: number; y: number } | null = null;
    for (const dist of [2.4, 3, 3.8, 4.6, 5.6, 7]) {
      for (const sgn of [1, -1]) {
        const x = st.x + st.nx * R * dist * sgn, y = st.y + st.ny * R * dist * sgn;
        if (x - R < def.x0 || y - R < def.y0 || x + R > def.x1 || y + R > def.y1) continue;
        if (!clearOfRoad(x, y, R)) continue;
        donor = { x, y };
        break;
      }
      if (donor) break;
    }
    if (!donor) continue;
    t.globalCompositeOperation = "source-over";
    t.clearRect(0, 0, pw, ph);
    t.drawImage(bake.ground, (donor.x - R - def.x0) * kx, (donor.y - R - def.y0) * ky, pw, ph, 0, 0, pw, ph);
    t.globalCompositeOperation = "destination-in";
    const gr = t.createRadialGradient(pw / 2, ph / 2, Math.min(pw, ph) * 0.25, pw / 2, ph / 2, Math.min(pw, ph) / 2);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    t.fillStyle = gr;
    t.fillRect(0, 0, pw, ph);
    g.drawImage(tmp, (st.x - def.x0) * kx - pw / 2, (st.y - def.y0) * ky - ph / 2);
  }
  }
  // THE GATE APPROACH — the new last stretch of road (up into the gate) is made of the map's
  // own painted road: a straight run of the original road is lifted out as a strip and laid
  // down slice by slice along the new curve, turning with it, so its dirt, stones, ruts and
  // edges are exactly the original ones. The strip's sides fade so it melts into the ground.
  const added = layout.roadToGate;
  if (added.length > 1) {
    const STRIP_W = 96; // road plus its shoulders, world units
    const STEP = 3;
    // 1) the longest nearly straight run of the old road, away from both ends
    const old = road.slice(0, road.length - added.length);
    let best: { a: number; b: number; len: number } | null = null;
    for (let a = Math.floor(old.length * 0.15); a < old.length * 0.85; a++) {
      let len = 0;
      let b = a;
      const h0 = Math.atan2(old[a + 1]!.y - old[a]!.y, old[a + 1]!.x - old[a]!.x);
      while (b + 1 < old.length * 0.9) {
        const h = Math.atan2(old[b + 1]!.y - old[b]!.y, old[b + 1]!.x - old[b]!.x);
        if (Math.abs(Math.atan2(Math.sin(h - h0), Math.cos(h - h0))) > 0.12) break;
        len += Math.hypot(old[b + 1]!.x - old[b]!.x, old[b + 1]!.y - old[b]!.y);
        b++;
        if (len > 220) break;
      }
      const A = old[a]!, B = old[b]!;
      const inside = (v: Vector2) => v.x - STRIP_W > def.x0 && v.y - STRIP_W > def.y0 && v.x + STRIP_W < def.x1 && v.y + STRIP_W < def.y1;
      if (inside(A) && inside(B) && (!best || len > best.len)) best = { a, b, len };
    }
    if (best && best.len > 40) {
      const A = old[best.a]!, B = old[best.b]!;
      const ang = Math.atan2(B.y - A.y, B.x - A.x);
      const L = best.len;
      // 2) the strip: the original road between A and B, turned so it runs left to right
      const sw = Math.ceil(L * kx), sh = Math.ceil(STRIP_W * ky);
      const strip = document.createElement("canvas");
      strip.width = sw;
      strip.height = sh;
      const sg = strip.getContext("2d")!;
      sg.translate(0, sh / 2);
      sg.rotate(-ang);
      sg.translate(-(A.x - def.x0) * kx, -(A.y - def.y0) * ky);
      sg.drawImage(bake.ground, 0, 0);
      sg.setTransform(1, 0, 0, 1, 0, 0);
      // fade the shoulders into whatever ground it is laid on
      sg.globalCompositeOperation = "destination-in";
      const fade = sg.createLinearGradient(0, 0, 0, sh);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(0.2, "rgba(0,0,0,1)");
      fade.addColorStop(0.8, "rgba(0,0,0,1)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      sg.fillStyle = fade;
      sg.fillRect(0, 0, sw, sh);
      // 3) lay it along the new road, starting a little way back on the old one so the join is seamless
      const lead = road.slice(Math.max(0, road.length - added.length - 4), road.length - added.length);
      const line = [...lead, ...added];
      // resample the line at even steps
      const pts: Vector2[] = [line[0]!];
      let carry = 0;
      for (let k = 1; k < line.length; k++) {
        const p = line[k - 1]!, q = line[k]!;
        const seg = Math.hypot(q.x - p.x, q.y - p.y);
        let t = STEP - carry;
        while (t <= seg) {
          pts.push({ x: p.x + ((q.x - p.x) * t) / seg, y: p.y + ((q.y - p.y) * t) / seg });
          t += STEP;
        }
        carry = seg - (t - STEP);
      }
      const slice = Math.ceil((STEP + 2) * kx);
      let u = 0; // where along the strip we are (it ping-pongs so no hard seam appears)
      let dir = 1;
      for (let k = 0; k < pts.length - 1; k++) {
        const p = pts[k]!, q = pts[k + 1]!;
        const h = Math.atan2(q.y - p.y, q.x - p.x);
        const sx = Math.max(0, Math.min(sw - slice, Math.round(u * kx)));
        g.save();
        g.translate((p.x - def.x0) * kx, (p.y - def.y0) * ky);
        g.rotate(h);
        if (dir < 0) g.scale(-1, 1);
        g.drawImage(strip, sx, 0, slice, sh, dir < 0 ? -slice : 0, -sh / 2, slice, sh);
        g.restore();
        u += STEP * dir;
        if (u > L - STEP - 2) dir = -1;
        else if (u < 0) {
          u = 0;
          dir = 1;
        }
      }
    }
  }
  const out: LoadedGroundBake = { def, ground, emissive: bake.emissive, skipKinds: bake.skipKinds };
  roadless.set(biome.id, out);
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
