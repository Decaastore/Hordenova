import { WORLD_SIZE } from "@/config/gameBalance";
import { castleDressingFor } from "./castleSprites";

/**
 * PEGADAS — footprints pressed into the ground. They are drawn by the 2D map
 * renderer right after the ground and BEFORE any creature, so a print always
 * lies under every creature (2D sprites and the 3D layer alike) and never
 * shows on top of the one walking over it. Anything that knows where a foot
 * came down calls `footprints.stamp(...)` in world units; this module keeps
 * the prints, ages them and draws them.
 *
 * Each map prints into its own ground: dark mud in the forest, pressed snow
 * on the ice, sand in the desert, ash with a dying ember in the volcano, a
 * faint violet glow in the Abyss.
 */

const MAX_PRINTS = 600;
/** The ground layer's resolution (pixels per world unit), so tracks stay crisp when zoomed in. */
const BAKE_RES = 2.5;
/** How the pressed-in tracks fade: a wash this strong this often — about two minutes to half strength. */
const WASH_EVERY_MS = 2000;
const WASH_ALPHA = 0.012;

/** "foot": an ordinary creature's sole. "claw": a monster's clawed paw sunk deep. "boss": the same, so heavy the ground cracks round it. */
export type PrintKind = "foot" | "claw" | "boss";

/**
 * How a print sits in each ground. Two passes, so the ground's own texture
 * shows through the hole instead of a flat stamp:
 *  - `floor` and `wall` MULTIPLY the ground (the floor of the hole, and the
 *    wall turned from the light, deeper in shade);
 *  - `lit` and `lip` SCREEN onto it (the wall facing the light, and the rim
 *    of mud / sand / snow pushed up round the hole).
 */
interface Style {
  floor: string;
  wall: string;
  lit: string;
  lip: string;
  /** Strength of the light pass (snow and sand show it most). */
  light: number;
  /** The ground's own colour, for the clods round a boss's step. */
  soil: string;
  /** Darker colour for a boss's cracks. */
  crack: string;
  glow?: string;
  glowMs?: number;
}
const STYLES: Record<string, Style> = {
  ancient_forest: { floor: "#6e5c4c", wall: "#2e2218", lit: "#8a7258", lip: "#7a6448", light: 0.55, soil: "#6a5034", crack: "#1e140c" },
  volcanic_wastes: { floor: "#5e4c46", wall: "#22180f", lit: "#7a6458", lip: "#6a5a50", light: 0.45, soil: "#4a3a32", crack: "#140b07", glow: "#ff6a1a", glowMs: 1400 },
  frozen_tundra: { floor: "#9ab0c8", wall: "#5a7090", lit: "#ffffff", lip: "#ffffff", light: 0.8, soil: "#eef4fa", crack: "#6a84a0" },
  cursed_desert: { floor: "#b0926e", wall: "#6a4c2c", lit: "#f0d8a4", lip: "#f4dcb0", light: 0.6, soil: "#c8a46a", crack: "#5a3c1c" },
  dark_ruins: { floor: "#6a6866", wall: "#262422", lit: "#8a8682", lip: "#7a7672", light: 0.4, soil: "#4a4642", crack: "#0e0e0e" },
  abyss: { floor: "#6a5a80", wall: "#24123a", lit: "#8a74a8", lip: "#7a6896", light: 0.45, soil: "#3a2a48", crack: "#1e0a30", glow: "#b06aff", glowMs: 2200 },
};

interface Print {
  x: number;
  y: number;
  angle: number;
  length: number;
  left: boolean;
  bornMs: number;
  kind: PrintKind;
  seed: number;
  /** Already pressed into the ground layer; kept only while its glow still burns. */
  baked?: boolean;
}

/** A sole seen from above, toes towards +x, in white on transparent (alpha = shape). */
function soleShape(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.filter = "blur(1.5px)";
  g.beginPath();
  g.ellipse(30, 32, 18, 15, 0, 0, Math.PI * 2); // heel
  g.fill();
  g.beginPath();
  g.ellipse(72, 32, 20, 19, 0, 0, Math.PI * 2); // ball
  g.fill();
  g.fillRect(30, 22, 42, 20); // arch
  for (const [x, y, r] of [
    [100, 12, 7],
    [108, 26, 7.5],
    [108, 40, 7.5],
    [100, 53, 7],
  ] as const) {
    g.beginPath();
    g.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(x + r - 1, y - 2.5);
    g.lineTo(x + r + 7, y + (y - 32) * 0.08);
    g.lineTo(x + r - 1, y + 2.5);
    g.fill();
  }
  return c;
}

/**
 * A monster's paw seen from above, toes towards +x: a broad heel pad, four
 * splayed toes and a hooked claw gouged ahead of each one.
 */
function clawShape(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 112;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.filter = "blur(1.2px)";
  // heel pad: a rounded, slightly three-lobed mass
  g.beginPath();
  g.moveTo(16, 56);
  g.bezierCurveTo(14, 26, 44, 22, 62, 34);
  g.bezierCurveTo(70, 42, 70, 70, 62, 78);
  g.bezierCurveTo(44, 90, 14, 86, 16, 56);
  g.fill();
  // toes, splayed, each with a claw gouge
  const toes: [number, number, number, number][] = [
    [76, 26, 12, -0.6],
    [90, 46, 13, -0.2],
    [90, 68, 13, 0.2],
    [76, 88, 12, 0.6],
  ];
  for (const [x, y, r, a] of toes) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.ellipse(0, 0, r * 1.15, r * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    // the claw: a long tapering gouge raked into the ground
    g.beginPath();
    g.moveTo(r * 0.8, -4.5);
    g.quadraticCurveTo(r + 9, -3.5, r + 15, 1.5);
    g.quadraticCurveTo(r + 8, 2, r * 0.8, 4.5);
    g.fill();
    g.restore();
  }
  return c;
}

/** The part of `shape` NOT covered by itself shifted by (dx, dy): the inner wall of a hole on that side. */
function wallOf(shape: HTMLCanvasElement, dx: number, dy: number, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = shape.width;
  c.height = shape.height;
  const g = c.getContext("2d")!;
  g.drawImage(shape, 0, 0);
  g.globalCompositeOperation = "destination-out";
  g.drawImage(shape, dx, dy);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function tinted(shape: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = shape.width;
  c.height = shape.height;
  const g = c.getContext("2d")!;
  g.drawImage(shape, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** A lighter lip pushed up just around the print (snow, sand). */
function rimOf(shape: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = shape.width;
  c.height = shape.height;
  const g = c.getContext("2d")!;
  for (const [dx, dy] of [
    [-3, 0],
    [3, 0],
    [0, -3],
    [0, 3],
  ] as const)
    g.drawImage(shape, dx, dy);
  g.globalCompositeOperation = "destination-out";
  g.drawImage(shape, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** One print shape, pre-tinted for both passes. */
interface PrintSet {
  floor: HTMLCanvasElement;
  wall: HTMLCanvasElement;
  lit: HTMLCanvasElement;
  lip: HTMLCanvasElement;
  glow: HTMLCanvasElement | null;
}

function printSet(shape: HTMLCanvasElement, st: Style, wallShift: number): PrintSet {
  return {
    floor: tinted(shape, st.floor),
    // the wall nearest the light is in shade, the far wall catches it
    wall: wallOf(shape, wallShift, wallShift * 0.8, st.wall),
    lit: wallOf(shape, -wallShift * 0.8, -wallShift * 0.7, st.lit),
    lip: rimOf(shape, st.lip),
    glow: st.glow ? tinted(shape, st.glow) : null,
  };
}

type Pass = "dark" | "light";

class FootprintStore {
  prints: Print[] = [];
  private look = "";
  private style: Style = STYLES.ancient_forest!;
  private foot: PrintSet | null = null;
  private claw: PrintSet | null = null;
  /**
   * The ground itself: every print, once its foot has lifted, is pressed into
   * these world-sized layers (one that darkens the ground, one that lightens
   * it) and stays exactly where it was made, fading only very slowly over the
   * stage — like real tracks in mud, sand or snow.
   */
  private layers: Record<Pass, { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null> = { dark: null, light: null };
  private lastWash = 0;

  private ensure(biomeId: string) {
    if (typeof document === "undefined") return false;
    const look = castleDressingFor(biomeId);
    if (look === this.look && this.foot) return true;
    this.look = look;
    this.style = STYLES[look] ?? STYLES.ancient_forest!;
    this.foot = printSet(soleShape(), this.style, 4);
    this.claw = printSet(clawShape(), this.style, 6);
    // a new map: its ground starts clean
    this.wipe();
    return true;
  }

  /**
   * A foot came down at world (x, y), the creature heading along `angle`
   * (radians, world axes: 0 = +x, π/2 = +y). `length` in world units.
   */
  stamp(x: number, y: number, angle: number, length: number, left: boolean, kind: PrintKind = "foot") {
    this.prints.push({ x, y, angle, length, left, bornMs: performance.now(), kind, seed: (Math.random() * 1e9) | 0 });
    if (this.prints.length > MAX_PRINTS) this.prints.splice(0, this.prints.length - MAX_PRINTS);
  }

  clear() {
    this.prints = [];
    this.wipe();
  }

  private wipe() {
    for (const l of Object.values(this.layers)) l?.g.clearRect(0, 0, l.c.width, l.c.height);
  }

  private layer(pass: Pass) {
    let l = this.layers[pass];
    if (!l) {
      const c = document.createElement("canvas");
      c.width = WORLD_SIZE.width * BAKE_RES;
      c.height = WORLD_SIZE.height * BAKE_RES;
      const g = c.getContext("2d");
      if (!g) return null;
      g.setTransform(BAKE_RES, 0, 0, BAKE_RES, 0, 0);
      l = this.layers[pass] = { c, g };
    }
    return l;
  }

  /** Press a print into the ground for good (full strength, no glow). */
  private bake(p: Print) {
    for (const pass of ["dark", "light"] as const) {
      const l = this.layer(pass);
      if (l) this.drawPrint(l.g, p, 1, 0, pass);
    }
  }

  /** Tracks fade very slowly: a light wash over the ground layers every couple of seconds. */
  private wash(now: number) {
    if (now - this.lastWash < WASH_EVERY_MS) return;
    this.lastWash = now;
    for (const l of Object.values(this.layers)) {
      if (!l) continue;
      l.g.save();
      l.g.setTransform(1, 0, 0, 1, 0, 0);
      l.g.globalCompositeOperation = "destination-out";
      l.g.globalAlpha = WASH_ALPHA;
      l.g.fillRect(0, 0, l.c.width, l.c.height);
      l.g.restore();
    }
  }

  /** Draws the tracks in world space (the caller's transform is the map's): the ground layers, then the prints still settling. */
  draw(ctx: CanvasRenderingContext2D, biomeId: string) {
    if (!this.ensure(biomeId)) return;
    const now = performance.now();
    this.wash(now);
    ctx.save();
    for (const pass of ["dark", "light"] as const) {
      const l = this.layers[pass];
      if (!l) continue;
      ctx.globalCompositeOperation = pass === "dark" ? "multiply" : "screen";
      ctx.globalAlpha = pass === "dark" ? 1 : this.style.light;
      ctx.drawImage(l.c, 0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
    }
    ctx.restore();
    if (!this.prints.length) return;
    const st = this.style;
    const keep: Print[] = [];
    for (const p of this.prints) {
      const age = now - p.bornMs;
      const settle = p.kind === "foot" ? 450 : 120;
      if (!p.baked && age >= settle) {
        this.bake(p);
        p.baked = true;
      }
      const glowMs = st.glowMs ?? 0;
      const glowA = glowMs && age < glowMs * 1.4 ? Math.pow(1 - age / (glowMs * 1.4), 1.5) * 0.85 : 0;
      if (!p.baked) {
        // still settling: fades in where the foot lifts
        const f = p.kind === "foot" ? (age < 250 ? 0 : (age - 250) / 200) : age / 120;
        for (const pass of ["dark", "light"] as const) {
          ctx.save();
          ctx.globalCompositeOperation = pass === "dark" ? "multiply" : "screen";
          this.drawPrint(ctx, p, f * (pass === "light" ? st.light : 1), 0, pass);
          ctx.restore();
        }
      }
      if (glowA > 0) this.drawPrint(ctx, p, 0, glowA, "light");
      if (!p.baked || glowA > 0) keep.push(p);
    }
    this.prints = keep;
  }

  /** One print, for one pass, at strength `f`; plus its glow at `glowA` (light pass only). */
  private drawPrint(ctx: CanvasRenderingContext2D, p: Print, f: number, glowA: number, pass: Pass) {
    const set = p.kind === "foot" ? this.foot : this.claw;
    if (!set) return;
    const L = p.kind === "foot" ? p.length : p.length * 1.6;
    const W = p.kind === "foot" ? L * 0.55 : L * 0.7;
    const boss = p.kind === "boss";
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    if (p.left) ctx.scale(1, -1);
    const prevOp = ctx.globalCompositeOperation;
    if (f > 0) {
      if (pass === "dark") {
        ctx.globalAlpha = f;
        ctx.drawImage(set.floor, -L / 2, -W / 2, L, W);
        ctx.globalAlpha = f * (p.kind === "foot" ? 0.75 : boss ? 1 : 0.9);
        ctx.drawImage(set.wall, -L / 2, -W / 2, L, W);
      } else {
        ctx.globalAlpha = f;
        ctx.drawImage(set.lit, -L / 2, -W / 2, L, W);
        ctx.globalAlpha = f * 0.85;
        ctx.drawImage(set.lip, -L / 2, -W / 2, L, W);
      }
      if (boss) this.bossMarks(ctx, p, L, W, f, pass);
    }
    if (set.glow && glowA > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = glowA;
      ctx.drawImage(set.glow, -L / 2, -W / 2, L, W);
      ctx.globalCompositeOperation = prevOp;
    }
    ctx.restore();
  }

  /** A boss's weight cracks the ground round its step (dark pass) and throws up clods (light pass). */
  private bossMarks(ctx: CanvasRenderingContext2D, p: Print, L: number, W: number, f: number, pass: Pass) {
    const st = this.style;
    let s = p.seed;
    const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    if (pass === "dark") {
      ctx.globalAlpha = 0.8 * f;
      ctx.strokeStyle = st.crack;
      ctx.lineWidth = Math.max(0.4, L * 0.016);
      ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (0.55 + r() * 0.9) * (r() < 0.5 ? 1 : -1);
        let x = -L * 0.2 + Math.cos(a) * L * 0.2,
          y = Math.sin(a) * W * 0.3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const steps = 2 + Math.floor(r() * 2);
        for (let k = 0; k < steps; k++) {
          const aa = a + (r() - 0.5) * 1.1;
          x += Math.cos(aa) * L * (0.05 + r() * 0.05);
          y += Math.sin(aa) * L * (0.04 + r() * 0.04);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2;
        const d = 0.62 + r() * 0.25;
        const rad = L * (0.012 + r() * 0.018);
        ctx.globalAlpha = 0.9 * f;
        ctx.fillStyle = st.soil;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * L * d * 0.6, Math.sin(a) * W * d * 0.75, rad, rad * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export const footprints = new FootprintStore();
