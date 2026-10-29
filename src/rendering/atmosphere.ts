import { WORLD_SIZE } from "@/config/gameBalance";
import type { BiomeDefinition } from "./biomes";
import type { VisibleBounds } from "./MapRenderer";

/**
 * Light, realistic atmosphere for the six original biomes (the ones with a
 * baked ground): soft cloud shadows drifting across everything, a thin mist
 * hugging the map edges, and a few biome-specific particles — falling leaves
 * and pollen, ash and rising embers, snow, wind-blown sand, dust motes,
 * violet motes. Kept deliberately sparse so it never competes with combat.
 * Everything is deterministic from `timeMs` (no per-frame allocation beyond
 * one small offscreen composite) and purely cosmetic.
 */

interface AtmosphereStyle {
  /** Cloud-shadow strength (0 disables). */
  clouds: number;
  /** Edge mist colour (rgb) and strength. */
  mist: [number, number, number];
  mistAlpha: number;
  particles: ParticleKind[];
}

type ParticleKind =
  | "LEAF"
  | "POLLEN"
  | "ASH"
  | "EMBER"
  | "SNOW"
  | "SAND"
  | "DUST"
  | "VOID_MOTE"
  | "STEAM"
  | "WIND"
  | "GLINT"
  | "SPORE"
  | "SPRAY"
  | "INCENSE";

const STYLES: Record<string, AtmosphereStyle> = {
  ANCIENT_FOREST: { clouds: 0.3, mist: [200, 225, 190], mistAlpha: 0.16, particles: ["LEAF", "POLLEN"] },
  VOLCANIC_WASTES: { clouds: 0.26, mist: [90, 60, 50], mistAlpha: 0.22, particles: ["ASH", "EMBER"] },
  FROZEN_TUNDRA: { clouds: 0.24, mist: [235, 244, 255], mistAlpha: 0.3, particles: ["SNOW"] },
  CURSED_DESERT: { clouds: 0.26, mist: [230, 200, 150], mistAlpha: 0.22, particles: ["SAND"] },
  DARK_RUINS: { clouds: 0.24, mist: [150, 160, 150], mistAlpha: 0.18, particles: ["DUST"] },
  ABYSS: { clouds: 0, mist: [60, 30, 100], mistAlpha: 0.3, particles: ["VOID_MOTE"] },
  // 10-biome expansion
  DWARVEN_UNDERCITY: { clouds: 0, mist: [90, 70, 50], mistAlpha: 0.28, particles: ["STEAM", "EMBER"] },
  COLOSSUS_GRAVEYARD: { clouds: 0.26, mist: [200, 190, 165], mistAlpha: 0.2, particles: ["DUST"] },
  FLOATING_ISLES: { clouds: 0.34, mist: [230, 240, 255], mistAlpha: 0.34, particles: ["WIND", "POLLEN"] },
  LOST_SUN_TEMPLE: { clouds: 0.22, mist: [240, 210, 150], mistAlpha: 0.2, particles: ["DUST", "SAND"] },
  CRYSTAL_SEA: { clouds: 0.18, mist: [150, 220, 240], mistAlpha: 0.24, particles: ["GLINT"] },
  ABYSSAL_FORTRESS: { clouds: 0.16, mist: [40, 55, 70], mistAlpha: 0.4, particles: ["DUST"] },
  ASHEN_VALLEY: { clouds: 0.26, mist: [120, 110, 100], mistAlpha: 0.3, particles: ["ASH", "EMBER"] },
  MOON_GARDENS: { clouds: 0.14, mist: [90, 90, 160], mistAlpha: 0.26, particles: ["SPORE"] },
  DEFILED_CATHEDRAL: { clouds: 0.12, mist: [80, 60, 100], mistAlpha: 0.3, particles: ["INCENSE", "DUST"] },
  LEVIATHAN_COAST: { clouds: 0.3, mist: [190, 225, 230], mistAlpha: 0.3, particles: ["SPRAY", "WIND"] },
};

export function hasRealisticAtmosphere(biomeId: string): boolean {
  return biomeId in STYLES;
}

// ---------------------------------------------------------------------------
// Tileable value-noise texture, generated once.
// ---------------------------------------------------------------------------

const NOISE_W = 192;
const NOISE_H = 128;
let noiseCanvas: HTMLCanvasElement | null = null;
let edgeMaskCanvas: HTMLCanvasElement | null = null;
let scratchCanvas: HTMLCanvasElement | null = null;

function makeCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function buildNoise(): HTMLCanvasElement | null {
  const c = makeCanvas(NOISE_W, NOISE_H);
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  const img = ctx.createImageData(NOISE_W, NOISE_H);
  const octave = (cells: number, seed: number) => {
    const gw = cells;
    const gh = Math.max(2, Math.round((cells * NOISE_H) / NOISE_W));
    const g: number[] = [];
    for (let i = 0; i < gw * gh; i++) {
      const v = Math.sin((i + seed * 977) * 12.9898) * 43758.5453;
      g.push(v - Math.floor(v));
    }
    return (x: number, y: number) => {
      const fx = (x / NOISE_W) * gw;
      const fy = (y / NOISE_H) * gh;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (ix: number, iy: number) => g[((iy % gh) + gh) % gh * gw + (((ix % gw) + gw) % gw)]!;
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };
  };
  const o1 = octave(4, 1), o2 = octave(8, 2), o3 = octave(16, 3);
  for (let y = 0; y < NOISE_H; y++) {
    for (let x = 0; x < NOISE_W; x++) {
      const n = o1(x, y) * 0.55 + o2(x, y) * 0.3 + o3(x, y) * 0.15;
      // Contrast so it reads as separate clouds/banks, not a flat haze.
      const v = Math.max(0, Math.min(1, (n - 0.42) * 2.6));
      const i = (y * NOISE_W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Alpha mask that is strong at the map edges and fades out toward the middle (the play area stays clear). */
function buildEdgeMask(): HTMLCanvasElement | null {
  const c = makeCanvas(NOISE_W, NOISE_H);
  const ctx = c?.getContext("2d");
  if (!c || !ctx) return null;
  const g = ctx.createRadialGradient(NOISE_W / 2, NOISE_H / 2, NOISE_H * 0.32, NOISE_W / 2, NOISE_H / 2, NOISE_W * 0.62);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, NOISE_W, NOISE_H);
  return c;
}

function ensureTextures(): boolean {
  if (!noiseCanvas) noiseCanvas = buildNoise();
  if (!edgeMaskCanvas) edgeMaskCanvas = buildEdgeMask();
  if (!scratchCanvas) scratchCanvas = makeCanvas(NOISE_W, NOISE_H);
  return !!(noiseCanvas && edgeMaskCanvas && scratchCanvas);
}

/** Draws the noise texture tiled and scrolled by (ox, oy) texels into `ctx` covering (0,0,NOISE_W,NOISE_H). */
function drawScrolledNoise(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  const x = ((ox % NOISE_W) + NOISE_W) % NOISE_W;
  const y = ((oy % NOISE_H) + NOISE_H) % NOISE_H;
  for (const dx of [-NOISE_W, 0]) {
    for (const dy of [-NOISE_H, 0]) {
      ctx.drawImage(noiseCanvas!, x + dx, y + dy);
    }
  }
}

// ---------------------------------------------------------------------------
// Cloud shadows + edge mist
// ---------------------------------------------------------------------------

function drawCloudShadows(ctx: CanvasRenderingContext2D, style: AtmosphereStyle, timeMs: number, b: VisibleBounds): void {
  if (style.clouds <= 0) return;
  const s = scratchCanvas!.getContext("2d")!;
  s.globalCompositeOperation = "source-over";
  s.clearRect(0, 0, NOISE_W, NOISE_H);
  drawScrolledNoise(s, timeMs / 900, timeMs / 2600);
  s.globalCompositeOperation = "source-in";
  s.fillStyle = "rgb(20,24,30)";
  s.fillRect(0, 0, NOISE_W, NOISE_H);
  ctx.save();
  ctx.globalAlpha = style.clouds;
  ctx.imageSmoothingEnabled = true;
  // Clouds are much bigger than the map; the texture is stretched over ~1.6x the view.
  const w = (b.x1 - b.x0) * 1.6;
  const h = (b.y1 - b.y0) * 1.6;
  ctx.drawImage(scratchCanvas!, b.x0 - w * 0.2, b.y0 - h * 0.2, w, h);
  ctx.restore();
}

function drawEdgeMist(ctx: CanvasRenderingContext2D, style: AtmosphereStyle, timeMs: number, b: VisibleBounds): void {
  if (style.mistAlpha <= 0) return;
  const s = scratchCanvas!.getContext("2d")!;
  s.globalCompositeOperation = "source-over";
  s.clearRect(0, 0, NOISE_W, NOISE_H);
  drawScrolledNoise(s, -timeMs / 1400, timeMs / 3800 + 40);
  s.globalCompositeOperation = "destination-in";
  s.drawImage(edgeMaskCanvas!, 0, 0);
  s.globalCompositeOperation = "source-in";
  s.fillStyle = `rgb(${style.mist[0]},${style.mist[1]},${style.mist[2]})`;
  s.fillRect(0, 0, NOISE_W, NOISE_H);
  ctx.save();
  ctx.globalAlpha = style.mistAlpha;
  ctx.drawImage(scratchCanvas!, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

interface Seed {
  x: number;
  y: number;
  speed: number;
  phase: number;
  size: number;
}

function seeds(count: number, salt: number): Seed[] {
  const r = (i: number, k: number) => {
    const v = Math.sin((i * 31 + k * 7 + salt * 131) * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  return Array.from({ length: count }, (_, i) => ({
    x: r(i, 1) * (WORLD_SIZE.width + 200) - 100,
    y: r(i, 2) * (WORLD_SIZE.height + 120) - 60,
    speed: 0.6 + r(i, 3) * 0.8,
    phase: r(i, 4) * Math.PI * 2,
    size: 0.6 + r(i, 5) * 0.8,
  }));
}

const SPAN_X = WORLD_SIZE.width + 200;
const SPAN_Y = WORLD_SIZE.height + 120;
const wrapX = (x: number) => ((((x + 100) % SPAN_X) + SPAN_X) % SPAN_X) - 100;
const wrapY = (y: number) => ((((y + 60) % SPAN_Y) + SPAN_Y) % SPAN_Y) - 60;

const PARTICLE_SEEDS: Record<ParticleKind, Seed[]> = {
  LEAF: seeds(26, 1),
  POLLEN: seeds(24, 2),
  ASH: seeds(30, 3),
  EMBER: seeds(12, 4),
  SNOW: seeds(120, 5),
  SAND: seeds(26, 6),
  DUST: seeds(20, 7),
  VOID_MOTE: seeds(20, 8),
  STEAM: seeds(14, 9),
  WIND: seeds(18, 10),
  GLINT: seeds(30, 11),
  SPORE: seeds(26, 12),
  SPRAY: seeds(22, 13),
  INCENSE: seeds(10, 14),
};

const LEAF_COLORS = ["#6a7a2a", "#8a6a24", "#a05a1e", "#5a6a24"];

function drawParticles(ctx: CanvasRenderingContext2D, kind: ParticleKind, timeMs: number): void {
  const t = timeMs / 1000;
  const list = PARTICLE_SEEDS[kind];
  ctx.save();
  switch (kind) {
    case "LEAF": {
      // Leaves tumbling down on the breeze: they flip (scaleX), spin and sway.
      for (let i = 0; i < list.length; i++) {
        const p = list[i]!;
        const x = wrapX(p.x + t * 14 * p.speed + Math.sin(t * 0.9 + p.phase) * 18);
        const y = wrapY(p.y + t * 11 * p.speed);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 1.2 * p.speed + p.phase);
        ctx.scale(Math.cos(t * 2.4 * p.speed + p.phase), 1);
        ctx.fillStyle = LEAF_COLORS[i % LEAF_COLORS.length]!;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        const ls = p.size * 1.4;
        ctx.moveTo(0, -2.4 * ls);
        ctx.quadraticCurveTo(1.8 * ls, 0, 0, 2.4 * ls);
        ctx.quadraticCurveTo(-1.8 * ls, 0, 0, -2.4 * ls);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "POLLEN": {
      ctx.globalCompositeOperation = "lighter";
      for (const p of list) {
        const x = wrapX(p.x + Math.sin(t * 0.3 + p.phase) * 30 + t * 3);
        const y = wrapY(p.y - t * 2.5 * p.speed + Math.cos(t * 0.5 + p.phase) * 10);
        const a = 0.25 + 0.3 * Math.max(0, Math.sin(t * 1.3 + p.phase));
        ctx.fillStyle = `rgba(240,240,170,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.7 * p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "ASH": {
      for (const p of list) {
        const x = wrapX(p.x + t * 6 * p.speed + Math.sin(t * 0.8 + p.phase) * 14);
        const y = wrapY(p.y + t * 9 * p.speed);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.8 + p.phase);
        ctx.scale(Math.cos(t * 1.6 * p.speed + p.phase) * 0.9 + 0.1, 1);
        ctx.fillStyle = `rgba(150,140,135,${0.45 + 0.2 * p.size})`;
        ctx.fillRect(-1.3 * p.size, -0.9 * p.size, 2.6 * p.size, 1.8 * p.size);
        ctx.restore();
      }
      break;
    }
    case "EMBER": {
      // Embers rising on the heat, flickering out at the top of their climb.
      ctx.globalCompositeOperation = "lighter";
      for (const p of list) {
        const life = 7 + p.speed * 5;
        const k = ((t + p.phase * 3) % life) / life;
        const x = wrapX(p.x + Math.sin(t * 1.7 + p.phase) * 8 + k * 30);
        const y = wrapY(p.y - k * 140);
        const a = Math.sin(k * Math.PI) * (0.55 + 0.45 * Math.sin(t * 9 + p.phase * 5));
        if (a <= 0.02) continue;
        ctx.fillStyle = `rgba(255,${150 + Math.round(60 * (1 - k))},60,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.9 * p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "SNOW": {
      // Three depths: near flakes are bigger, faster and sway more.
      for (const p of list) {
        const depth = p.size; // 0.6..1.4
        const x = wrapX(p.x + Math.sin(t * 0.7 * depth + p.phase) * 12 * depth + t * 6 * depth);
        const y = wrapY(p.y + t * 16 * depth * p.speed);
        const r = 1.0 + depth * 1.3;
        // A faint shadow under each flake so it still reads against white snow.
        ctx.fillStyle = `rgba(60,80,110,${0.18 + 0.12 * (depth - 0.6)})`;
        ctx.beginPath();
        ctx.arc(x + 3 * depth, y + 5 * depth, r * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.7 + 0.3 * (depth - 0.6)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "SAND": {
      // Fine sand blown low across the ground in gusts (thin fading streaks).
      const gust = 0.5 + 0.5 * Math.sin(t * 0.35);
      ctx.lineCap = "round";
      for (const p of list) {
        const x = wrapX(p.x + t * 90 * p.speed);
        const y = wrapY(p.y + Math.sin(t * 2 + p.phase) * 3);
        const len = 10 + 14 * p.size * gust;
        ctx.strokeStyle = `rgba(235,210,160,${0.2 + 0.3 * gust})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x - len, y + len * 0.08);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      break;
    }
    case "DUST": {
      // Dust motes catching the light, barely drifting.
      ctx.globalCompositeOperation = "lighter";
      for (const p of list) {
        const x = wrapX(p.x + Math.sin(t * 0.2 + p.phase) * 25 + t * 2);
        const y = wrapY(p.y + Math.cos(t * 0.25 + p.phase) * 15 + t * 1.5);
        const a = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.9 + p.phase));
        ctx.fillStyle = `rgba(220,215,200,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 * p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "STEAM": {
      // Steam venting from below the streets: soft puffs rising and spreading.
      for (const p of list) {
        const life = 5 + p.speed * 3;
        const k = ((t + p.phase * 4) % life) / life;
        const x = wrapX(p.x + Math.sin(t * 0.6 + p.phase) * 6 + k * 14);
        const y = wrapY(p.y - k * 60);
        const r = 4 + k * 14;
        const a = Math.sin(k * Math.PI) * 0.14;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(220,210,200,${a})`);
        g.addColorStop(1, "rgba(220,210,200,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "WIND": {
      // Long faint wind streaks sweeping across in gusts.
      const gust = 0.5 + 0.5 * Math.sin(t * 0.4);
      ctx.lineCap = "round";
      for (const p of list) {
        const x = wrapX(p.x + t * 130 * p.speed);
        const y = wrapY(p.y + Math.sin(t + p.phase) * 4 + t * 12 * p.speed);
        const len = 18 + 26 * p.size * gust;
        ctx.strokeStyle = `rgba(245,250,255,${0.1 + 0.18 * gust})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(x - len, y - len * 0.1);
        ctx.quadraticCurveTo(x - len * 0.5, y - len * 0.02 + Math.sin(t * 3 + p.phase) * 2, x, y);
        ctx.stroke();
      }
      break;
    }
    case "GLINT": {
      // Mineral facets catching the light: brief four-point sparkles.
      ctx.globalCompositeOperation = "lighter";
      for (const p of list) {
        const flash = Math.pow(Math.max(0, Math.sin(t * 0.9 * p.speed + p.phase * 3)), 10);
        if (flash < 0.05) continue;
        const x = p.x, y = p.y;
        const r = 2 + flash * 3.5 * p.size;
        ctx.strokeStyle = `rgba(210,250,255,${flash})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r);
        ctx.lineTo(x, y + r);
        ctx.stroke();
      }
      break;
    }
    case "SPORE": {
      // Luminous spores drifting upward, slowly breathing.
      ctx.globalCompositeOperation = "lighter";
      for (const p of list) {
        const x = wrapX(p.x + Math.sin(t * 0.35 + p.phase) * 18);
        const y = wrapY(p.y - t * 4 * p.speed);
        const a = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(t * 0.9 + p.phase));
        const r = 1.4 * p.size;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        g.addColorStop(0, `rgba(200,190,255,${a})`);
        g.addColorStop(1, "rgba(150,130,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "SPRAY": {
      // Sea spray: fine droplets flung up and falling back in arcs.
      for (const p of list) {
        const life = 2.2 + p.speed;
        const k = ((t + p.phase) % life) / life;
        const x = wrapX(p.x + k * 40);
        const y = p.y - Math.sin(k * Math.PI) * 26;
        const a = Math.sin(k * Math.PI) * 0.5;
        ctx.fillStyle = `rgba(230,250,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "INCENSE": {
      // Thin wisps of incense smoke curling upward.
      ctx.lineCap = "round";
      for (const p of list) {
        const baseX = p.x, baseY = wrapY(p.y);
        ctx.strokeStyle = "rgba(190,170,210,0.12)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let k = 0; k <= 10; k++) {
          const f = k / 10;
          const x = baseX + Math.sin(t * 0.7 + p.phase + f * 4) * 6 * f;
          const y = baseY - f * 50;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case "VOID_MOTE": {
      ctx.globalCompositeOperation = "lighter";
      for (const p of list) {
        const x = wrapX(p.x + Math.sin(t * 0.4 + p.phase) * 16);
        const y = wrapY(p.y - t * 5 * p.speed);
        const a = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.1 + p.phase));
        const r = 1.6 * p.size;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
        g.addColorStop(0, `rgba(210,160,255,${a})`);
        g.addColorStop(1, "rgba(160,80,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

/** Full atmosphere pass (call after entities, before the vignette). Returns false if the biome has no realistic atmosphere (caller falls back to the old fog/motes). */
export function drawRealisticAtmosphere(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, timeMs: number, bounds: VisibleBounds): boolean {
  const style = STYLES[biome.id];
  if (!style || !ensureTextures()) return false;
  drawCloudShadows(ctx, style, timeMs, bounds);
  drawEdgeMist(ctx, style, timeMs, bounds);
  for (const kind of style.particles) drawParticles(ctx, kind, timeMs);
  return true;
}
