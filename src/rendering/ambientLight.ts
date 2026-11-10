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
    const a = 0.05 * day * breathe * (1 + tod.golden * 0.8);
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

// ---------------------------------------------------------------------------
// CLIMA SOMBRIO — the grim, weathered look: the world is pulled toward cold,
// low-saturation tones with deeper shadows (fire and light, drawn afterwards,
// stay vivid and become the warm points of the picture), mist creeps over the
// ground, and weather passes through — rain with distant lightning in the wet
// lands, falling ash in the burnt ones. Purely cosmetic and derived from time.
// ---------------------------------------------------------------------------

type Weather = "rain" | "ash" | "snow" | "none";

const WEATHER: Record<string, Weather> = {
  ANCIENT_FOREST: "rain",
  MOON_GARDENS: "rain",
  DARK_RUINS: "rain",
  LEVIATHAN_COAST: "rain",
  CRYSTAL_SEA: "rain",
  COLOSSUS_GRAVEYARD: "rain",
  DEFILED_CATHEDRAL: "rain",
  FLOATING_ISLES: "rain",
  FROZEN_TUNDRA: "snow",
  VOLCANIC_WASTES: "ash",
  ASHEN_VALLEY: "ash",
  DWARVEN_UNDERCITY: "ash",
  ABYSS: "ash",
  ABYSSAL_FORTRESS: "ash",
};

/** The cold tone the scene is multiplied by, per biome family (white = untouched). */
function gradeTone(biomeId: string): readonly [number, number, number] {
  const w = WEATHER[biomeId];
  if (w === "ash") return [214, 196, 190];
  if (biomeId === "CURSED_DESERT" || biomeId === "LOST_SUN_TEMPLE") return [214, 204, 190];
  return [196, 206, 220];
}

/**
 * The color grade: drains some saturation, cools and darkens the mid-tones,
 * deepens the shadows and closes the frame with a heavy vignette. Call after
 * the world and its units are drawn, before lights and effects.
 */
export function drawGrimGrade(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, bounds: VisibleBounds): void {
  const w = bounds.x1 - bounds.x0;
  const h = bounds.y1 - bounds.y0;
  const [r, g, b] = gradeTone(biome.id);
  ctx.save();
  // 1. less color
  ctx.globalCompositeOperation = "saturation";
  ctx.fillStyle = "rgba(128,128,128,0.34)";
  ctx.fillRect(bounds.x0, bounds.y0, w, h);
  // 2. colder and darker
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(bounds.x0, bounds.y0, w, h);
  // 3. harder contrast: shadows sink, highlights hold
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(20,22,30,0.38)";
  ctx.fillRect(bounds.x0, bounds.y0, w, h);
  // 4. heavy vignette
  ctx.globalCompositeOperation = "multiply";
  const v = ctx.createRadialGradient(500, 300, 240, 500, 300, 820);
  v.addColorStop(0, "rgba(255,255,255,1)");
  v.addColorStop(0.6, "rgba(150,150,160,1)");
  v.addColorStop(1, "rgba(40,40,52,1)");
  ctx.fillStyle = v;
  ctx.fillRect(bounds.x0, bounds.y0, w, h);
  ctx.restore();
}

let mistSprite: HTMLCanvasElement | null = null;
function getMistSprite(): HTMLCanvasElement {
  if (mistSprite) return mistSprite;
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 10; i++) {
    const x = s / 2 + (rnd() - 0.5) * s * 0.4;
    const y = s / 2 + (rnd() - 0.5) * s * 0.3;
    const rad = s * (0.18 + rnd() * 0.2);
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, "rgba(205,214,226,0.5)");
    grad.addColorStop(1, "rgba(205,214,226,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  }
  mistSprite = c;
  return c;
}

/** Low mist drifting slowly over the ground, thicker at night. */
export function drawGroundMist(ctx: CanvasRenderingContext2D, bounds: VisibleBounds, tod: TimeOfDay, timeMs: number): void {
  const sprite = getMistSprite();
  const span = bounds.x1 - bounds.x0 + 500;
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const speed = 5 + n01(i * 3.3) * 9;
    const x = bounds.x0 - 250 + ((n01(i * 7.1) * span + (timeMs / 1000) * speed) % span);
    const y = 60 + n01(i * 11.7) * 520 + Math.sin(timeMs / 9000 + i) * 10;
    const size = 220 + n01(i * 5.9) * 260;
    ctx.globalAlpha = (0.1 + 0.1 * tod.night) * (0.6 + 0.4 * Math.sin(timeMs / 13000 + i * 1.7));
    ctx.drawImage(sprite, x - size / 2, y - size * 0.22, size, size * 0.44);
  }
  ctx.restore();
}

/** How hard the weather is coming down right now, 0..1 — it builds and passes over a few minutes. */
export function weatherIntensity(timeMs: number): number {
  const pinned = typeof window !== "undefined" ? (window as unknown as { __hordenovaWeather?: number }).__hordenovaWeather : undefined;
  if (typeof pinned === "number") return pinned;
  const wave = Math.sin(timeMs / 97000) * 0.6 + Math.sin(timeMs / 41000 + 1.3) * 0.4;
  return Math.max(0, Math.min(1, (wave + 0.25) * 1.1));
}

/**
 * Weather over the whole map: slanted rain with splashes on the ground and
 * the odd sheet of distant lightning, or grey ash sifting down. Returns the
 * lightning flash strength (0..1) so the caller can light the scene with it.
 */
export function drawWeather(ctx: CanvasRenderingContext2D, biome: BiomeDefinition, bounds: VisibleBounds, timeMs: number): number {
  const kind = WEATHER[biome.id] ?? "none";
  if (kind === "none") return 0;
  const k = weatherIntensity(timeMs);
  if (k <= 0.02) return 0;
  const w = bounds.x1 - bounds.x0;
  const h = bounds.y1 - bounds.y0;
  ctx.save();
  if (kind === "rain") {
    const drops = Math.round(170 * k);
    ctx.strokeStyle = "rgba(190,205,225,0.34)";
    ctx.lineWidth = 0.9;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < drops; i++) {
      const fall = 620 + n01(i * 1.7) * 260; // world units / s
      const cycle = (h + 120) / fall;
      const t = (timeMs / 1000 + n01(i * 9.1) * cycle) % cycle;
      const x = bounds.x0 + ((n01(i * 3.7) * (w + 160) + t * 150) % (w + 160)) - 80;
      const y = bounds.y0 - 40 + t * fall;
      const len = 12 + n01(i * 4.3) * 10;
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.24, y - len);
    }
    ctx.stroke();
    // splashes where drops meet the ground
    ctx.strokeStyle = "rgba(200,214,232,0.3)";
    ctx.lineWidth = 0.7;
    const splashes = Math.round(26 * k);
    for (let i = 0; i < splashes; i++) {
      const life = 420;
      const slot = Math.floor((timeMs + i * 137) / life);
      const p = ((timeMs + i * 137) % life) / life;
      const x = bounds.x0 + n01(slot * 1.31 + i * 7.7) * w;
      const y = bounds.y0 + n01(slot * 2.17 + i * 3.3) * h;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.ellipse(x, y, 1 + p * 5, 0.5 + p * 2.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // distant lightning: a double flicker every so often while the rain is heavy
    if (k < 0.6) return 0;
    const PERIOD = 23000;
    const cycle = Math.floor(timeMs / PERIOD);
    const at = n01(cycle * 5.3) * (PERIOD - 900);
    const dt = timeMs - cycle * PERIOD - at;
    if (dt < 0 || dt > 520) return 0;
    const flash = dt < 90 ? 1 - dt / 90 : dt > 180 && dt < 300 ? 0.7 * (1 - (dt - 180) / 120) : 0;
    return flash;
  }
  // ash: slow grey flakes with a few still-glowing ones; snow: soft white flakes
  const snow = kind === "snow";
  const flakes = Math.round((snow ? 120 : 70) * k);
  for (let i = 0; i < flakes; i++) {
    const fall = 26 + n01(i * 1.9) * 30;
    const cycle = (h + 60) / fall;
    const t = (timeMs / 1000 + n01(i * 8.3) * cycle) % cycle;
    const x = bounds.x0 + ((n01(i * 3.1) * w + t * 14 + Math.sin(timeMs / 1700 + i) * 14) % w);
    const y = bounds.y0 - 20 + t * fall;
    if (snow) {
      ctx.globalAlpha = 0.5 + n01(i * 2.9) * 0.35;
      ctx.fillStyle = "rgb(236,242,250)";
      const r = 0.9 + n01(i * 6.1) * 1.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const glowing = i % 9 === 0;
    ctx.globalAlpha = glowing ? 0.8 : 0.42;
    ctx.fillStyle = glowing ? "rgb(255,150,70)" : "rgb(178,172,168)";
    ctx.fillRect(x, y, glowing ? 1.4 : 1.8, glowing ? 1.4 : 1.2);
  }
  ctx.restore();
  return 0;
}

/** A sheet of lightning over the whole frame (strength 0..1). */
export function drawLightningFlash(ctx: CanvasRenderingContext2D, bounds: VisibleBounds, strength: number): void {
  if (strength <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = `rgba(190,205,255,${0.3 * strength})`;
  ctx.fillRect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  ctx.restore();
}
