import type { BiomeDefinition } from "./biomes";
import type { VisibleBounds } from "./MapRenderer";
import { n01 } from "./fireFx";

/**
 * LUZ E CICLO DO DIA — the map's living light, purely cosmetic.
 *
 * A slow day/night cycle runs on the real clock (every player shares the
 * same sky). As dusk falls the map dims a little — never so much that a
 * creature is hard to see — and every light source on it starts to matter:
 * torches, the castle, the city's windows, tower cores, the rift, shots in
 * flight, burning buildings and lava throw warm pools of light. By day,
 * sunny biomes get soft shafts of sunlight; birds cross the sky with their
 * shadows on the ground, bats come out at night, fireflies in the forests.
 *
 * Darkness is drawn into an offscreen "light map" (fill with the night
 * tone, then cut each light out of it), composited once over the scene,
 * then the lights' color is added on top. Everything derives from the time
 * alone — no stored particles.
 */

/** One full day (ms of real time). */
export const DAY_LENGTH_MS = 20 * 60 * 1000;

export interface LightSource {
  x: number;
  y: number;
  /** World-space radius. */
  r: number;
  rgb: readonly [number, number, number];
  /** 0..1 */
  intensity: number;
}

interface BiomeSky {
  /** The moonlight tone the scene is multiplied toward at full night (white = no change). */
  night: readonly [number, number, number];
  /** How far toward the night tone the scene goes at noon / at midnight (0..1). */
  dayAlpha: number;
  nightAlpha: number;
  sunny: boolean;
  sky: "birds" | "seabirds" | "crows" | "bats";
  fireflies: boolean;
}

const BRIGHT: BiomeSky = { night: [62, 84, 158], dayAlpha: 0, nightAlpha: 0.64, sunny: true, sky: "birds", fireflies: false };
const DARK: BiomeSky = { night: [100, 70, 112], dayAlpha: 0.14, nightAlpha: 0.56, sunny: false, sky: "bats", fireflies: false };

const SKIES: Record<string, BiomeSky> = {
  ANCIENT_FOREST: { ...BRIGHT, fireflies: true },
  MOON_GARDENS: { ...BRIGHT, night: [78, 78, 172], fireflies: true },
  FLOATING_ISLES: BRIGHT,
  CURSED_DESERT: { ...BRIGHT, night: [96, 92, 168] },
  LOST_SUN_TEMPLE: { ...BRIGHT, night: [96, 92, 168] },
  FROZEN_TUNDRA: { ...BRIGHT, night: [70, 100, 172] },
  CRYSTAL_SEA: { ...BRIGHT, night: [60, 98, 172], sky: "seabirds" },
  LEVIATHAN_COAST: { ...BRIGHT, night: [60, 94, 160], sky: "seabirds" },
  COLOSSUS_GRAVEYARD: { ...BRIGHT, night: [80, 82, 124], sky: "crows" },
  DARK_RUINS: { ...DARK, night: [80, 86, 122], dayAlpha: 0.1, sky: "crows" },
  VOLCANIC_WASTES: { ...DARK, night: [150, 74, 58] },
  ASHEN_VALLEY: { ...DARK, night: [130, 82, 72], sky: "crows" },
  DWARVEN_UNDERCITY: { ...DARK, night: [140, 86, 62] },
  ABYSS: { ...DARK, night: [110, 62, 150] },
  ABYSSAL_FORTRESS: { ...DARK, night: [80, 72, 150] },
  DEFILED_CATHEDRAL: { ...DARK, night: [112, 72, 112] },
};

export function skyFor(biomeId: string): BiomeSky {
  return SKIES[biomeId] ?? BRIGHT;
}

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

export interface TimeOfDay {
  /** 0 = full day, 1 = deep night. */
  night: number;
  /** 0..1 — how strongly the warm dusk/dawn tint shows. */
  golden: number;
}

/**
 * Where in the day `wallClockMs` falls. Day half the cycle, then dusk,
 * night and dawn. A test/screenshot override can pin it via
 * `window.__hordenovaTimeOfDay` (0..1 position in the day).
 */
export function timeOfDay(wallClockMs: number): TimeOfDay {
  const override = typeof window !== "undefined" ? (window as unknown as { __hordenovaTimeOfDay?: number }).__hordenovaTimeOfDay : undefined;
  const f = typeof override === "number" ? ((override % 1) + 1) % 1 : (wallClockMs % DAY_LENGTH_MS) / DAY_LENGTH_MS;
  let night: number;
  if (f < 0.5) night = 0;
  else if (f < 0.6) night = smooth((f - 0.5) / 0.1);
  else if (f < 0.85) night = 1;
  else night = 1 - smooth((f - 0.85) / 0.15);
  const golden = Math.max(0, 1 - Math.abs(f - 0.53) / 0.06) + Math.max(0, 1 - Math.abs(f - 0.9) / 0.07);
  return { night, golden: Math.min(1, golden) };
}

let lightCanvas: HTMLCanvasElement | null = null;

/**
 * Dims the scene for the time of day and lets every light source cut
 * through it, then adds the lights' own color. Call after the world is
 * drawn and before damage numbers / HP bars, with the world transform set.
 */
export function drawLighting(
  ctx: CanvasRenderingContext2D,
  biome: BiomeDefinition,
  bounds: VisibleBounds,
  tod: TimeOfDay,
  lights: readonly LightSource[],
): void {
  const sky = skyFor(biome.id);
  const alpha = sky.dayAlpha + (sky.nightAlpha - sky.dayAlpha) * tod.night;
  const w = bounds.x1 - bounds.x0;
  const h = bounds.y1 - bounds.y0;

  // Golden hour: a warm wash at dusk and dawn.
  if (tod.golden > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = `rgba(255,140,60,${0.55 * tod.golden})`;
    ctx.fillRect(bounds.x0, bounds.y0, w, h);
    // the low sun warms the side it comes from and leaves the far side cooler
    const sun = ctx.createLinearGradient(bounds.x0, bounds.y0, bounds.x1, bounds.y1);
    sun.addColorStop(0, `rgba(255,170,90,${0.22 * tod.golden})`);
    sun.addColorStop(0.6, "rgba(255,170,90,0)");
    sun.addColorStop(1, `rgba(60,70,140,${0.18 * tod.golden})`);
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = sun;
    ctx.fillRect(bounds.x0, bounds.y0, w, h);
    ctx.restore();
  }

  if (alpha < 0.02) return;
  const canvas = ctx.canvas;
  if (!lightCanvas) lightCanvas = document.createElement("canvas");
  // Half resolution: light is soft by nature, and this keeps the pass cheap.
  const lw = Math.max(1, Math.ceil(canvas.width / 2));
  const lh = Math.max(1, Math.ceil(canvas.height / 2));
  if (lightCanvas.width !== lw || lightCanvas.height !== lh) {
    lightCanvas.width = lw;
    lightCanvas.height = lh;
  }
  const l = lightCanvas.getContext("2d");
  if (!l) return;
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = "source-over";
  l.clearRect(0, 0, lw, lh);
  const m = ctx.getTransform();
  l.setTransform(m.a / 2, m.b / 2, m.c / 2, m.d / 2, m.e / 2, m.f / 2);
  // The light map starts as the night tone (multiplied over the scene, so
  // shadows deepen and colors cool like real moonlight instead of a grey
  // haze), and each light paints its pool back toward white = untouched.
  const tone = (c: number, k: number) => Math.round(255 + (c - 255) * Math.min(1, k));
  const [nr, ng, nb] = sky.night;
  l.fillStyle = `rgb(${tone(nr, alpha)},${tone(ng, alpha)},${tone(nb, alpha)})`;
  l.fillRect(bounds.x0, bounds.y0, w, h);
  // The edges sink a little deeper into the night than the play area.
  const deep = alpha * 1.25;
  const edge = l.createRadialGradient(500, 300, 260, 500, 300, 760);
  edge.addColorStop(0, `rgba(${tone(nr, deep)},${tone(ng, deep)},${tone(nb, deep)},0)`);
  edge.addColorStop(1, `rgba(${tone(nr, deep)},${tone(ng, deep)},${tone(nb, deep)},1)`);
  l.fillStyle = edge;
  l.fillRect(bounds.x0, bounds.y0, w, h);

  for (const s of lights) {
    const g = l.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, `rgba(255,255,255,${Math.min(1, 0.95 * s.intensity)})`);
    g.addColorStop(0.55, `rgba(255,255,255,${Math.min(1, 0.45 * s.intensity)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    l.fillStyle = g;
    l.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(lightCanvas, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // The lights' own warm/colored glow, stronger the darker it is.
  const glow = 0.05 + 0.2 * tod.night + (sky.dayAlpha > 0 ? 0.05 : 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of lights) {
    const a = glow * s.intensity;
    if (a < 0.005) continue;
    const [r, gg, b] = s.rgb;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 0.8);
    g.addColorStop(0, `rgba(${r},${gg},${b},${a})`);
    g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
  }
  ctx.restore();
}

/** Soft diagonal shafts of sunlight drifting across sunny maps by day. */
export function drawSunShafts(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, bounds: VisibleBounds, tod: TimeOfDay, timeMs: number): void {
  const sky = skyFor(biome.id);
  const day = 1 - tod.night;
  if (!sky.sunny || day < 0.05) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const shafts = 4;
  for (let i = 0; i < shafts; i++) {
    const drift = ((timeMs / 90000 + i / shafts + n01(i * 13) * 0.2) % 1) * 1500 - 300;
    const width = 70 + n01(i * 7) * 90;
    const breathe = 0.6 + 0.4 * Math.sin(timeMs / 7000 + i * 2.1);
    const a = 0.085 * day * breathe * (1 + tod.golden * 0.8);
    const x = bounds.x0 + drift;
    // a beam falling from the upper left: a slanted band
    const g = ctx.createLinearGradient(x, 0, x + width, 0);
    const warm = tod.golden > 0.1 ? "255,190,120" : "255,240,200";
    g.addColorStop(0, `rgba(${warm},0)`);
    g.addColorStop(0.5, `rgba(${warm},${a})`);
    g.addColorStop(1, `rgba(${warm},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    const slant = 380;
    ctx.moveTo(x, bounds.y0);
    ctx.lineTo(x + width, bounds.y0);
    ctx.lineTo(x + width + slant, bounds.y1);
    ctx.lineTo(x + slant, bounds.y1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * A flock crossing the sky every so often — birds by day (gulls by the sea,
 * crows over graveyards and ash), bats at night or in the dark biomes —
 * with their shadows sliding over the ground below.
 */
export function drawSkyLife(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, tod: TimeOfDay, timeMs: number): void {
  const sky = skyFor(biome.id);
  const bats = sky.sky === "bats" || tod.night > 0.6;
  const PERIOD = bats ? 38000 : 52000;
  const ACTIVE = bats ? 9000 : 15000;
  // screenshot/test hook: pin the flock mid-flight
  const pinned = typeof window !== "undefined" ? (window as unknown as { __hordenovaSkyPhase?: number }).__hordenovaSkyPhase : undefined;
  const cycle = Math.floor(timeMs / PERIOD);
  const t = typeof pinned === "number" ? pinned * ACTIVE : timeMs - cycle * PERIOD;
  if (t > ACTIVE) return;
  const p = t / ACTIVE;
  const seed = cycle * 7.31 + (bats ? 3 : 0);
  const fromLeft = n01(seed) < 0.5;
  const y0 = 80 + n01(seed + 1) * 380;
  const y1 = y0 + (n01(seed + 2) - 0.5) * 260;
  const cx = fromLeft ? -120 + p * 1240 : 1120 - p * 1240;
  const cy = y0 + (y1 - y0) * p;
  const heading = fromLeft ? 1 : -1;
  const count = bats ? 7 + Math.floor(n01(seed + 3) * 5) : 5 + Math.floor(n01(seed + 3) * 4);
  const tint = sky.sky === "seabirds" && !bats ? "rgba(240,240,235,0.95)" : "rgba(20,16,14,0.92)";
  const span = bats ? 7 : sky.sky === "seabirds" ? 11 : 10;

  const birds: { x: number; y: number; phase: number }[] = [];
  for (let i = 0; i < count; i++) {
    // V formation for birds, a loose swirl for bats
    const row = Math.ceil(i / 2);
    const side = i % 2 === 0 ? 1 : -1;
    const bx = bats ? (n01(seed + i * 3) - 0.5) * 90 + Math.sin(timeMs / 300 + i) * 10 : -heading * row * 22;
    const by = bats ? (n01(seed + i * 5) - 0.5) * 60 + Math.cos(timeMs / 260 + i) * 9 : side * row * 15;
    birds.push({ x: cx + bx, y: cy + by, phase: i * 1.7 });
  }

  ctx.save();
  // shadows on the ground (cast down-right by the sun, faint at night)
  ctx.fillStyle = `rgba(0,0,0,${0.16 * (1 - tod.night * 0.7)})`;
  for (const b of birds) {
    ctx.beginPath();
    ctx.ellipse(b.x + 70, b.y + 95, span * 0.9, span * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = tint;
  ctx.lineCap = "round";
  ctx.lineWidth = bats ? 2.4 : 2.2;
  for (const b of birds) {
    const flap = Math.sin(timeMs / (bats ? 55 : 120) + b.phase);
    const wy = flap * span * 0.55;
    ctx.beginPath();
    ctx.moveTo(b.x - span, b.y - wy);
    ctx.quadraticCurveTo(b.x - span * 0.45, b.y - wy * 0.2 - 2, b.x, b.y);
    ctx.quadraticCurveTo(b.x + span * 0.45, b.y - wy * 0.2 - 2, b.x + span, b.y - wy);
    ctx.stroke();
  }
  ctx.restore();
}

/** Fireflies drifting over forest maps at night. */
export function drawFireflies(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, tod: TimeOfDay, timeMs: number): void {
  if (!skyFor(biome.id).fireflies || tod.night < 0.05) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const count = 34;
  for (let i = 0; i < count; i++) {
    const bx = n01(i * 3.1) * 1000;
    const by = n01(i * 5.7) * 600;
    const x = bx + Math.sin(timeMs / (2400 + i * 37) + i) * 18;
    const y = by + Math.cos(timeMs / (3100 + i * 23) + i * 2) * 12;
    const blink = Math.max(0, Math.sin(timeMs / (700 + n01(i) * 900) + i * 4));
    const a = tod.night * blink * 0.85;
    if (a < 0.03) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
    g.addColorStop(0, `rgba(230,255,140,${a})`);
    g.addColorStop(0.25, `rgba(190,255,90,${a * 0.5})`);
    g.addColorStop(1, "rgba(160,255,80,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 9, y - 9, 18, 18);
  }
  ctx.restore();
}

/** "rgba(157,255,106,0.55)" / "#9dff6a" -> [157,255,106]. */
export function rgbOf(color: string): [number, number, number] {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const hex = color.replace("#", "");
  if (hex.length >= 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  return [255, 200, 120];
}
