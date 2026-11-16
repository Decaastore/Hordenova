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
const LIFE_MS = 6500;
const FADE_FROM_MS = 4000;

interface Style {
  color: string;
  alpha: number;
  rim?: string;
  glow?: string;
  glowMs?: number;
}
const STYLES: Record<string, Style> = {
  ancient_forest: { color: "#160e07", alpha: 0.7 },
  volcanic_wastes: { color: "#140b07", alpha: 0.7, glow: "#ff6a1a", glowMs: 1400 },
  frozen_tundra: { color: "#4e6680", alpha: 0.6, rim: "#f4faff" },
  cursed_desert: { color: "#5a3c1c", alpha: 0.55, rim: "#f0d8a4" },
  dark_ruins: { color: "#0e0e0e", alpha: 0.65 },
  abyss: { color: "#1e0a30", alpha: 0.65, glow: "#b06aff", glowMs: 2200 },
};

interface Print {
  x: number;
  y: number;
  angle: number;
  length: number;
  left: boolean;
  bornMs: number;
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
  private prints: Print[] = [];
  private look = "";
  private style: Style = STYLES.ancient_forest!;
  private shape: HTMLCanvasElement | null = null;
  private body: HTMLCanvasElement | null = null;
  private rim: HTMLCanvasElement | null = null;
  private glow: HTMLCanvasElement | null = null;

  private ensure(biomeId: string) {
    if (typeof document === "undefined") return false;
    const look = castleDressingFor(biomeId);
    if (look === this.look && this.body) return true;
    this.look = look;
    this.style = STYLES[look] ?? STYLES.ancient_forest!;
    this.shape ??= soleShape();
    this.body = tinted(this.shape, this.style.color);
    this.rim = this.style.rim ? rimOf(this.shape, this.style.rim) : null;
    this.glow = this.style.glow ? tinted(this.shape, this.style.glow) : null;
    return true;
  }

  /**
   * A foot came down at world (x, y), the creature heading along `angle`
   * (radians, world axes: 0 = +x, π/2 = +y). `length` in world units.
   */
  stamp(x: number, y: number, angle: number, length: number, left: boolean) {
    this.prints.push({ x, y, angle, length, left, bornMs: performance.now() });
    if (this.prints.length > MAX_PRINTS) this.prints.splice(0, this.prints.length - MAX_PRINTS);
  }

  clear() {
    this.prints = [];
  }

  /** Draws every live print in world space (the caller's transform is the map's). */
  draw(ctx: CanvasRenderingContext2D, biomeId: string) {
    if (!this.prints.length || !this.ensure(biomeId) || !this.body) return;
    const now = performance.now();
    this.prints = this.prints.filter((p) => now - p.bornMs < LIFE_MS);
    const st = this.style;
    for (const p of this.prints) {
      const age = now - p.bornMs;
      // shows a beat after the foot lifts, fades out at the end
      const f = age < 250 ? 0 : age < 450 ? (age - 250) / 200 : age > FADE_FROM_MS ? 1 - (age - FADE_FROM_MS) / (LIFE_MS - FADE_FROM_MS) : 1;
      if (f <= 0) continue;
      const w = p.length * 0.55;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (p.left) ctx.scale(1, -1);
      ctx.globalAlpha = st.alpha * f;
      ctx.drawImage(this.body, -p.length / 2, -w / 2, p.length, w);
      if (this.rim) {
        ctx.globalAlpha = 0.55 * f;
        ctx.drawImage(this.rim, -p.length / 2, -w / 2, p.length, w);
      }
      if (this.glow && st.glowMs && age < st.glowMs + 250) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.pow(1 - Math.max(0, age - 250) / st.glowMs, 1.5) * 0.9;
        ctx.drawImage(this.glow, -p.length / 2, -w / 2, p.length, w);
      }
      ctx.restore();
    }
  }
}

export const footprints = new FootprintStore();
