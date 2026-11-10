import type { TowerType } from "@/config/towerStats";
import type { Vector2 } from "@/utils/geometry";
import type { LightSource } from "./ambientLight";
import { drawFire } from "./fireFx";

/**
 * REALISTIC COMBAT EFFECTS — what a shot does when it lands, per tower:
 *
 *  - IRONWOOD (heavy bolt): metal sparks, splinters and clods of earth that
 *    arc and bounce, a puff of dust.
 *  - INFERNO (fireball): a white-hot flash, a billowing fireball that
 *    rises and turns to dark smoke, a ground shockwave, embers falling under
 *    gravity, a scorch mark left on the ground.
 *  - FROSTBORN (ice bolt): ice shards that spin and tumble, a cold mist
 *    that spreads slowly, glints, a patch of frost on the ground.
 *  - STORMCALLER (lightning): a jagged branching bolt that flickers and
 *    fades, a blinding flash, electric sparks, a scorch.
 *
 * Simple physics (gravity, drag, bounce on the ground plane, buoyant smoke),
 * soft sprites rendered once and reused (no per-particle gradients), a
 * particle budget so heavy 4x fights never tank the frame rate, and every
 * flash/fire also feeds the map's light pass so explosions light the night.
 *
 * Three draw layers: ground decals (under units), "solid" matter that the
 * night darkens (smoke, debris, shards), and "emissive" light that stays
 * bright (fire, sparks, flashes, lightning).
 */

export const MAX_PARTICLES = 1800;
const MAX_DECALS = 70;
const GRAVITY = 260; // world units / s² on the screen-space "height" axis

type Kind = "spark" | "debris" | "smoke" | "fire" | "shard" | "mist" | "flash" | "ring" | "glint" | "ember" | "flame" | "spike" | "snow" | "dust" | "rock";

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  /** Height above the ground (drawn as y - z); falls with gravity for physical bits. */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  rot: number;
  spin: number;
  color: string;
  alpha: number;
}

interface Decal {
  kind: "scorch" | "frost";
  /** Seconds the scorch keeps glowing with embers (0 = cold mark). */
  hot?: number;
  /** Seconds the mark takes to spread out from its center (frost creeping over the ground); 0 = appears whole. */
  spread?: number;
  x: number;
  y: number;
  r: number;
  rot: number;
  age: number;
  life: number;
}

interface Bolt {
  points: Vector2[];
  branches: Vector2[][];
  age: number;
  life: number;
  width: number;
}

interface Flash {
  x: number;
  y: number;
  r: number;
  rgb: [number, number, number];
  age: number;
  life: number;
}

// ---------------------------------------------------------------------------
// Baked 3D ice (public/sprites/fx): faceted, translucent crystal clusters and
// broken shards rendered offline with real ice lighting and reflections.
// ---------------------------------------------------------------------------
const ICE_CLUSTERS = 6;
const ICE_SHARDS = 4;
/** Where a cluster's ground point sits in its square image (fraction, y down). */
const ICE_CLUSTER_BASE_Y = 0.787;
const iceImages = new Map<string, HTMLImageElement>();
function iceImage(name: string): HTMLImageElement | undefined {
  let img = iceImages.get(name);
  if (!img && typeof Image !== "undefined") {
    img = new Image();
    img.decoding = "async";
    img.src = `${(import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/")}sprites/fx/${name}.webp`;
    iceImages.set(name, img);
  }
  return img && img.complete && img.naturalWidth > 0 ? img : undefined;
}
/** Start loading the ice art before the first special so it's ready in time. */
export function preloadCombatFxArt(): void {
  for (let i = 0; i < ICE_CLUSTERS; i++) iceImage(`ice_cluster_${i}`);
  for (let i = 0; i < ICE_SHARDS; i++) iceImage(`ice_shard_${i}`);
}

// ---------------------------------------------------------------------------
// Sprites (rendered once)
// ---------------------------------------------------------------------------
const sprites = new Map<string, HTMLCanvasElement>();

function sprite(key: string, size: number, paint: (g: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  let c = sprites.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    paint(g, size);
    sprites.set(key, c);
  }
  return c;
}

function softBlob(key: string, stops: [number, string][]): HTMLCanvasElement {
  return sprite(key, 64, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (const [o, c] of stops) grad.addColorStop(o, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });
}

/** A lumpy smoke puff: several overlapping soft blobs so it never reads as a perfect circle. */
function smokeSprite(): HTMLCanvasElement {
  return sprite("smoke", 96, (g, s) => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 9; i++) {
      const x = s / 2 + (rnd() - 0.5) * s * 0.36;
      const y = s / 2 + (rnd() - 0.5) * s * 0.36;
      const r = s * (0.18 + rnd() * 0.18);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.7)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    }
  });
}

function tinted(base: HTMLCanvasElement, key: string, color: string): HTMLCanvasElement {
  return sprite(`${key}:${color}`, base.width, (g) => {
    g.drawImage(base, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, base.width, base.height);
  });
}

function scorchSprite(): HTMLCanvasElement {
  return sprite("scorch", 96, (g, s) => {
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * s * 0.2;
      const x = s / 2 + Math.cos(a) * d;
      const y = s / 2 + Math.sin(a) * d;
      const r = s * (0.12 + rnd() * 0.22);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(34,22,14,0.34)");
      grad.addColorStop(1, "rgba(34,22,14,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    }
    // radial burn streaks
    g.strokeStyle = "rgba(24,14,8,0.14)";
    for (let i = 0; i < 10; i++) {
      const a = (i / 12) * Math.PI * 2 + rnd() * 0.3;
      g.lineWidth = 1 + rnd() * 2;
      g.beginPath();
      g.moveTo(s / 2 + Math.cos(a) * s * 0.12, s / 2 + Math.sin(a) * s * 0.12);
      g.lineTo(s / 2 + Math.cos(a) * s * (0.3 + rnd() * 0.17), s / 2 + Math.sin(a) * s * (0.3 + rnd() * 0.17));
      g.stroke();
    }
  });
}

function frostSprite(): HTMLCanvasElement {
  return sprite("frostDecal2", 128, (g, s) => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    // a soft, uneven bloom of rime
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * s * 0.3;
      const x = s / 2 + Math.cos(a) * d;
      const y = s / 2 + Math.sin(a) * d;
      const r = s * (0.08 + rnd() * 0.16);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(215,238,255,0.22)");
      grad.addColorStop(1, "rgba(225,244,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    }
    // frost speckle, denser toward the middle
    for (let i = 0; i < 700; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.pow(rnd(), 0.7) * s * 0.46;
      g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.45 * (1 - d / (s * 0.46))})`;
      g.fillRect(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, 1, 1);
    }
    // fine random ice cracks (no symmetry)
    g.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      let x = s / 2 + (rnd() - 0.5) * s * 0.6;
      let y = s / 2 + (rnd() - 0.5) * s * 0.6;
      let a = rnd() * Math.PI * 2;
      g.strokeStyle = `rgba(240,250,255,${0.18 + rnd() * 0.25})`;
      g.lineWidth = 0.5 + rnd() * 0.7;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        a += (rnd() - 0.5) * 1.2;
        const len = 3 + rnd() * 7;
        x += Math.cos(a) * len;
        y += Math.sin(a) * len;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

const FIRE = () => softBlob("fire", [
  [0, "rgba(255,250,220,1)"],
  [0.25, "rgba(255,200,90,0.95)"],
  [0.55, "rgba(255,110,30,0.55)"],
  [1, "rgba(200,40,10,0)"],
]);
/** Fire a moment later: cooler, redder, about to become smoke. */
const FIRE_COOL = () => softBlob("fireCool", [
  [0, "rgba(255,190,90,0.9)"],
  [0.35, "rgba(240,90,25,0.6)"],
  [1, "rgba(120,20,5,0)"],
]);
const SOFT = () => softBlob("soft", [
  [0, "rgba(255,255,255,1)"],
  [0.4, "rgba(255,255,255,0.5)"],
  [1, "rgba(255,255,255,0)"],
]);

// ---------------------------------------------------------------------------
// Lightning geometry
// ---------------------------------------------------------------------------
function jagged(a: Vector2, b: Vector2, detail: number, roughness: number): Vector2[] {
  let pts: Vector2[] = [a, b];
  let offset = Math.hypot(b.x - a.x, b.y - a.y) * roughness;
  for (let level = 0; level < detail; level++) {
    const next: Vector2[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]!;
      const q = pts[i]!;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const o = (Math.random() - 0.5) * offset;
      next.push({ x: (p.x + q.x) / 2 + nx * o, y: (p.y + q.y) / 2 + ny * o }, q);
    }
    pts = next;
    offset *= 0.55;
  }
  return pts;
}

// ---------------------------------------------------------------------------
// The manager
// ---------------------------------------------------------------------------
interface Meteor {
  from: Vector2;
  to: Vector2;
  age: number;
  fall: number;
  radius: number;
  power: number;
}

interface Nova {
  center: Vector2;
  radius: number;
  age: number;
  expand: number;
  spikes: { x: number; y: number; d: number; h: number; done: boolean }[];
  power: number;
}

export class CombatFx {
  /** Set by the renderer: a camera shake for the big blasts. */
  onShake: ((magnitude: number, ms: number) => void) | null = null;
  private meteors: Meteor[] = [];
  private novas: Nova[] = [];
  private burns: { x: number; y: number; r: number; age: number; life: number }[] = [];
  private particles: Particle[] = [];
  private decals: Decal[] = [];
  private bolts: Bolt[] = [];
  private flashes: Flash[] = [];

  /** Light the effects throw this frame (fed into the map's light pass). */
  lights(): LightSource[] {
    const out: LightSource[] = [];
    for (const f of this.flashes) {
      const k = 1 - f.age / f.life;
      out.push({ x: f.x, y: f.y, r: f.r, rgb: f.rgb, intensity: k * k });
    }
    for (const b of this.bolts) {
      const end = b.points[b.points.length - 1]!;
      out.push({ x: end.x, y: end.y, r: 120, rgb: [170, 200, 255], intensity: (1 - b.age / b.life) * 0.9 });
    }
    for (const m of this.meteors) {
      const k = Math.min(1, m.age / m.fall);
      out.push({ x: m.from.x + (m.to.x - m.from.x) * k, y: m.from.y + (m.to.y - m.from.y) * k, r: 110, rgb: [255, 150, 60], intensity: 0.9 });
    }
    for (const b of this.burns) out.push({ x: b.x, y: b.y, r: b.r * 2.2, rgb: [255, 130, 50], intensity: 0.8 * (1 - b.age / b.life) });
    for (const n of this.novas) {
      const k = Math.min(1, n.age / n.expand);
      out.push({ x: n.center.x, y: n.center.y, r: n.radius * (0.5 + k), rgb: [150, 210, 255], intensity: 0.7 * (1 - Math.max(0, (n.age - n.expand) / 1.2)) });
    }
    return out;
  }

  /** A shot of `type` just landed at `to` (fired from `from`; chain points for lightning). */
  impact(type: TowerType, from: Vector2, to: Vector2, chain: readonly Vector2[], special: boolean): void {
    const scale = special ? 1.8 : 1;
    const dir = Math.atan2(to.y - from.y, to.x - from.x);
    switch (type) {
      case "IRONWOOD":
        this.ironwood(to, dir, scale);
        break;
      case "INFERNO":
        this.inferno(to, scale);
        break;
      case "FROSTBORN":
        this.frost(to, dir, scale);
        break;
      case "STORMCALLER":
        this.lightning(from, to, chain, scale);
        break;
    }
  }

  /**
   * INFERNO special "Firestorm": a burning meteor drops onto `to` and blows
   * up across the real blast `radius` — fireball, mushroom of smoke, flying
   * rocks, a burning field and a glowing crater.
   */
  firestorm(to: Vector2, radius: number, power = 1): void {
    const r = Math.max(40, radius) * (0.85 + 0.15 * power);
    this.meteors.push({ from: { x: to.x - 150, y: to.y - 330 }, to, age: 0, fall: 0.34, radius: r, power });
  }

  /**
   * FROSTBORN special "Absolute Zero": a wave of cold rolls out from the
   * tower to its real range — mist hugging the ground, faceted ice crystals
   * bursting up where it passes and shattering, falling snow, a frost-white
   * ground.
   */
  frostNova(center: Vector2, radius: number, power = 1): void {
    const R = Math.max(60, radius);
    const spikes: Nova["spikes"] = [];
    const count = Math.round(7 + R / 22);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const d = R * (0.35 + 0.65 * Math.random());
      spikes.push({ x: center.x + Math.cos(a) * d, y: center.y + Math.sin(a) * d * 0.62, d, h: (20 + Math.random() * 26) * power, done: false });
    }
    this.novas.push({ center, radius: R, age: 0, expand: 0.5, spikes, power });
    this.flash(center, 140 * power, [170, 225, 255], 0.3);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ kind: "mist", x: center.x, y: center.y, z: 6, vx: Math.cos(a) * 40, vy: Math.sin(a) * 20, vz: 6, life: 1.2, size: 10, grow: 34, color: "rgb(230,246,255)", alpha: 0.55 });
    }
    this.decals.push({ kind: "frost", x: center.x, y: center.y, r: R * 1.08, rot: Math.random() * Math.PI * 2, age: 0, life: 3.2, spread: 0.5 });
    if (this.decals.length > MAX_DECALS) this.decals.shift();
    this.onShake?.(1.4, 160);
  }

  private explodeMeteor(m: Meteor): void {
    const p = m.to;
    const R = m.radius;
    this.onShake?.(2.6 * m.power, 260);
    this.flash(p, R * 3.2, [255, 200, 120], 0.35);
    this.flash(p, R * 1.4, [255, 250, 230], 0.12);
    // ground shockwaves: a bright heat ring and a slower ring of dust
    this.add({ kind: "ring", x: p.x, y: p.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.3, size: R * 1.5, grow: 0, color: "255,225,170", alpha: 0.35 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2;
      const v = R * (2.2 + Math.random() * 0.8);
      this.add({ kind: "dust", x: p.x + Math.cos(a) * R * 0.2, y: p.y + Math.sin(a) * R * 0.12, z: 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55, vz: 6, life: 0.9 + Math.random() * 0.4, size: R * 0.14, grow: R * 0.5, color: "rgb(120,98,78)", alpha: 0.5 });
    }
    // the fireball: white-hot core lobes, then a billow of fire
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ kind: "fire", x: p.x + Math.cos(a) * 6, y: p.y + Math.sin(a) * 4, z: 10, vx: Math.cos(a) * 26, vy: Math.sin(a) * 12, vz: 40, life: 0.42, size: R * 0.32, grow: R * 0.7, color: "", alpha: 1 });
    }
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = R * (0.8 + Math.random() * 1.6);
      this.add({ kind: "fire", x: p.x, y: p.y, z: 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55, vz: 30 + Math.random() * 70, life: 0.55 + Math.random() * 0.45, size: R * (0.16 + Math.random() * 0.16), grow: R * 0.55, color: "", alpha: 0.9 });
    }
    // the mushroom: a column of fire climbing into a dark plume
    for (let i = 0; i < 9; i++) {
      this.add({ kind: "fire", x: p.x + (Math.random() - 0.5) * R * 0.3, y: p.y, z: 12, vx: (Math.random() - 0.5) * 16, vy: 0, vz: 120 + Math.random() * 90, life: 0.55 + Math.random() * 0.3, size: R * 0.2, grow: R * 0.45, color: "", alpha: 0.9 });
    }
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * R * 0.55;
      this.add({ kind: "smoke", x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 18 + Math.random() * 30, vx: Math.cos(a) * 22 + 10, vy: Math.sin(a) * 8, vz: 45 + Math.random() * 70, life: 2.4 + Math.random() * 1.6, size: R * 0.24, grow: R * 1.05, color: Math.random() < 0.5 ? "rgb(34,30,28)" : "rgb(58,50,44)", alpha: 0.74 });
    }
    // rocks thrown out, glowing hot as they fly
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = R * (1 + Math.random() * 1.8);
      this.add({ kind: "rock", x: p.x, y: p.y, z: 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55, vz: 120 + Math.random() * 170, life: 1.2 + Math.random() * 0.6, size: 1.8 + Math.random() * 2.6, grow: 0, color: "#2a1e18", alpha: 1, spin: (Math.random() - 0.5) * 14 });
    }
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = R * (0.8 + Math.random() * 2.4);
      this.add({ kind: "ember", x: p.x, y: p.y, z: 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: 120 + Math.random() * 200, life: 1 + Math.random() * 1.2, size: 1.8, grow: 0, color: "255,170,60", alpha: 1 });
    }
    this.burns.push({ x: p.x, y: p.y, r: R, age: 0, life: 1.6 });
    this.decals.push({ kind: "scorch", x: p.x, y: p.y, r: R * 1.35, rot: Math.random() * Math.PI * 2, age: 0, life: 8, hot: 2.4 });
    if (this.decals.length > MAX_DECALS) this.decals.shift();
  }

  /** Trail left by a projectile in flight (call once per frame per projectile). */
  trail(type: TowerType, at: Vector2): void {
    if (this.particles.length > MAX_PARTICLES * 0.8) return;
    if (type === "INFERNO") {
      this.add({ kind: "fire", x: at.x, y: at.y, z: 8, vx: 0, vy: 0, vz: 10, life: 0.22, size: 7, grow: 12, color: "", alpha: 0.7 });
      if (Math.random() < 0.6) this.add({ kind: "smoke", x: at.x, y: at.y, z: 8, vx: 0, vy: 0, vz: 18, life: 0.9, size: 6, grow: 14, color: "rgb(60,52,48)", alpha: 0.32 });
    } else if (type === "FROSTBORN" && Math.random() < 0.7) {
      this.add({ kind: "mist", x: at.x, y: at.y, z: 8, vx: 0, vy: 0, vz: 0, life: 0.45, size: 5, grow: 10, color: "rgb(210,240,255)", alpha: 0.4 });
    }
  }

  private ironwood(p: Vector2, dir: number, s: number): void {
    // sparks thrown back/sideways off the impact
    for (let i = 0; i < Math.round(12 * s); i++) {
      const a = dir + Math.PI + (Math.random() - 0.5) * 2.4;
      const v = 140 + Math.random() * 220;
      this.add({ kind: "spark", x: p.x, y: p.y, z: 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: 60 + Math.random() * 130, life: 0.3 + Math.random() * 0.3, size: 1.8, grow: 0, color: "255,225,150", alpha: 1 });
    }
    // splinters and clods
    for (let i = 0; i < Math.round(9 * s); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 90;
      this.add({ kind: "debris", x: p.x, y: p.y, z: 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55, vz: 70 + Math.random() * 100, life: 0.9 + Math.random() * 0.6, size: 1.8 + Math.random() * 2.2, grow: 0, color: Math.random() < 0.5 ? "#6a4a2a" : "#4a3a28", alpha: 1, spin: (Math.random() - 0.5) * 18 });
    }
    // dust
    for (let i = 0; i < Math.round(5 * s); i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ kind: "smoke", x: p.x + Math.cos(a) * 5, y: p.y + Math.sin(a) * 3, z: 2, vx: Math.cos(a) * 28, vy: Math.sin(a) * 14, vz: 10, life: 0.8 + Math.random() * 0.5, size: 7, grow: 24, color: "rgb(160,138,108)", alpha: 0.45 });
    }
    this.flash(p, 50 * s, [255, 230, 170], 0.1);
    if (s > 1) this.ring(p, 40 * s, "255,230,170", 0.3);
  }

  private inferno(p: Vector2, s: number): void {
    const r = 30 * s;
    this.flash(p, 170 * s, [255, 170, 80], 0.26);
    // the core: a few big white-hot lobes that swell fast
    for (let i = 0; i < Math.round(5 * s); i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ kind: "fire", x: p.x + Math.cos(a) * 4, y: p.y + Math.sin(a) * 3, z: 8, vx: Math.cos(a) * 20, vy: Math.sin(a) * 10, vz: 30, life: 0.3 + Math.random() * 0.15, size: 12 * s, grow: 30 * s, color: "", alpha: 1 });
    }
    // the billow: puffs bursting outward, climbing, cooling
    for (let i = 0; i < Math.round(16 * s); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 80 * s;
      this.add({ kind: "fire", x: p.x, y: p.y, z: 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.55, vz: 30 + Math.random() * 50, life: 0.45 + Math.random() * 0.35, size: 8 + Math.random() * 8 * s, grow: 26 * s, color: "", alpha: 0.85 });
    }
    // thick smoke that rises out of the fireball and lingers
    for (let i = 0; i < Math.round(10 * s); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.6;
      this.add({ kind: "smoke", x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.5, z: 14 + Math.random() * 10, vx: Math.cos(a) * 18 + 8, vy: Math.sin(a) * 8, vz: 30 + Math.random() * 30, life: 1.6 + Math.random() * 1.4, size: 12 * s, grow: 34 * s, color: "rgb(46,40,36)", alpha: 0.55 });
    }
    // embers arcing out and falling
    for (let i = 0; i < Math.round(14 * s); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 70 + Math.random() * 140 * s;
      this.add({ kind: "ember", x: p.x, y: p.y, z: 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: 90 + Math.random() * 140, life: 0.8 + Math.random() * 0.8, size: 1.6, grow: 0, color: "255,170,60", alpha: 1 });
    }
    // a heat ring racing out along the ground
    this.add({ kind: "ring", x: p.x, y: p.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.32, size: r * 2.4, grow: 0, color: "255,200,130", alpha: 0.5 });
    this.decal("scorch", p, r * 1.3, 7);
  }

  private frost(p: Vector2, dir: number, s: number): void {
    this.flash(p, 70 * s, [170, 225, 255], 0.12);
    for (let i = 0; i < Math.round(12 * s); i++) {
      const a = dir + (Math.random() - 0.5) * 3.6;
      const v = 60 + Math.random() * 140;
      this.add({ kind: "shard", x: p.x, y: p.y, z: 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: 70 + Math.random() * 110, life: 0.8 + Math.random() * 0.6, size: 2.6 + Math.random() * 3 * s, grow: 0, color: "", alpha: 1, spin: (Math.random() - 0.5) * 16 });
    }
    for (let i = 0; i < Math.round(7 * s); i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ kind: "mist", x: p.x, y: p.y, z: 4, vx: Math.cos(a) * 30, vy: Math.sin(a) * 14, vz: 5, life: 1.1 + Math.random() * 0.7, size: 9, grow: 30 * s, color: "rgb(225,244,255)", alpha: 0.55 });
    }
    for (let i = 0; i < Math.round(6 * s); i++) {
      this.add({ kind: "glint", x: p.x + (Math.random() - 0.5) * 24 * s, y: p.y + (Math.random() - 0.5) * 14 * s, z: 6 + Math.random() * 14, vx: 0, vy: 0, vz: 6, life: 0.4 + Math.random() * 0.4, size: 2.4, grow: 0, color: "", alpha: 1 });
    }
    this.decal("frost", p, 26 * s, 5);
  }

  private lightning(from: Vector2, to: Vector2, chain: readonly Vector2[], s: number): void {
    const hops: [Vector2, Vector2][] = [[{ x: from.x, y: from.y - 6 }, to]];
    let prev = to;
    for (const c of chain) {
      hops.push([prev, c]);
      prev = c;
    }
    hops.forEach(([a, b], i) => {
      const points = jagged(a, b, 5, 0.22);
      const branches: Vector2[][] = [];
      for (let k = 0; k < 2; k++) {
        const at = points[Math.floor(points.length * (0.3 + Math.random() * 0.4))]!;
        const ang = Math.atan2(b.y - a.y, b.x - a.x) + (Math.random() - 0.5) * 1.6;
        const len = Math.hypot(b.x - a.x, b.y - a.y) * (0.15 + Math.random() * 0.2);
        branches.push(jagged(at, { x: at.x + Math.cos(ang) * len, y: at.y + Math.sin(ang) * len }, 3, 0.3));
      }
      this.bolts.push({ points, branches, age: -i * 0.03, life: 0.24, width: (i === 0 ? 2.2 : 1.6) * s });
      this.flash(b, 90 * s, [190, 210, 255], 0.1);
      for (let k = 0; k < Math.round(7 * s); k++) {
        const ang = Math.random() * Math.PI * 2;
        const v = 80 + Math.random() * 160;
        this.add({ kind: "spark", x: b.x, y: b.y, z: 8, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * 0.6, vz: 20 + Math.random() * 60, life: 0.15 + Math.random() * 0.2, size: 1.2, grow: 0, color: "200,225,255", alpha: 1 });
      }
      this.decal("scorch", b, 9 * s, 3);
    });
  }

  private flash(p: Vector2, r: number, rgb: [number, number, number], life: number): void {
    this.flashes.push({ x: p.x, y: p.y, r, rgb, age: 0, life });
    if (this.flashes.length > 60) this.flashes.shift();
  }

  private ring(p: Vector2, r: number, rgb: string, life: number): void {
    this.add({ kind: "ring", x: p.x, y: p.y, z: 0, vx: 0, vy: 0, vz: 0, life, size: r, grow: 0, color: rgb, alpha: 0.7 });
  }

  private decal(kind: Decal["kind"], p: Vector2, r: number, life: number): void {
    this.decals.push({ kind, x: p.x, y: p.y, r, rot: Math.random() * Math.PI * 2, age: 0, life });
    if (this.decals.length > MAX_DECALS) this.decals.shift();
  }

  private add(p: Omit<Particle, "age" | "rot" | "spin"> & { spin?: number }): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({ ...p, age: 0, rot: Math.random() * Math.PI * 2, spin: p.spin ?? 0 });
  }

  private shatterSpike(p: Particle): void {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 70;
      this.add({ kind: "shard", x: p.x, y: p.y, z: p.size * (0.3 + Math.random() * 0.6), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: 30 + Math.random() * 60, life: 0.6 + Math.random() * 0.4, size: 1.8 + Math.random() * 1.8, grow: 0, color: "", alpha: 1, spin: (Math.random() - 0.5) * 16 });
    }
    this.add({ kind: "mist", x: p.x, y: p.y, z: 4, vx: 0, vy: 0, vz: 4, life: 0.8, size: 6, grow: 16, color: "rgb(235,248,255)", alpha: 0.4 });
  }

  update(dtMs: number): void {
    const dt = Math.min(0.05, dtMs / 1000);
    for (const m of this.meteors) {
      const k0 = Math.min(1, m.age / m.fall);
      m.age += dt;
      const k = Math.min(1, m.age / m.fall);
      // a continuous trail: puffs laid all along the stretch flown this frame
      const steps = 7;
      for (let i = 0; i < steps; i++) {
        const kk = k0 + ((k - k0) * (i + Math.random())) / steps;
        const px = m.from.x + (m.to.x - m.from.x) * kk + (Math.random() - 0.5) * 4;
        const py = m.from.y + (m.to.y - m.from.y) * kk + (Math.random() - 0.5) * 4;
        this.add({ kind: "fire", x: px, y: py, z: 0, vx: (Math.random() - 0.5) * 14, vy: -14, vz: 0, life: 0.22 + Math.random() * 0.12, size: 5 * m.power, grow: 18, color: "", alpha: 0.75 });
        if (i % 2 === 0) this.add({ kind: "smoke", x: px, y: py, z: 0, vx: (Math.random() - 0.5) * 8, vy: -8, vz: 8, life: 1.2 + Math.random() * 0.5, size: 5, grow: 26, color: "rgb(54,46,42)", alpha: 0.38 });
      }
      if (m.age >= m.fall) this.explodeMeteor(m);
    }
    this.meteors = this.meteors.filter((m) => m.age < m.fall);
    for (const b of this.burns) {
      b.age += dt;
      // the blast field keeps burning: flame tongues licking up here and there
      const rate = 26 * (1 - b.age / b.life);
      if (Math.random() < rate * dt * 0.9) {
        for (let i = 0; i < 1; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * b.r * 0.75;
          this.add({ kind: "flame", x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d * 0.6, z: 0, vx: 0, vy: 0, vz: 0, life: 0.6 + Math.random() * 0.6, size: 4 + Math.random() * 5, grow: 0, color: "", alpha: 1, spin: Math.random() });
          if (Math.random() < 0.4) this.add({ kind: "smoke", x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d * 0.6, z: 14, vx: 6, vy: 0, vz: 30, life: 1.4, size: 6, grow: 20, color: "rgb(48,42,38)", alpha: 0.4 });
        }
      }
    }
    this.burns = this.burns.filter((b) => b.age < b.life);
    for (const n of this.novas) {
      const prevFront = Math.min(1, n.age / n.expand) ** 0.6 * n.radius;
      n.age += dt;
      const front = Math.min(1, n.age / n.expand) ** 0.6 * n.radius;
      if (front > prevFront) {
        // mist rolling along the front
        const steps = Math.round(10 + front / 9);
        for (let i = 0; i < steps; i++) {
          if (Math.random() > 0.28) continue;
          const a = Math.random() * Math.PI * 2;
          const d = front * (0.9 + Math.random() * 0.12);
          this.add({ kind: "mist", x: n.center.x + Math.cos(a) * d, y: n.center.y + Math.sin(a) * d * 0.62, z: 3, vx: Math.cos(a) * 34, vy: Math.sin(a) * 18, vz: 2, life: 1.1 + Math.random() * 0.7, size: 12, grow: 34, color: "rgb(214,236,255)", alpha: 0.22 });
        }
        for (const sp of n.spikes) {
          if (sp.done || sp.d > front) continue;
          sp.done = true;
          this.add({ kind: "spike", x: sp.x, y: sp.y, z: 0, vx: 0, vy: 0, vz: 0, life: 1.1 + Math.random() * 0.35, size: sp.h, grow: 0, color: "", alpha: 1, spin: Math.random() });
          this.add({ kind: "glint", x: sp.x, y: sp.y, z: sp.h * 0.8, vx: 0, vy: 0, vz: 4, life: 0.5, size: 3, grow: 0, color: "", alpha: 1 });
        }
      }
      // snow drifting down over the frozen area
      if (n.age < n.expand + 1 && Math.random() < 0.5) {
        for (let i = 0; i < 1; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * n.radius;
          this.add({ kind: "snow", x: n.center.x + Math.cos(a) * d, y: n.center.y + Math.sin(a) * d * 0.62, z: 30 + Math.random() * 40, vx: 8, vy: 0, vz: -18 - Math.random() * 14, life: 2.2, size: 0.7 + Math.random() * 0.9, grow: 0, color: "", alpha: 0.5 + Math.random() * 0.5, spin: Math.random() * 6 });
        }
      }
    }
    this.novas = this.novas.filter((n) => n.age < n.expand + 1.4);
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.life) {
        if (p.kind === "spike") this.shatterSpike(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.spin * dt;
      switch (p.kind) {
        case "snow":
          p.x += Math.sin(p.age * 3 + p.spin) * 12 * dt;
          if (p.z <= 0) {
            p.z = 0;
            p.vz = 0;
            p.vx = 0;
          }
          break;
        case "spark":
        case "ember":
        case "debris":
        case "rock":
        case "shard":
          p.vz -= GRAVITY * dt;
          if (p.z <= 0) {
            p.z = 0;
            // bounce with loss; sparks die on the ground
            if (p.kind === "spark") p.age = p.life;
            p.vz = Math.abs(p.vz) * (p.kind === "debris" || p.kind === "rock" ? 0.35 : 0.25);
            p.vx *= 0.55;
            p.vy *= 0.55;
            p.spin *= 0.5;
          }
          p.vx *= 1 - 1.2 * dt;
          p.vy *= 1 - 1.2 * dt;
          break;
        case "smoke":
        case "mist":
        case "dust":
        case "fire":
          // buoyant, slowed by the air, drifting with a light wind
          p.vx = p.vx * (1 - 2.2 * dt) + 6 * dt;
          p.vy *= 1 - 2.2 * dt;
          if (p.kind === "mist" || p.kind === "dust") p.vz *= 1 - 3 * dt;
          break;
        default:
          break;
      }
      alive.push(p);
    }
    this.particles = alive;
    for (const d of this.decals) d.age += dt;
    this.decals = this.decals.filter((d) => d.age < d.life);
    for (const b of this.bolts) b.age += dt;
    this.bolts = this.bolts.filter((b) => b.age < b.life);
    for (const f of this.flashes) f.age += dt;
    this.flashes = this.flashes.filter((f) => f.age < f.life);
  }

  /** Scorch marks and frost patches, under every unit. */
  drawGround(ctx: CanvasRenderingContext2D): void {
    if (this.decals.length === 0) return;
    for (const d of this.decals) {
      const k = d.age / d.life;
      const fade = k < 0.08 ? k / 0.08 : 1 - Math.max(0, (k - 0.5) / 0.5);
      const img = d.kind === "scorch" ? scorchSprite() : frostSprite();
      ctx.save();
      ctx.globalAlpha = d.spread ? Math.min(0.85, fade * 1.3) : fade;
      ctx.translate(d.x, d.y);
      ctx.scale(1, 0.55);
      // frost creeps outward with the cold wave (its soft edge grows with it) instead of popping in
      const r = d.spread ? d.r * Math.max(0.15, Math.min(1, Math.pow(d.age / d.spread, 0.6))) : d.r;
      ctx.rotate(d.rot);
      ctx.drawImage(img, -r, -r, r * 2, r * 2);
      ctx.restore();
    }
  }

  /** Smoke, dust, debris and ice — real matter, darkened by the night like everything else. */
  drawSolid(ctx: CanvasRenderingContext2D): void {
    const smoke = smokeSprite();
    ctx.save();
    for (const p of this.particles) {
      const k = p.age / p.life;
      const sy = p.y - p.z;
      if (p.kind === "spike") {
        const cluster = iceImage(`ice_cluster_${Math.floor(p.spin * ICE_CLUSTERS) % ICE_CLUSTERS}`);
        if (cluster) drawIceCluster(ctx, cluster, p, k);
        else drawIceSpike(ctx, p, k);
        continue;
      }
      if (p.kind === "snow") {
        ctx.globalAlpha = (k > 0.8 ? (1 - k) / 0.2 : 0.85) * p.alpha;
        ctx.fillStyle = "rgba(250,253,255,1)";
        ctx.beginPath();
        ctx.arc(p.x, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (p.kind === "smoke" || p.kind === "mist" || p.kind === "dust") {
        const size = p.size + p.grow * k;
        ctx.globalAlpha = p.alpha * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
        ctx.drawImage(tinted(smoke, "smoke", p.color), p.x - size, sy - size, size * 2, size * 2);
      } else if (p.kind === "debris" || p.kind === "rock") {
        ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, sy);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
        ctx.restore();
        if (p.z > 1) {
          ctx.globalAlpha *= 0.25;
          ctx.fillStyle = "#000";
          ctx.fillRect(p.x - p.size * 0.6, p.y - 0.5, p.size * 1.2, 1);
        }
      } else if (p.kind === "shard") {
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        const shardImg = iceImage(`ice_shard_${Math.floor((p.rot * 7 + p.size * 13) % ICE_SHARDS + ICE_SHARDS) % ICE_SHARDS}`);
        if (shardImg) {
          ctx.save();
          ctx.translate(p.x, sy);
          ctx.rotate(p.rot);
          const w = p.size * 5;
          ctx.drawImage(shardImg, -w / 2, -w / 2, w, w);
          ctx.restore();
          continue;
        }
        ctx.save();
        ctx.translate(p.x, sy);
        ctx.rotate(p.rot);
        const s = p.size;
        ctx.fillStyle = "rgba(200,238,255,0.92)";
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.6);
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(0, s * 1.2);
        ctx.lineTo(-s * 0.6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.6);
        ctx.lineTo(s * 0.25, -s * 0.2);
        ctx.lineTo(-s * 0.2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /** Fire, sparks, embers, glints, flashes, rings and lightning — light itself, drawn after the night pass so it stays bright. */
  drawEmissive(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const fire = FIRE();
    const soft = SOFT();
    for (const f of this.flashes) {
      const k = f.age / f.life;
      const r = f.r * 0.45 * (0.6 + 0.4 * k);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.drawImage(tinted(soft, "soft", `rgb(${f.rgb[0]},${f.rgb[1]},${f.rgb[2]})`), f.x - r, f.y - r - 6, r * 2, r * 2);
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.drawImage(soft, f.x - r * 0.35, f.y - r * 0.35 - 6, r * 0.7, r * 0.7);
    }
    for (const p of this.particles) {
      const k = p.age / p.life;
      const sy = p.y - p.z;
      if (p.kind === "fire") {
        const size = p.size + p.grow * k;
        ctx.globalAlpha = p.alpha * (1 - k) * (1 - k * 0.5);
        ctx.drawImage(k < 0.45 ? fire : FIRE_COOL(), p.x - size, sy - size, size * 2, size * 2);
      } else if (p.kind === "spark" || p.kind === "ember") {
        const a = p.kind === "ember" ? (1 - k) * (0.7 + 0.3 * Math.sin(p.age * 40)) : 1 - k;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = `rgba(${p.color},${a})`;
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        const tx = p.vx * 0.02;
        const ty = (p.vy - p.vz) * 0.02;
        ctx.beginPath();
        ctx.moveTo(p.x, sy);
        ctx.lineTo(p.x - tx, sy - ty);
        ctx.stroke();
      } else if (p.kind === "rock") {
        // still glowing from the blast as it flies
        const heat = Math.max(0, 1 - k * 1.6);
        if (heat > 0) {
          ctx.globalAlpha = heat * 0.9;
          const r = p.size * 3;
          ctx.drawImage(fire, p.x - r, sy - r, r * 2, r * 2);
        }
      } else if (p.kind === "flame") {
        // real layered flames (same as a burning building) rising and dying down
        const life = Math.sin(k * Math.PI);
        if (life > 0.05) {
          ctx.globalAlpha = 1;
          drawFire(ctx, p.x, sy, p.age * 1000 + p.spin * 5000, (1 + p.size * 0.12) * life, p.spin * 97);
        }
      } else if (p.kind === "glint") {
        const a = Math.sin(k * Math.PI);
        ctx.globalAlpha = a;
        ctx.strokeStyle = "rgba(240,252,255,1)";
        ctx.lineWidth = 1;
        const s = p.size * (0.6 + a * 0.6);
        ctx.beginPath();
        ctx.moveTo(p.x - s, sy);
        ctx.lineTo(p.x + s, sy);
        ctx.moveTo(p.x, sy - s);
        ctx.lineTo(p.x, sy + s);
        ctx.stroke();
      } else if (p.kind === "ring") {
        const r = p.size * (0.3 + 0.7 * Math.sqrt(k));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = `rgba(${p.color},${p.alpha * (1 - k)})`;
        ctx.lineWidth = 2 * (1 - k) + 0.4;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // the meteors themselves: a molten rock wrapped in fire
    for (const m of this.meteors) {
      const k = Math.min(1, m.age / m.fall);
      const x = m.from.x + (m.to.x - m.from.x) * k;
      const y = m.from.y + (m.to.y - m.from.y) * k;
      const ang = Math.atan2(m.to.y - m.from.y, m.to.x - m.from.x);
      // the streak of burning air behind it
      const tail = 150 * m.power;
      const sg = ctx.createLinearGradient(x, y, x - Math.cos(ang) * tail, y - Math.sin(ang) * tail);
      sg.addColorStop(0, "rgba(255,230,170,0.85)");
      sg.addColorStop(0.25, "rgba(255,140,50,0.45)");
      sg.addColorStop(1, "rgba(200,60,20,0)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = sg;
      ctx.lineCap = "round";
      ctx.lineWidth = 7 * m.power;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(ang) * tail, y - Math.sin(ang) * tail);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(FIRE_COOL(), -46 * m.power, -13 * m.power, 56 * m.power, 26 * m.power);
      ctx.drawImage(fire, -28 * m.power, -11 * m.power, 40 * m.power, 22 * m.power);
      ctx.drawImage(soft, -7 * m.power, -7 * m.power, 14 * m.power, 14 * m.power);
      ctx.restore();
    }
    // a crater still glowing with embers
    for (const d of this.decals) {
      if (!d.hot || d.age > d.hot) continue;
      const heat = 1 - d.age / d.hot;
      ctx.globalAlpha = 0.55 * heat * (0.85 + 0.15 * Math.sin(d.age * 9));
      ctx.drawImage(FIRE_COOL(), d.x - d.r * 0.7, d.y - d.r * 0.38, d.r * 1.4, d.r * 0.76);
    }
    // lightning: wide soft glow + bright core, flickering as it fades
    for (const b of this.bolts) {
      if (b.age < 0) continue;
      const k = b.age / b.life;
      const flicker = k < 0.5 ? 1 : Math.random() < 0.5 ? 0.35 : 0.9;
      const a = (1 - k) * flicker;
      const stroke = (pts: Vector2[], w: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
        ctx.stroke();
      };
      ctx.globalAlpha = 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      stroke(b.points, b.width * 5, `rgba(120,150,255,${0.18 * a})`);
      stroke(b.points, b.width * 2.2, `rgba(170,200,255,${0.45 * a})`);
      stroke(b.points, b.width, `rgba(245,250,255,${0.95 * a})`);
      for (const br of b.branches) {
        stroke(br, b.width * 2, `rgba(150,180,255,${0.3 * a})`);
        stroke(br, b.width * 0.6, `rgba(235,245,255,${0.8 * a})`);
      }
    }
    ctx.restore();
  }
}

/**
 * A cluster of faceted ice crystals bursting out of the ground: each prism
 * has a lit face and a shaded face, a bright ridge, a translucent body and a
 * soft cold glow at its foot. Grows fast, holds, then (on expiry) shatters.
 */
function drawIceSpike(ctx: CanvasRenderingContext2D, p: Particle, k: number): void {
  const grow = Math.min(1, k / 0.12);
  const ease = 1 - Math.pow(1 - grow, 3);
  const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
  const H = p.size * ease;
  if (H < 0.5) return;
  ctx.save();
  ctx.globalAlpha = fade;
  // shadow + frost at the foot
  ctx.fillStyle = "rgba(20,40,60,0.22)";
  ctx.beginPath();
  ctx.ellipse(p.x + H * 0.25, p.y + 1, H * 0.45, H * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  // every cluster is different: 2-4 prisms of varied height, width and lean, seeded by p.spin
  const r = (i: number) => {
    const v = Math.sin((p.spin + 1) * 9301 * (i + 1)) * 43758.5453;
    return v - Math.floor(v);
  };
  const n = 2 + Math.floor(r(1) * 3);
  const prisms = Array.from({ length: n }, (_, i) => ({
    dx: i === 0 ? 0 : (r(i + 2) - 0.5) * 0.6,
    h: i === 0 ? 1 : 0.4 + r(i + 5) * 0.45,
    w: 0.12 + r(i + 8) * 0.12,
    lean: i === 0 ? (r(11) - 0.5) * 0.3 : (r(i + 12) - 0.5) * 1.1,
  })).sort((a, b) => a.h - b.h);
  // cold glow at the foot
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, H * 0.7);
  gl.addColorStop(0, `rgba(150,215,255,${0.35 * fade})`);
  gl.addColorStop(1, "rgba(150,215,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(p.x - H * 0.7, p.y - H * 0.7, H * 1.4, H * 1.4);
  ctx.restore();
  for (const pr of prisms) {
    const h = H * pr.h;
    const w = H * pr.w;
    const bx = p.x + pr.dx * H;
    const by = p.y;
    const tx = bx + pr.lean * h;
    const ty = by - h;
    // shaded right face
    ctx.fillStyle = "rgba(60,140,200,0.62)";
    ctx.beginPath();
    ctx.moveTo(bx, by + w * 0.15);
    ctx.lineTo(bx + w, by - w * 0.1);
    ctx.lineTo(tx + w * 0.15, ty + h * 0.12);
    ctx.lineTo(tx, ty);
    ctx.closePath();
    ctx.fill();
    // lit left face
    const g = ctx.createLinearGradient(bx, by, tx, ty);
    g.addColorStop(0, "rgba(130,200,240,0.55)");
    g.addColorStop(0.7, "rgba(215,242,255,0.8)");
    g.addColorStop(1, "rgba(255,255,255,0.95)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx, by + w * 0.15);
    ctx.lineTo(bx - w, by - w * 0.1);
    ctx.lineTo(tx - w * 0.15, ty + h * 0.12);
    ctx.lineTo(tx, ty);
    ctx.closePath();
    ctx.fill();
    // bright ridge
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(bx, by + w * 0.1);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A baked ice cluster bursting out of the frozen ground: it rises with a
 * slight overshoot, a burst of cold light at its foot, holds with a faint
 * shimmer, then thins out just before it shatters (see shatterSpike).
 */
function drawIceCluster(ctx: CanvasRenderingContext2D, img: HTMLImageElement, p: Particle, k: number): void {
  const t = Math.min(1, k / 0.14);
  // ease-out-back: shoots up a touch past full height and settles
  const rise = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
  const fade = k > 0.88 ? (1 - k) / 0.12 : 1;
  const size = p.size * 2.1;
  ctx.save();
  // contact shadow
  ctx.globalAlpha = 0.1 * fade * t;
  ctx.fillStyle = "#0a1a28";
  ctx.beginPath();
  ctx.ellipse(p.x + size * 0.08, p.y + 1, size * 0.28, size * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = fade;
  ctx.translate(p.x, p.y);
  ctx.scale(p.spin > 0.5 ? -1 : 1, Math.max(0.05, rise));
  ctx.drawImage(img, -size / 2, -size * ICE_CLUSTER_BASE_Y, size, size);
  ctx.restore();
  // cold burst at the foot as it breaks through, and a faint shimmer after
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const burst = Math.max(0, 1 - k / 0.2);
  const shimmer = 0.12 + 0.06 * Math.sin(k * 40 + p.spin * 9);
  const a = (burst * 0.6 + shimmer) * fade;
  const g = ctx.createRadialGradient(p.x, p.y - size * 0.15, 0, p.x, p.y - size * 0.15, size * 0.55);
  g.addColorStop(0, `rgba(170,225,255,${a})`);
  g.addColorStop(1, "rgba(170,225,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(p.x - size * 0.55, p.y - size * 0.7, size * 1.1, size * 1.1);
  ctx.restore();
}
