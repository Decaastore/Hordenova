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

interface Style {
  color: string;
  alpha: number;
  /** The ground's own colour: the lit wall of a deep print and the clods thrown up round it. */
  soil: string;
  rim?: string;
  glow?: string;
  glowMs?: number;
}
const STYLES: Record<string, Style> = {
  ancient_forest: { color: "#160e07", alpha: 0.7, soil: "#6a5034" },
  volcanic_wastes: { color: "#140b07", alpha: 0.7, soil: "#4a3a32", glow: "#ff6a1a", glowMs: 1400 },
  frozen_tundra: { color: "#4e6680", alpha: 0.6, soil: "#dfeaf4", rim: "#f4faff" },
  cursed_desert: { color: "#5a3c1c", alpha: 0.55, soil: "#c8a46a", rim: "#f0d8a4" },
  dark_ruins: { color: "#0e0e0e", alpha: 0.65, soil: "#4a4642" },
  abyss: { color: "#1e0a30", alpha: 0.65, soil: "#3a2a48", glow: "#b06aff", glowMs: 2200 },
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

class FootprintStore {
  prints: Print[] = [];
  private look = "";
  private style: Style = STYLES.ancient_forest!;
  private shape: HTMLCanvasElement | null = null;
  private body: HTMLCanvasElement | null = null;
  private rim: HTMLCanvasElement | null = null;
  private glow: HTMLCanvasElement | null = null;
  /**
   * The ground itself: every print, once its foot has lifted, is pressed into
   * this world-sized layer and stays exactly where it was made, fading only
   * very slowly over the stage (a light wash every couple of seconds), like
   * real tracks in mud, sand or snow.
   */
  private baked: HTMLCanvasElement | null = null;
  private bakedCtx: CanvasRenderingContext2D | null = null;
  private lastWash = 0;
  /** The monster paw: floor, shadowed wall, lit wall, lip, glow. */
  private claw: { body: HTMLCanvasElement; dark: HTMLCanvasElement; lit: HTMLCanvasElement; rim: HTMLCanvasElement; glow: HTMLCanvasElement | null } | null = null;

  private ensure(biomeId: string) {
    if (typeof document === "undefined") return false;
    const look = castleDressingFor(biomeId);
    if (look === this.look && this.body) return true;
    this.look = look;
    // a new map: its ground starts clean
    this.bakedCtx?.clearRect(0, 0, this.baked!.width, this.baked!.height);
    this.style = STYLES[look] ?? STYLES.ancient_forest!;
    this.shape ??= soleShape();
    this.body = tinted(this.shape, this.style.color);
    this.rim = this.style.rim ? rimOf(this.shape, this.style.rim) : null;
    this.glow = this.style.glow ? tinted(this.shape, this.style.glow) : null;
    const cs = clawShape();
    this.claw = {
      body: tinted(cs, this.style.color),
      // the wall nearest the light is in shadow, the far wall catches the sun
      dark: wallOf(cs, 6, 5, "#000000"),
      lit: wallOf(cs, -5, -4, this.style.soil),
      rim: rimOf(cs, this.style.rim ?? this.style.soil),
      glow: this.style.glow ? tinted(cs, this.style.glow) : null,
    };
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
    this.bakedCtx?.clearRect(0, 0, this.baked!.width, this.baked!.height);
  }

  private groundLayer() {
    if (!this.baked) {
      this.baked = document.createElement("canvas");
      this.baked.width = WORLD_SIZE.width * BAKE_RES;
      this.baked.height = WORLD_SIZE.height * BAKE_RES;
      this.bakedCtx = this.baked.getContext("2d");
      this.bakedCtx?.setTransform(BAKE_RES, 0, 0, BAKE_RES, 0, 0);
    }
    return this.bakedCtx;
  }

  /** Press a print into the ground for good (full strength, no glow). */
  private bake(p: Print) {
    const g = this.groundLayer();
    if (!g) return;
    if (p.kind === "foot") this.drawFoot(g, p, 1, 0);
    else this.drawClaw(g, p, 1, 0);
  }

  /** Tracks fade very slowly: a light wash over the ground layer every couple of seconds. */
  private wash(now: number) {
    if (!this.bakedCtx || now - this.lastWash < WASH_EVERY_MS) return;
    this.lastWash = now;
    const g = this.bakedCtx;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "destination-out";
    g.globalAlpha = WASH_ALPHA;
    g.fillRect(0, 0, this.baked!.width, this.baked!.height);
    g.restore();
  }

  /** Draws the tracks in world space (the caller's transform is the map's): the ground layer, then the prints still settling. */
  draw(ctx: CanvasRenderingContext2D, biomeId: string) {
    if (!this.ensure(biomeId) || !this.body) return;
    const now = performance.now();
    this.wash(now);
    if (this.baked) ctx.drawImage(this.baked, 0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
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
      const glowLeft = p.kind === "foot" ? glowMs + 250 - age : glowMs * 1.6 - age;
      const glowA = glowMs && glowLeft > 0 ? (p.kind === "foot" ? Math.pow(1 - Math.max(0, age - 250) / glowMs, 1.5) * 0.9 : Math.pow(1 - age / (glowMs * 1.6), 1.5) * 0.85) : 0;
      if (!p.baked) {
        // still settling: fades in where the foot lifts
        const f = p.kind === "foot" ? (age < 250 ? 0 : (age - 250) / 200) : age / 120;
        if (p.kind === "foot") this.drawFoot(ctx, p, f, glowA);
        else this.drawClaw(ctx, p, f, glowA);
        keep.push(p);
      } else if (glowA > 0) {
        // pressed in already; only its embers / rune light still glow on top
        if (p.kind === "foot") this.drawFoot(ctx, p, 0, glowA);
        else this.drawClaw(ctx, p, 0, glowA);
        keep.push(p);
      }
    }
    this.prints = keep;
  }

  /** An ordinary creature's sole, at strength `f`, plus its glow at `glowA`. */
  private drawFoot(ctx: CanvasRenderingContext2D, p: Print, f: number, glowA: number) {
    if (!this.body) return;
    const st = this.style;
    const w = p.length * 0.55;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    if (p.left) ctx.scale(1, -1);
    if (f > 0) {
      ctx.globalAlpha = st.alpha * f;
      ctx.drawImage(this.body, -p.length / 2, -w / 2, p.length, w);
      if (this.rim) {
        ctx.globalAlpha = 0.55 * f;
        ctx.drawImage(this.rim, -p.length / 2, -w / 2, p.length, w);
      }
    }
    if (this.glow && glowA > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = glowA;
      ctx.drawImage(this.glow, -p.length / 2, -w / 2, p.length, w);
    }
    ctx.restore();
  }

  /** A monster's paw sunk into the ground: dark floor, a shadowed and a lit wall, a lip of pushed-up soil, and for a boss cracks and clods. */
  private drawClaw(ctx: CanvasRenderingContext2D, p: Print, f: number, glowA: number) {
    const c = this.claw;
    if (!c) return;
    const st = this.style;
    const L = p.length * 1.6;
    const W = L * 0.7;
    const boss = p.kind === "boss";
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    if (p.left) ctx.scale(1, -1);
    if (f <= 0) {
      if (c.glow && glowA > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = glowA;
        ctx.drawImage(c.glow, -L / 2, -W / 2, L, W);
      }
      ctx.restore();
      return;
    }
    // the pushed-up lip round the hole
    ctx.globalAlpha = 0.5 * f;
    ctx.drawImage(c.rim, -L / 2, -W / 2, L, W);
    // the floor of the print, darker the deeper it went
    ctx.globalAlpha = Math.min(1, st.alpha * (boss ? 1.25 : 1.1)) * f;
    ctx.drawImage(c.body, -L / 2, -W / 2, L, W);
    // its two walls: one in shadow, one catching the light
    ctx.globalAlpha = (boss ? 0.6 : 0.45) * f;
    ctx.drawImage(c.dark, -L / 2, -W / 2, L, W);
    ctx.globalAlpha = (boss ? 0.55 : 0.4) * f;
    ctx.drawImage(c.lit, -L / 2, -W / 2, L, W);
    if (boss) {
      // the ground cracks out from where the weight came down, clods scattered round it
      let s = p.seed;
      const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      ctx.globalAlpha = 0.55 * f;
      ctx.strokeStyle = st.color;
      ctx.lineWidth = Math.max(0.6, L * 0.025);
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(0.4, L * 0.014);
      for (let i = 0; i < 5; i++) {
        // short hairline cracks starting at the heel's rim, mostly behind and beside it
        const a = Math.PI * (0.55 + r() * 0.9) * (r() < 0.5 ? 1 : -1);
        let x = -L * 0.2 + Math.cos(a) * L * 0.2, y = Math.sin(a) * W * 0.3;
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
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2;
        const d = 0.62 + r() * 0.25;
        const x = Math.cos(a) * L * d * 0.6, y = Math.sin(a) * W * d * 0.75;
        const rad = L * (0.012 + r() * 0.018);
        ctx.globalAlpha = 0.7 * f;
        ctx.fillStyle = st.color;
        ctx.beginPath();
        ctx.ellipse(x + rad * 0.4, y + rad * 0.4, rad, rad * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = st.soil;
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (c.glow && glowA > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = glowA;
      ctx.drawImage(c.glow, -L / 2, -W / 2, L, W);
    }
    ctx.restore();
  }
}

export const footprints = new FootprintStore();
