/**
 * CHEFE GLOBAL — the arena and the Serpent of the Eclipse.
 *
 * Layers, back to front: the void (nebula, twinkling stars, drifting rock
 * islets, shooting stars), the baked floating disk (public/sprites/duel/
 * colossus.webp + its glow layer), the rift and the Eclipse core, slot marks
 * and falling-star warnings, the towers, the Serpent (shadow, wings, armoured
 * plates, horned head, eclipse crown, shields), shots, impacts and numbers.
 *
 * Every costly shape (plates, head, glows, nebula) is painted once into an
 * offscreen canvas and then only stamped, so a frame stays cheap. Purely
 * visual; reads only the snapshot.
 */
import { drawProjectile, drawTower } from "./EntityRenderer";
import { CombatFx, preloadCombatFxArt } from "./combatFx";
import { SpecialVfxLayer } from "./specialVfx";
import { VfxManager } from "./vfx";
import { createProjectile, type ProjectileInstance } from "@/entities/Projectile";
import { getTowerMuzzleOffset } from "@/entities/Tower";
import { drawRiftPortal } from "./riftPortal";
import { getBiome } from "./biomes";
import type { TowerInstance } from "@/entities/Tower";
import type { RaidShot } from "@/engine/ColossusEngine";
import {
  ARENA_CENTER,
  BODY_SEGMENTS,
  COLOSSUS_H,
  COLOSSUS_SLOTS,
  COLOSSUS_W,
  PATH_LENGTH,
  SEGMENT_GAP,
  SHIELD_MS,
  STAR_WARN_MS,
  pathAt,
  type ColossusSnapshot,
  type Pt,
} from "@/engine/ColossusEngine";
import { COLOSSUS_LENGTH_MS } from "@/config/colossus";

const W = COLOSSUS_W;
const H = COLOSSUS_H;
const HOVER = 10;
export const CORE_AT: Pt = pathAt(PATH_LENGTH);
const RIFT_AT: Pt = pathAt(0);

// ── images ──────────────────────────────────────────────────────────────
const base = () => (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
let arenaImg: HTMLImageElement | null = null;
let glowImg: HTMLImageElement | null = null;
function loaded(img: HTMLImageElement | null): img is HTMLImageElement {
  return !!img && img.complete && img.naturalWidth > 0;
}
function ensureImages(): void {
  if (typeof Image === "undefined" || arenaImg) return;
  arenaImg = new Image();
  arenaImg.src = `${base()}sprites/duel/colossus.webp`;
  glowImg = new Image();
  glowImg.src = `${base()}sprites/duel/colossus_glow.webp`;
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── the void ────────────────────────────────────────────────────────────
let voidCache: HTMLCanvasElement | null = null;
function voidLayer(): HTMLCanvasElement {
  if (voidCache) return voidCache;
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0c0718");
  bg.addColorStop(0.5, "#05030c");
  bg.addColorStop(1, "#110614");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const clouds: [number, number, number, string][] = [
    [120, 90, 260, "rgba(120,60,200,0.22)"],
    [880, 110, 300, "rgba(60,90,210,0.18)"],
    [900, 560, 280, "rgba(200,70,140,0.16)"],
    [90, 580, 260, "rgba(90,50,190,0.2)"],
    [500, 40, 220, "rgba(255,170,90,0.06)"],
  ];
  for (const [x, y, r, col] of clouds) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }
  // fixed faint stars
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + hash(i) * 0.35})`;
    g.fillRect(hash(i + 1) * W, hash(i + 2) * H, 1, 1);
  }
  voidCache = c;
  return c;
}

let islets: HTMLCanvasElement[] | null = null;
function isletSprites(): HTMLCanvasElement[] {
  if (islets) return islets;
  islets = [0, 1, 2].map((v) => {
    const c = canvas(120, 90);
    const g = c.getContext("2d")!;
    g.translate(60, 36);
    // underside (rocky cone)
    g.beginPath();
    g.moveTo(-44, 0);
    for (let i = 0; i <= 8; i++) g.lineTo(-44 + i * 11, 14 + hash(v * 9 + i) * 34 * Math.sin((i / 8) * Math.PI));
    g.lineTo(44, 0);
    g.closePath();
    const ug = g.createLinearGradient(0, 0, 0, 48);
    ug.addColorStop(0, "#2a2036");
    ug.addColorStop(1, "#0a0710");
    g.fillStyle = ug;
    g.fill();
    // top
    g.beginPath();
    g.ellipse(0, 0, 46, 14, 0, 0, Math.PI * 2);
    const tg = g.createLinearGradient(0, -14, 0, 14);
    tg.addColorStop(0, "#4a3d5e");
    tg.addColorStop(1, "#2a2138");
    g.fillStyle = tg;
    g.fill();
    g.strokeStyle = "rgba(180,120,255,0.55)";
    g.lineWidth = 1.2;
    g.stroke();
    // a crystal or two
    for (let k = 0; k < 2; k++) {
      const x = -18 + k * 26 + hash(v + k) * 8;
      g.fillStyle = k ? "#b58cff" : "#8fe0ff";
      g.beginPath();
      g.moveTo(x, -2);
      g.lineTo(x + 4, -16 - hash(v * 3 + k) * 8);
      g.lineTo(x + 8, -2);
      g.closePath();
      g.fill();
    }
    return c;
  });
  return islets;
}

const ISLETS: { x: number; y: number; s: number; v: number; ph: number }[] = [
  { x: 40, y: 40, s: 0.7, v: 0, ph: 0 },
  { x: 955, y: 30, s: 0.6, v: 1, ph: 1.7 },
  { x: 975, y: 610, s: 0.8, v: 2, ph: 3.1 },
  { x: 30, y: 615, s: 0.65, v: 1, ph: 4.4 },
  { x: 990, y: 300, s: 0.45, v: 0, ph: 2.2 },
];

function drawVoid(ctx: CanvasRenderingContext2D, timeMs: number, eclipse: number): void {
  const t = timeMs / 1000;
  ctx.drawImage(voidLayer(), 0, 0);
  // twinkling stars
  for (let i = 0; i < 70; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i + 40) * 2) + i);
    ctx.fillStyle = `rgba(255,${230 - (i % 3) * 30},${255 - (i % 5) * 20},${0.25 + tw * 0.6})`;
    const x = hash(i + 50) * W;
    const y = hash(i + 60) * H;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  // a shooting star every few seconds
  const cyc = (t % 4.3) / 4.3;
  if (cyc < 0.18) {
    const k = cyc / 0.18;
    const seed = Math.floor(t / 4.3);
    const x0 = hash(seed) * W;
    const y0 = hash(seed + 7) * H * 0.3;
    const x = x0 - k * 260;
    const y = y0 + k * 120;
    const sg = ctx.createLinearGradient(x, y, x + 90, y - 42);
    sg.addColorStop(0, "rgba(255,240,210,0.9)");
    sg.addColorStop(1, "rgba(255,240,210,0)");
    ctx.strokeStyle = sg;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 90, y - 42);
    ctx.stroke();
  }
  // drifting islets
  const sprites = isletSprites();
  for (const isl of ISLETS) {
    const bob = Math.sin(t * 0.6 + isl.ph) * 5;
    ctx.save();
    ctx.translate(isl.x + Math.sin(t * 0.13 + isl.ph) * 8, isl.y + bob);
    ctx.scale(isl.s, isl.s);
    ctx.drawImage(sprites[isl.v]!, -60, -36);
    ctx.restore();
  }
  if (eclipse > 0) {
    const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75);
    rg.addColorStop(0, "rgba(120,0,20,0)");
    rg.addColorStop(1, `rgba(150,20,30,${0.35 * eclipse})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
}

// ── arena + core ────────────────────────────────────────────────────────
function drawArena(ctx: CanvasRenderingContext2D, timeMs: number): void {
  ensureImages();
  if (loaded(arenaImg)) {
    ctx.drawImage(arenaImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#1b1426";
    ctx.beginPath();
    ctx.ellipse(ARENA_CENTER.x, ARENA_CENTER.y, 490, 316, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (loaded(glowImg)) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(timeMs / 900);
    ctx.drawImage(glowImg, 0, 0, W, H);
    ctx.restore();
  }
}

function drawCore(ctx: CanvasRenderingContext2D, timeMs: number, intensity: number, flare: number): void {
  const t = timeMs / 1000;
  const { x, y } = CORE_AT;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = "lighter";
  const R = 46 + intensity * 14 + flare * 60;
  const corona = ctx.createRadialGradient(0, 0, 16, 0, 0, R * 1.9);
  corona.addColorStop(0, `rgba(255,220,150,${0.75 + flare * 0.25})`);
  corona.addColorStop(0.35, `rgba(255,150,70,${0.35 + intensity * 0.2})`);
  corona.addColorStop(0.7, "rgba(150,70,255,0.18)");
  corona.addColorStop(1, "rgba(80,30,160,0)");
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.9, 0, Math.PI * 2);
  ctx.fill();
  // rays
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + t * 0.25;
    const len = R * (1.1 + 0.35 * Math.sin(t * 2 + i * 1.7)) * (1 + flare);
    ctx.strokeStyle = `rgba(255,210,140,${0.22 + 0.15 * Math.sin(t * 3 + i)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24 * 0.8);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len * 0.8);
    ctx.stroke();
  }
  // accretion arms
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = `rgba(190,120,255,${0.45 - k * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34 + k * 9, (34 + k * 9) * 0.7, t * (0.8 + k * 0.3) + k * 2, 0.3, 2.3);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  // the black sun
  ctx.fillStyle = "#020104";
  ctx.beginPath();
  ctx.arc(0, 0, 22 + intensity * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,230,170,0.9)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// ── the Serpent ─────────────────────────────────────────────────────────
interface SerpentSprites {
  plate: HTMLCanvasElement;
  plateEmber: HTMLCanvasElement;
  plateFlash: HTMLCanvasElement;
  plateShield: HTMLCanvasElement;
  head: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  glow: HTMLCanvasElement;
}
let sprites: SerpentSprites | null = null;
const PX = 3; // sprite resolution (pixels per world unit)

function paintPlate(seam: string, seam2: string): HTMLCanvasElement {
  const c = canvas(60 * PX, 48 * PX);
  const g = c.getContext("2d")!;
  g.scale(PX, PX);
  g.translate(30, 24);
  // body
  const body = g.createRadialGradient(-4, -8, 2, 0, 0, 24);
  body.addColorStop(0, "#4a3468");
  body.addColorStop(0.55, "#1d1230");
  body.addColorStop(1, "#06030b");
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(0, 0, 22, 18, 0, 0, Math.PI * 2);
  g.fill();
  // overlapping scale rows
  g.lineWidth = 1.1;
  for (let row = -1; row <= 1; row++) {
    for (let k = -2; k <= 2; k++) {
      const x = k * 7 + (row % 2 ? 3.5 : 0);
      const y = row * 9;
      if ((x * x) / 400 + (y * y) / 256 > 0.85) continue;
      g.strokeStyle = "rgba(160,120,220,0.35)";
      g.beginPath();
      g.arc(x, y, 5, Math.PI * 0.6, Math.PI * 1.4);
      g.stroke();
    }
  }
  // glowing seams down both flanks
  g.globalCompositeOperation = "lighter";
  for (const side of [-1, 1]) {
    g.strokeStyle = seam;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-16, side * 11);
    g.quadraticCurveTo(0, side * 16, 16, side * 10);
    g.stroke();
    g.strokeStyle = seam2;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(-10, side * 6);
    g.lineTo(-2, side * 9);
    g.lineTo(6, side * 5);
    g.stroke();
  }
  g.globalCompositeOperation = "source-over";
  // dorsal spines pointing back (-x)
  for (const [x0, len] of [[8, 14], [-6, 12]] as const) {
    const sg = g.createLinearGradient(x0, 0, x0 - len, 0);
    sg.addColorStop(0, "#f2dca6");
    sg.addColorStop(1, "#5a3a18");
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(x0, -3.5);
    g.lineTo(x0 - len, 0);
    g.lineTo(x0, 3.5);
    g.closePath();
    g.fill();
  }
  // rim light
  g.strokeStyle = "rgba(220,190,255,0.5)";
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(0, 0, 21.5, 17.5, 0, Math.PI * 1.1, Math.PI * 1.75);
  g.stroke();
  return c;
}

function paintTinted(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = canvas(src.width, src.height);
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function paintShieldPlate(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(src.width, src.height);
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "rgba(120,220,255,0.35)";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(200,245,255,0.9)";
  g.lineWidth = 1.2 * PX;
  const r = 6 * PX;
  for (let y = 0; y < c.height + r; y += r * 1.5) {
    for (let x = 0; x < c.width + r; x += r * 1.73) {
      const ox = x + ((y / (r * 1.5)) % 2 ? r * 0.86 : 0);
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const px = ox + Math.cos(a) * r * 0.8;
        const py = y + Math.sin(a) * r * 0.8;
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();
    }
  }
  return c;
}

function paintHead(): HTMLCanvasElement {
  const c = canvas(170 * PX, 130 * PX);
  const g = c.getContext("2d")!;
  g.scale(PX, PX);
  g.translate(95, 65); // snout points +x
  // horns (behind the skull)
  for (const side of [-1, 1]) {
    const hg = g.createLinearGradient(-6, side * 20, -78, side * 50);
    hg.addColorStop(0, "#efd9a3");
    hg.addColorStop(0.6, "#9a7a3e");
    hg.addColorStop(1, "#2a1a08");
    g.fillStyle = hg;
    g.beginPath();
    g.moveTo(-4, side * 14);
    g.bezierCurveTo(-30, side * 34, -58, side * 34, -82, side * 58);
    g.bezierCurveTo(-60, side * 42, -36, side * 30, -14, side * 24);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(40,20,5,0.6)";
    g.lineWidth = 0.8;
    for (let k = 1; k < 6; k++) {
      const x = -10 - k * 11;
      const y = side * (22 + k * 4.5);
      g.beginPath();
      g.moveTo(x, y - 3);
      g.lineTo(x - 2, y + 3);
      g.stroke();
    }
    // smaller back horn
    g.fillStyle = "#c9ad74";
    g.beginPath();
    g.moveTo(-18, side * 10);
    g.quadraticCurveTo(-40, side * 18, -52, side * 14);
    g.quadraticCurveTo(-36, side * 10, -22, side * 6);
    g.closePath();
    g.fill();
  }
  // neck frill
  g.fillStyle = "#1a0f2a";
  g.beginPath();
  for (let k = 0; k <= 10; k++) {
    const a = Math.PI * 0.55 + (k / 10) * Math.PI * 0.9;
    const r = k % 2 ? 26 : 34;
    const px = -16 + Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (k === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = "rgba(190,120,255,0.6)";
  g.lineWidth = 1;
  g.stroke();
  // skull
  const sk = g.createLinearGradient(-30, -26, 40, 26);
  sk.addColorStop(0, "#6a4f94");
  sk.addColorStop(0.45, "#33214f");
  sk.addColorStop(1, "#0d0716");
  g.fillStyle = sk;
  g.beginPath();
  g.moveTo(-30, 0);
  g.bezierCurveTo(-30, -26, 2, -30, 18, -22);
  g.bezierCurveTo(36, -16, 56, -10, 70, -3);
  g.lineTo(72, 0);
  g.lineTo(70, 3);
  g.bezierCurveTo(56, 10, 36, 16, 18, 22);
  g.bezierCurveTo(2, 30, -30, 26, -30, 0);
  g.closePath();
  g.fill();
  // armour plates and brow ridges
  g.strokeStyle = "rgba(170,130,230,0.5)";
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(-20, 0);
  g.lineTo(60, 0);
  g.stroke();
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(4, side * 20);
    g.quadraticCurveTo(26, side * 22, 38, side * 9);
    g.stroke();
    g.beginPath();
    g.moveTo(-14, side * 18);
    g.quadraticCurveTo(-4, side * 8, 10, side * 6);
    g.stroke();
    // brow spikes
    g.fillStyle = "#d9c08a";
    g.beginPath();
    g.moveTo(22, side * 17);
    g.lineTo(6, side * 27);
    g.lineTo(14, side * 15);
    g.closePath();
    g.fill();
    // teeth along the jaw line
    g.fillStyle = "#efe6cf";
    for (let k = 0; k < 4; k++) {
      const x = 40 + k * 7;
      const y = side * (12 - k * 2.4);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 2, y + side * 4);
      g.lineTo(x + 4, y);
      g.closePath();
      g.fill();
    }
  }
  // eye sockets (the eyes themselves glow live)
  g.fillStyle = "#000";
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(24, side * 12, 7, 3.6, side * 0.35, 0, Math.PI * 2);
    g.fill();
  }
  // rim light
  g.strokeStyle = "rgba(225,200,255,0.55)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-26, -14);
  g.bezierCurveTo(-10, -28, 12, -26, 30, -18);
  g.stroke();
  return c;
}

function paintBlob(w: number, h: number, color: string, blur: number): HTMLCanvasElement {
  const c = canvas((w + blur * 4) * PX, (h + blur * 4) * PX);
  const g = c.getContext("2d")!;
  g.filter = `blur(${blur * PX}px)`;
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(c.width / 2, c.height / 2, (w / 2) * PX, (h / 2) * PX, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

function serpentSprites(): SerpentSprites {
  if (sprites) return sprites;
  const plate = paintPlate("rgba(180,110,255,0.95)", "rgba(255,210,120,0.9)");
  sprites = {
    plate,
    plateEmber: paintPlate("rgba(255,90,40,1)", "rgba(255,220,120,1)"),
    plateFlash: paintTinted(plate, "rgba(255,245,220,0.85)"),
    plateShield: paintShieldPlate(plate),
    head: paintHead(),
    shadow: paintBlob(46, 30, "rgba(0,0,0,0.55)", 4),
    glow: paintBlob(50, 40, "rgba(160,90,255,0.5)", 7),
  };
  return sprites;
}

function stamp(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, angle: number, scale: number, ax = 0.5, ay = 0.5): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale / PX, scale / PX);
  ctx.drawImage(img, -img.width * ax, -img.height * ay);
  ctx.restore();
}

interface BodyPart {
  x: number;
  y: number;
  angle: number;
  scale: number;
  s: number;
  k: number;
}

/** Where every part of the Serpent is this frame (head first), with the slither applied. */
export function serpentParts(headS: number, timeMs: number): BodyPart[] {
  const t = timeMs / 1000;
  const parts: BodyPart[] = [];
  for (let k = 0; k <= BODY_SEGMENTS; k++) {
    const s = headS - k * SEGMENT_GAP;
    if (s < -SEGMENT_GAP * 1.5 || s > PATH_LENGTH + 4) continue;
    const p = pathAt(Math.min(s, PATH_LENGTH));
    const taper = k === 0 ? 1 : 1.18 - 0.72 * Math.pow(k / BODY_SEGMENTS, 1.25);
    const wave = Math.sin(s * 0.035 - t * 2.6) * 6 * Math.min(1, k / 3) * taper;
    const nx = -Math.sin(p.angle);
    const ny = Math.cos(p.angle);
    parts.push({ x: p.x + nx * wave, y: p.y + ny * wave - HOVER, angle: p.angle + Math.cos(s * 0.035 - t * 2.6) * 0.25 * Math.min(1, k / 3), scale: taper, s, k });
  }
  return parts;
}

function wingShape(ctx: CanvasRenderingContext2D, flap: number): { wrist: Pt; tips: Pt[]; shoulder: Pt; back: Pt } {
  const shoulder = { x: 6, y: 14 };
  const wrist = { x: -22 + flap * 8, y: 80 + flap * 16 };
  const tips = [
    { x: 46 + flap * 12, y: 150 + flap * 14 },
    { x: -24 + flap * 4, y: 182 + flap * 20 },
    { x: -98, y: 150 + flap * 14 },
    { x: -128, y: 76 + flap * 8 },
  ];
  const back = { x: -66, y: 18 };
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(wrist.x, wrist.y);
  ctx.lineTo(tips[0]!.x, tips[0]!.y);
  for (let i = 1; i < tips.length; i++) {
    const a = tips[i - 1]!;
    const c = tips[i]!;
    // scalloped edge, pulled in towards the wrist
    ctx.quadraticCurveTo((a.x + c.x) / 2 * 0.72 + wrist.x * 0.28, (a.y + c.y) / 2 * 0.72 + wrist.y * 0.28, c.x, c.y);
  }
  const last = tips[tips.length - 1]!;
  ctx.quadraticCurveTo((last.x + back.x) / 2 + 10, (last.y + back.y) / 2 + 6, back.x, back.y);
  ctx.closePath();
  return { wrist, tips, shoulder, back };
}

function drawWings(ctx: CanvasRenderingContext2D, part: BodyPart, timeMs: number, eclipse: number, shadow: boolean): void {
  const t = timeMs / 1000;
  const flap = Math.sin(t * 1.9);
  const size = 0.7 * part.scale;
  ctx.save();
  ctx.translate(part.x + (shadow ? 12 : 0), part.y + (shadow ? HOVER + 22 : 0));
  ctx.rotate(part.angle);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(size, side * size * (shadow ? 0.9 : 1));
    const w = wingShape(ctx, flap);
    if (shadow) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fill();
      ctx.restore();
      continue;
    }
    const mg = ctx.createRadialGradient(w.wrist.x, w.wrist.y, 10, w.wrist.x, w.wrist.y, 190);
    if (eclipse > 0.5) {
      mg.addColorStop(0, "rgba(50,8,14,0.9)");
      mg.addColorStop(0.55, "rgba(150,30,30,0.62)");
      mg.addColorStop(1, "rgba(255,140,70,0.38)");
    } else {
      mg.addColorStop(0, "rgba(34,14,60,0.9)");
      mg.addColorStop(0.55, "rgba(96,46,170,0.62)");
      mg.addColorStop(1, "rgba(196,150,255,0.38)");
    }
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.strokeStyle = eclipse > 0.5 ? "rgba(255,180,120,0.75)" : "rgba(220,190,255,0.7)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // veins
    ctx.strokeStyle = "rgba(255,210,255,0.18)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < w.tips.length - 1; i++) {
      const a = w.tips[i]!;
      const c = w.tips[i + 1]!;
      ctx.beginPath();
      ctx.moveTo(w.wrist.x, w.wrist.y);
      ctx.quadraticCurveTo((w.wrist.x + a.x) / 2 + 8, (w.wrist.y + c.y) / 2, (a.x + c.x) / 2, (a.y + c.y) / 2 - 10);
      ctx.stroke();
    }
    // bones: the arm, then the four fingers
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(20,10,4,0.7)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(w.shoulder.x, w.shoulder.y);
    ctx.lineTo(w.wrist.x, w.wrist.y);
    ctx.stroke();
    ctx.strokeStyle = "#b9a074";
    ctx.lineWidth = 4;
    ctx.stroke();
    for (const tip of w.tips) {
      ctx.strokeStyle = "rgba(20,10,4,0.6)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w.wrist.x, w.wrist.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.strokeStyle = "#a88f66";
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    // wrist claw
    ctx.fillStyle = "#f3e2b8";
    ctx.beginPath();
    ctx.moveTo(w.wrist.x - 2, w.wrist.y - 4);
    ctx.lineTo(w.wrist.x + 16, w.wrist.y + 2);
    ctx.lineTo(w.wrist.x - 1, w.wrist.y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** The Serpent's long body: one continuous scaled tube with an armoured ridge, side spikes and glowing seams. */
function drawBody(ctx: CanvasRenderingContext2D, parts: readonly BodyPart[], timeMs: number, opts: { eclipse: number; shield: number; flashing: (s: number) => boolean }): void {
  if (parts.length < 2) return;
  const sp = serpentSprites();
  const t = timeMs / 1000;
  const radius = (p: BodyPart) => (p.k === 0 ? 22 : 26 * p.scale);
  const edge = (p: BodyPart, side: number, f = 1) => ({ x: p.x - Math.sin(p.angle) * radius(p) * side * f, y: p.y + Math.cos(p.angle) * radius(p) * side * f });
  const tail = parts[parts.length - 1]!;
  const tip = { x: tail.x - Math.cos(tail.angle) * 26, y: tail.y - Math.sin(tail.angle) * 26 };

  // silhouette
  ctx.beginPath();
  parts.forEach((p, i) => {
    const e = edge(p, 1);
    if (i === 0) ctx.moveTo(e.x, e.y);
    else ctx.lineTo(e.x, e.y);
  });
  ctx.lineTo(tip.x, tip.y);
  for (let i = parts.length - 1; i >= 0; i--) {
    const e = edge(parts[i]!, -1);
    ctx.lineTo(e.x, e.y);
  }
  ctx.closePath();
  ctx.fillStyle = "#0e0818";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // rounded volume: lighter bands along the spine
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [f, col, dy] of [[1.45, "#1d1230", 0], [0.95, "#2c1c46", -1.5], [0.45, "#3f2a62", -2.5]] as const) {
    ctx.strokeStyle = col;
    for (let i = 0; i < parts.length - 1; i++) {
      const a = parts[i]!;
      const b = parts[i + 1]!;
      ctx.lineWidth = radius(b) * f;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + dy);
      ctx.lineTo(b.x, b.y + dy);
      ctx.stroke();
    }
  }
  // scale rings across the body
  ctx.strokeStyle = "rgba(160,120,225,0.32)";
  ctx.lineWidth = 1;
  for (const p of parts) {
    if (p.k === 0) continue;
    const l = edge(p, 0.92);
    const r = edge(p, -0.92);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.quadraticCurveTo(p.x + Math.cos(p.angle) * 9, p.y + Math.sin(p.angle) * 9, r.x, r.y);
    ctx.stroke();
  }
  // rim light on the lit side, shade on the other
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(210,180,255,0.55)";
  ctx.beginPath();
  parts.forEach((p, i) => {
    const e = edge(p, -0.96);
    if (i === 0) ctx.moveTo(e.x, e.y);
    else ctx.lineTo(e.x, e.y);
  });
  ctx.stroke();

  // glowing seams travelling down the flanks
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const seam = opts.eclipse > 0.5 ? "255,96,48" : "176,110,255";
  for (const p of parts) {
    if (p.k === 0) continue;
    const a = 0.35 + 0.45 * Math.max(0, Math.sin(t * 4 - p.k * 0.55));
    for (const side of [-1, 1]) {
      const e = edge(p, side, 0.66);
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 7 * p.scale + 2);
      g.addColorStop(0, `rgba(255,236,200,${a})`);
      g.addColorStop(0.4, `rgba(${seam},${a * 0.8})`);
      g.addColorStop(1, `rgba(${seam},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 7 * p.scale + 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // side spikes
  for (const p of parts) {
    if (p.k < 2 || p.k > BODY_SEGMENTS - 6 || p.k % 2) continue;
    for (const side of [-1, 1]) {
      const base = edge(p, side, 0.9);
      const len = 16 * p.scale;
      const dirx = -Math.cos(p.angle) * 0.7 - Math.sin(p.angle) * side * 0.7;
      const diry = -Math.sin(p.angle) * 0.7 + Math.cos(p.angle) * side * 0.7;
      const sg = ctx.createLinearGradient(base.x, base.y, base.x + dirx * len, base.y + diry * len);
      sg.addColorStop(0, "#5a3a1a");
      sg.addColorStop(1, "#f2deb0");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(base.x + Math.cos(p.angle) * 4, base.y + Math.sin(p.angle) * 4);
      ctx.lineTo(base.x + dirx * len, base.y + diry * len);
      ctx.lineTo(base.x - Math.cos(p.angle) * 4, base.y - Math.sin(p.angle) * 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  // dorsal armour ridge, tail first
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]!;
    if (p.k === 0) continue;
    const plate = opts.eclipse > 0.5 ? sp.plateEmber : sp.plate;
    stamp(ctx, plate, p.x, p.y - 2, p.angle, p.scale * 0.72);
    if (opts.shield > 0) {
      ctx.save();
      ctx.globalAlpha = opts.shield;
      stamp(ctx, sp.plateShield, p.x, p.y - 2, p.angle, p.scale * 1.15);
      ctx.restore();
    }
    if (opts.flashing(p.s)) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.6;
      stamp(ctx, sp.plateFlash, p.x, p.y, p.angle, p.scale * 1.1);
      ctx.restore();
    }
  }

  // tail fin
  ctx.save();
  ctx.translate(tail.x, tail.y);
  ctx.rotate(tail.angle);
  const fg = ctx.createLinearGradient(0, 0, -48, 0);
  fg.addColorStop(0, "rgba(120,60,200,0.9)");
  fg.addColorStop(1, opts.eclipse > 0.5 ? "rgba(255,120,60,0.5)" : "rgba(220,180,255,0.5)");
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.quadraticCurveTo(-30, -30, -50, -24);
  ctx.lineTo(-36, 0);
  ctx.lineTo(-50, 24);
  ctx.quadraticCurveTo(-30, 30, -4, 0);
  ctx.fill();
  ctx.restore();

  if (opts.shield > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(140,225,255,${0.6 * opts.shield})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    parts.forEach((p, i) => {
      const e = edge(p, 1, 1.12);
      if (i === 0) ctx.moveTo(e.x, e.y);
      else ctx.lineTo(e.x, e.y);
    });
    ctx.stroke();
    ctx.beginPath();
    parts.forEach((p, i) => {
      const e = edge(p, -1, 1.12);
      if (i === 0) ctx.moveTo(e.x, e.y);
      else ctx.lineTo(e.x, e.y);
    });
    ctx.stroke();
    ctx.restore();
  }
}

/** The whole Serpent. `flashS` = body positions hit in the last instant. */
export function drawSerpent(
  ctx: CanvasRenderingContext2D,
  headS: number,
  timeMs: number,
  opts: { eclipse: number; shield: number; shieldWarn: number; flashS: readonly number[]; dive: number; roar: number },
): void {
  const sp = serpentSprites();
  const t = timeMs / 1000;
  const parts = serpentParts(headS, timeMs).filter((p) => p.s >= -SEGMENT_GAP * 0.5);
  if (!parts.length) return;
  const visible = (p: BodyPart) => p.s <= PATH_LENGTH - 2 || opts.dive === 0;
  const shown = parts.filter(visible);

  // shadows on the ground
  for (const p of shown) stamp(ctx, sp.shadow, p.x + 8, p.y + HOVER + 10, p.angle, p.k === 0 ? 2.6 : p.scale * 1.35);

  // the under-glow
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of shown) {
    if (p.k % 2) continue;
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2 + p.k);
    stamp(ctx, sp.glow, p.x, p.y, p.angle, p.scale * 1.3);
  }
  ctx.restore();

  // wings (and their shadow) ride on the 3rd part, under the body
  const wingPart = shown.find((p) => p.k === 3);
  if (wingPart) {
    drawWings(ctx, wingPart, timeMs, opts.eclipse, true);
    drawWings(ctx, wingPart, timeMs, opts.eclipse, false);
  }

  const flashing = (s: number) => opts.flashS.some((f) => Math.abs(f - s) < SEGMENT_GAP * 0.55);
  drawBody(ctx, shown, timeMs, { eclipse: opts.eclipse, shield: opts.shield, flashing });

  // embers trailing in the Eclipse
  if (opts.eclipse > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const p = shown[Math.floor(hash(i) * shown.length)]!;
      const ph = (t * 0.8 + hash(i + 3)) % 1;
      ctx.globalAlpha = (1 - ph) * opts.eclipse;
      ctx.fillStyle = i % 2 ? "#ff7a3a" : "#ffd27a";
      ctx.beginPath();
      ctx.arc(p.x + (hash(i + 9) - 0.5) * 30, p.y - ph * 40, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // the head
  const head = parts[0]!;
  if (!visible(head)) return;
  const hs = 1 - opts.dive * 0.6;
  ctx.save();
  ctx.globalAlpha = 1 - opts.dive;
  stamp(ctx, sp.head, head.x, head.y, head.angle, 1.2 * hs, 95 / 170, 0.5);
  if (flashing(head.s)) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35;
    stamp(ctx, paintTintedCached(sp.head), head.x, head.y, head.angle, 1.2 * hs, 95 / 170, 0.5);
  }
  ctx.restore();

  // eyes, roar and crown, in the head's frame
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(head.angle);
  ctx.scale(1.2 * hs, 1.2 * hs);
  ctx.globalCompositeOperation = "lighter";
  const eyePulse = 0.7 + 0.3 * Math.sin(t * 4) + opts.shieldWarn * 0.8;
  const eyeCol = opts.eclipse > 0.5 ? "255,90,50" : "255,210,110";
  for (const side of [-1, 1]) {
    const eg = ctx.createRadialGradient(24, side * 12, 0, 24, side * 12, 16 + opts.shieldWarn * 10);
    eg.addColorStop(0, `rgba(255,250,220,${Math.min(1, eyePulse)})`);
    eg.addColorStop(0.25, `rgba(${eyeCol},${0.85 * eyePulse})`);
    eg.addColorStop(1, `rgba(${eyeCol},0)`);
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(24, side * 12, 16 + opts.shieldWarn * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  // nostril smoke / roar
  if (opts.roar > 0) {
    const rg = ctx.createRadialGradient(80, 0, 0, 80, 0, 60 * opts.roar);
    rg.addColorStop(0, `rgba(255,230,180,${0.9 * opts.roar})`);
    rg.addColorStop(0.4, `rgba(190,110,255,${0.6 * opts.roar})`);
    rg.addColorStop(1, "rgba(120,50,255,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(80, 0, 60 * opts.roar, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.9 + i / 4) % 1;
    ctx.globalAlpha = (1 - ph) * 0.5;
    ctx.fillStyle = "rgba(180,130,255,1)";
    ctx.beginPath();
    ctx.arc(70 + ph * 26, (i % 2 ? -1 : 1) * (5 + ph * 8), 2 + ph * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // eclipse crown: a black sun with a golden ring hovering behind the horns
  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.translate(-34, 0);
  ctx.rotate(-head.angle);
  const cy = -46 + Math.sin(t * 1.5) * 3;
  ctx.globalCompositeOperation = "lighter";
  const cg = ctx.createRadialGradient(0, cy, 6, 0, cy, 34);
  cg.addColorStop(0, "rgba(255,225,160,0.95)");
  cg.addColorStop(0.5, opts.eclipse > 0.5 ? "rgba(255,80,40,0.5)" : "rgba(255,160,80,0.45)");
  cg.addColorStop(1, "rgba(150,70,255,0)");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, cy, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,225,150,0.9)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(0, cy, 26, 9, Math.sin(t * 0.7) * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#030106";
  ctx.beginPath();
  ctx.arc(0, cy, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // shield bubble
  if (opts.shield > 0 || opts.shieldWarn > 0) {
    ctx.globalCompositeOperation = "lighter";
    const a = Math.max(opts.shield, opts.shieldWarn * 0.4);
    ctx.strokeStyle = `rgba(150,230,255,${0.75 * a})`;
    ctx.fillStyle = `rgba(120,200,255,${0.12 * a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + t * 0.8;
      const px = 14 + Math.cos(ang) * 70;
      const py = Math.sin(ang) * 62;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

let headFlash: HTMLCanvasElement | null = null;
function paintTintedCached(head: HTMLCanvasElement): HTMLCanvasElement {
  if (!headFlash) headFlash = paintTinted(head, "rgba(255,245,220,0.9)");
  return headFlash;
}

// ── slots, stars, towers, shots ─────────────────────────────────────────

function drawSlotMarks(ctx: CanvasRenderingContext2D, snap: ColossusSnapshot | null, timeMs: number, opts: FrameOpts): void {
  const t = timeMs / 1000;
  const occupied = new Set(snap ? snap.players.map((p) => p.slot) : []);
  COLOSSUS_SLOTS.forEach((s, i) => {
    const free = !occupied.has(i);
    const pick = opts.pickMode;
    const canMove = !!snap && opts.canMove && free;
    if (!pick && !canMove) return;
    const hover = opts.hoverSlot === i;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(1, 0.55);
    ctx.strokeStyle = hover ? "rgba(255,226,140,1)" : pick ? `rgba(255,214,120,${0.55 + 0.3 * Math.sin(t * 3 + i)})` : "rgba(200,180,255,0.55)";
    ctx.lineWidth = hover ? 3 : 2;
    if (!pick) ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
  if (snap) {
    const you = snap.players.find((p) => p.isYou);
    if (you) {
      const s = COLOSSUS_SLOTS[you.slot]!;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(1, 0.55);
      ctx.strokeStyle = "rgba(255,214,110,0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 33, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawStars(ctx: CanvasRenderingContext2D, snap: ColossusSnapshot): void {
  for (const star of snap.stars) {
    const s = COLOSSUS_SLOTS[star.slot]!;
    const left = star.impactAt - snap.timeMs;
    const k = 1 - Math.max(0, left) / STAR_WARN_MS;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.save();
    ctx.scale(1, 0.55);
    ctx.fillStyle = `rgba(255,60,40,${0.12 + 0.18 * k})`;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,90,60,${0.6 + 0.4 * Math.sin(snap.timeMs / 70)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,110,70,0.35)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // the star itself, falling in for the last moment
    if (k > 0.55) {
      const f = (k - 0.55) / 0.45;
      const sx = 160 * (1 - f);
      const sy = -260 * (1 - f);
      ctx.globalCompositeOperation = "lighter";
      const tg = ctx.createLinearGradient(sx, sy, sx + 70, sy - 110);
      tg.addColorStop(0, "rgba(255,240,200,1)");
      tg.addColorStop(1, "rgba(255,120,60,0)");
      ctx.strokeStyle = tg;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 70, sy - 110);
      ctx.stroke();
      const hg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16);
      hg.addColorStop(0, "rgba(255,255,240,1)");
      hg.addColorStop(1, "rgba(255,140,60,0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(sx, sy, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const im of snap.impacts) {
    const s = COLOSSUS_SLOTS[im.slot]!;
    const k = (snap.timeMs - im.at) / 900;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalCompositeOperation = "lighter";
    const r = 20 + k * 70;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(255,240,200,${(1 - k) * 0.9})`);
    g.addColorStop(0.5, `rgba(255,120,50,${(1 - k) * 0.6})`);
    g.addColorStop(1, "rgba(255,60,30,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,200,140,${1 - k})`;
    ctx.lineWidth = 3 * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.2, r * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + im.slot;
      ctx.fillStyle = `rgba(255,190,120,${1 - k})`;
      ctx.fillRect(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.55 - k * 30, 3, 3);
    }
    ctx.restore();
  }
}

function drawTowers(ctx: CanvasRenderingContext2D, snap: ColossusSnapshot, towers: readonly TowerInstance[], timeMs: number): void {
  const order = snap.players.map((p, i) => ({ p, i })).sort((a, b) => COLOSSUS_SLOTS[a.p.slot]!.y - COLOSSUS_SLOTS[b.p.slot]!.y);
  for (const { p, i } of order) {
    const tower = towers[i];
    if (!tower) continue;
    const s = COLOSSUS_SLOTS[p.slot]!;
    tower.position = { x: s.x, y: s.y };
    const stunned = snap.timeMs < p.stunnedUntil;
    const moving = snap.timeMs < p.movingUntil;
    ctx.save();
    if (moving) ctx.globalAlpha = 1 - (p.movingUntil - snap.timeMs) / 800;
    if (stunned) ctx.filter = "grayscale(0.85) brightness(0.6)";
    const lastShot = snap.shots.filter((sh) => sh.from === i).reduce((m, sh) => Math.max(m, sh.at), -1e9);
    drawTower(ctx, tower, false, timeMs, snap.timeMs - lastShot, true);
    ctx.restore();
    if (moving) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const k = 1 - (p.movingUntil - snap.timeMs) / 800;
      ctx.strokeStyle = `rgba(200,170,255,${1 - k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 10 + k * 34, (10 + k * 34) * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (stunned) {
      const t = timeMs / 1000;
      for (let k = 0; k < 3; k++) {
        const a = t * 4 + (k / 3) * Math.PI * 2;
        ctx.fillStyle = "#ffe08a";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("✦", s.x + Math.cos(a) * 16, s.y - 44 + Math.sin(a) * 5);
      }
    }
  }
}

/** Name tags go over everything (the Serpent included) so "YOU" never gets lost. */
function drawNameTags(ctx: CanvasRenderingContext2D, snap: ColossusSnapshot): void {
  for (const p of snap.players) {
    const s = COLOSSUS_SLOTS[p.slot]!;
    // name tag
    ctx.save();
    ctx.font = `${p.isYou ? "bold 12px" : "600 10.5px"} system-ui, sans-serif`;
    ctx.textAlign = "center";
    const label = p.isYou ? opts_youLabel : p.name;
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = p.isYou ? "rgba(60,40,8,0.85)" : "rgba(10,6,18,0.7)";
    ctx.fillRect(s.x - w / 2, s.y + 22, w, 15);
    ctx.fillStyle = p.isYou ? "#ffd66b" : "#d9cdea";
    ctx.fillText(label, s.x, s.y + 33);
    ctx.restore();
  }
}
let opts_youLabel = "YOU";

function drawShots(ctx: CanvasRenderingContext2D, snap: ColossusSnapshot, timeMs: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const sh of snap.shots) {
    const age = snap.timeMs - sh.at;
    const to = pathAt(Math.min(sh.s, PATH_LENGTH));
    const ty = to.y - HOVER;
    if (sh.strike) {
      const k = Math.min(1, age / 500);
      // the Star Strike: a column of starlight from the sky (the tower's own special plays on top)
      const bw = 26 * (1 - k) + 4;
      const bg = ctx.createLinearGradient(to.x, 0, to.x, ty);
      bg.addColorStop(0, "rgba(255,240,200,0)");
      bg.addColorStop(1, `rgba(255,240,200,${0.9 * (1 - k)})`);
      ctx.fillStyle = bg;
      ctx.fillRect(to.x - bw / 2, 0, bw, ty);
      continue;
    }
  }
  ctx.restore();
  // the local player's numbers
  ctx.save();
  ctx.textAlign = "center";
  for (const sh of snap.shots) {
    if (!snap.players[sh.from]?.isYou) continue;
    const age = snap.timeMs - sh.at;
    if (age < 140 || age > 700) continue;
    const k = (age - 140) / 560;
    const to = pathAt(Math.min(sh.s, PATH_LENGTH));
    ctx.globalAlpha = 1 - k;
    ctx.font = `800 ${sh.strike ? 22 : sh.crit ? 15 : 12}px system-ui, sans-serif`;
    ctx.fillStyle = sh.shielded ? "#9fe4ff" : sh.strike ? "#fff1c4" : sh.crit ? "#ffcf5a" : "#ffe6a8";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    const txt = formatShort(sh.amount);
    ctx.strokeText(txt, to.x, to.y - HOVER - 26 - k * 26);
    ctx.fillText(txt, to.x, to.y - HOVER - 26 - k * 26);
  }
  ctx.restore();
  void timeMs;
}

export function formatShort(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(Math.round(n));
}


/**
 * The towers' magic, exactly as in the main game: every raid shot becomes a
 * real ProjectileInstance drawn by EntityRenderer.drawProjectile, with the
 * main game's impact/trail particles (CombatFx), its special-attack sequences
 * (SpecialVfxLayer — the Star Strike is each tower's special) and its hit
 * sparks (VfxManager).
 */
export class ColossusFxLayer {
  private combat = new CombatFx();
  private special = new SpecialVfxLayer();
  private vfx = new VfxManager();
  private flying: { key: string; p: ProjectileInstance; strike: boolean }[] = [];
  private seen = new Set<string>();

  constructor() {
    preloadCombatFxArt();
    this.combat.onShake = (m, ms) => this.vfx.triggerShake(m, ms);
  }

  private static key(sh: RaidShot): string {
    return `${sh.from}:${sh.at}:${sh.strike ? 1 : 0}`;
  }

  /** Turns the snapshot's new shots into projectiles and advances every effect by `dtMs`. */
  sync(snap: ColossusSnapshot, towers: readonly TowerInstance[], dtMs: number): void {
    const live = new Set<string>();
    for (const sh of snap.shots) {
      const key = ColossusFxLayer.key(sh);
      live.add(key);
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      const tower = towers[sh.from];
      const player = snap.players[sh.from];
      if (!tower || !player) continue;
      const slot = COLOSSUS_SLOTS[player.slot]!;
      tower.position = { x: slot.x, y: slot.y };
      const muzzle = getTowerMuzzleOffset(tower);
      const hit = pathAt(Math.min(sh.s, PATH_LENGTH));
      const to = { x: hit.x, y: hit.y - HOVER };
      const chain: Pt[] = [];
      if (sh.type === "STORMCALLER") {
        for (const d of [-2, -4]) {
          const c = pathAt(Math.max(0, Math.min(PATH_LENGTH, sh.s + d * SEGMENT_GAP)));
          chain.push({ x: c.x, y: c.y - HOVER });
        }
      }
      const proj = createProjectile(sh.type, muzzle, to, chain, sh.strike, undefined, player.isYou ? tower.equippedSkinId : null);
      if (sh.strike) {
        proj.power = 1.3;
        if (sh.type === "INFERNO") this.combat.firestorm(to, 90, 1.3);
        else if (sh.type === "FROSTBORN") this.combat.frostStrike(to, 80, 1.3);
        this.special.spawn({ type: sh.type, towerPosition: slot, from: muzzle, to, chainTargets: chain, radius: sh.type === "FROSTBORN" ? 150 : 90, power: 1.3 });
      }
      this.flying.push({ key, p: proj, strike: sh.strike });
    }
    for (const k of this.seen) if (!live.has(k)) this.seen.delete(k);

    let impacts = 0;
    for (const f of this.flying) {
      f.p.remainingMs -= dtMs;
      const k = 1 - Math.max(0, f.p.remainingMs) / f.p.totalMs;
      this.combat.trail(f.p.towerType, { x: f.p.from.x + (f.p.to.x - f.p.from.x) * k, y: f.p.from.y + (f.p.to.y - f.p.from.y) * k });
      if (f.p.remainingMs <= 0 && impacts < 30) {
        impacts++;
        if (!(f.strike && (f.p.towerType === "INFERNO" || f.p.towerType === "FROSTBORN"))) this.combat.impact(f.p.towerType, f.p.from, f.p.to, f.p.chainTargets, f.strike);
        const dir = { x: f.p.to.x - f.p.from.x, y: f.p.to.y - f.p.from.y };
        this.vfx.spawnHitImpact(f.p.to, f.strike ? "#ffe6a8" : "#c79bff", dir);
      }
    }
    this.flying = this.flying.filter((f) => f.p.remainingMs > 0);
    this.combat.update(dtMs);
    this.special.update(dtMs);
    this.vfx.update(dtMs);
  }

  drawGround(ctx: CanvasRenderingContext2D, timeMs: number): void {
    this.special.drawGround(ctx, timeMs);
    this.combat.drawGround(ctx);
  }

  drawAir(ctx: CanvasRenderingContext2D, timeMs: number): void {
    for (const f of this.flying) drawProjectile(ctx, f.p);
    this.combat.drawSolid(ctx);
    this.special.drawAir(ctx, timeMs);
    this.combat.drawEmissive(ctx);
    this.vfx.draw(ctx);
  }
}

export interface FrameOpts {
  pickMode: boolean;
  hoverSlot: number | null;
  canMove: boolean;
  youLabel: string;
  /** The towers' magic layer (projectiles + the main game's impact effects). */
  fx?: ColossusFxLayer | null;
}

/** A full frame of the raid (snap = null before the attempt starts: slot picking over an idle Serpent). */
export function drawColossusFrame(ctx: CanvasRenderingContext2D, snap: ColossusSnapshot | null, towers: readonly TowerInstance[], timeMs: number, opts: FrameOpts): void {
  opts_youLabel = opts.youLabel;
  const st = snap?.timeMs ?? 0;
  const eclipse = snap ? Math.max(0, Math.min(1, (st - 100_000) / 2_000)) * (1 - (snap.dive > 0 ? snap.dive : 0)) : 0;
  // screen shake when a star lands next to you
  let shake = 0;
  if (snap) {
    const you = snap.players.find((p) => p.isYou);
    for (const im of snap.impacts) if (you && im.slot === you.slot) shake = Math.max(shake, 1 - (st - im.at) / 400);
    shake = Math.max(shake, snap.dive * (1 - snap.dive) * 2);
  }
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 8 * shake, (Math.random() - 0.5) * 8 * shake);
  drawVoid(ctx, timeMs, eclipse);
  drawArena(ctx, timeMs);
  drawRiftPortal(ctx, RIFT_AT, getBiome("ABYSS"), timeMs, [], true);
  drawCore(ctx, timeMs, eclipse, snap ? Math.sin(snap.dive * Math.PI) : 0);
  drawSlotMarks(ctx, snap, timeMs, opts);
  if (snap) opts.fx?.drawGround(ctx, timeMs);
  if (snap) {
    drawStars(ctx, snap);
    drawTowers(ctx, snap, towers, timeMs);
  }
  // the Serpent: idle (before the start) waits half out of the rift
  const headS = snap ? snap.headS : 40 + Math.sin(timeMs / 900) * 6;
  const shield = snap && st < snap.shieldUntil ? Math.min(1, (snap.shieldUntil - st) / 300, (st - (snap.shieldUntil - SHIELD_MS)) / 300) : 0;
  const shieldWarn = snap && snap.nextShieldAt !== null ? Math.max(0, 1 - (snap.nextShieldAt - st) / 2_000) : 0;
  const flashS = snap ? snap.shots.filter((s) => st - s.at > 120 && st - s.at < 280).map((s) => s.s) : [];
  const lastStrike = snap ? snap.shots.filter((s) => s.strike).reduce((m, s) => Math.max(m, s.at), -1e9) : -1e9;
  const starCast = snap ? snap.stars.some((s) => s.impactAt - st > STAR_WARN_MS - 600) : false;
  const roar = Math.max(starCast ? 0.8 : 0, Math.max(0, 1 - (st - lastStrike) / 600) * 0.6, shieldWarn * 0.7);
  drawSerpent(ctx, headS, timeMs, { eclipse, shield, shieldWarn: shield > 0 ? 0 : shieldWarn, flashS, dive: snap?.dive ?? 0, roar });
  if (snap) {
    opts.fx?.drawAir(ctx, timeMs);
    drawShots(ctx, snap, timeMs);
    drawNameTags(ctx, snap);
  }
  ctx.restore();
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  void COLOSSUS_LENGTH_MS;
}

/** The lobby's live showcase: the Serpent circling the arena without towers. */
export function drawColossusShowcase(ctx: CanvasRenderingContext2D, timeMs: number): void {
  drawVoid(ctx, timeMs, 0);
  drawArena(ctx, timeMs);
  drawRiftPortal(ctx, RIFT_AT, getBiome("ABYSS"), timeMs, [], true);
  drawCore(ctx, timeMs, 0.3, 0);
  const loop = PATH_LENGTH * 0.92;
  const headS = 200 + ((timeMs / 1000) * 70) % loop;
  drawSerpent(ctx, headS, timeMs, { eclipse: 0, shield: 0, shieldWarn: 0, flashS: [], dive: 0, roar: 0.3 + 0.3 * Math.sin(timeMs / 700) });
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

export { W as COLOSSUS_VIEW_W, H as COLOSSUS_VIEW_H };
