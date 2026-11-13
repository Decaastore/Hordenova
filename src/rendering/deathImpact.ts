/**
 * MORTES COM IMPACTO — what a kill leaves behind, on top of the existing
 * death burst and collapse (CanvasRenderer's FASE 3):
 *
 *   - a scorch mark on the ground where it fell, fading over a few seconds
 *     (capped, oldest first), so a hard-fought stretch of road shows it;
 *   - a soul wisp rising off the body (brighter for elites and bosses);
 *   - a little screen shake for an elite, more for a mini-boss;
 *   - a COMBO callout when several die at once (x3, x5 with a shake).
 *
 * Render-only: fed by CanvasRenderer's kill detection, never read by the
 * engine. Module-level so the detection helper needs no extra plumbing.
 */
import type { Vector2 } from "@/utils/geometry";
import type { VfxManager } from "./vfx";

interface Scorch {
  x: number;
  y: number;
  r: number;
  rot: number;
  born: number;
  seed: number;
  heavy: boolean;
}

interface Wisp {
  x: number;
  y: number;
  born: number;
  bright: boolean;
  drift: number;
}

const SCORCH_MS = 5_500;
const MAX_SCORCH = 40;
const WISP_MS = 1_100;
const COMBO_WINDOW_MS = 450;

function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

class DeathImpactLayer {
  private scorch: Scorch[] = [];
  private wisps: Wisp[] = [];
  private recent: { at: number; x: number; y: number }[] = [];
  private lastComboAt = -Infinity;

  onKill(position: Vector2, kind: "REGULAR" | "ELITE" | "MINIBOSS" | "BOSS", timestamp: number, vfx: VfxManager): void {
    const heavy = kind !== "REGULAR";
    const seed = Math.floor(timestamp * 7 + position.x * 13 + position.y);
    this.scorch.push({ x: position.x, y: position.y + 4, r: kind === "BOSS" ? 30 : kind === "MINIBOSS" ? 22 : heavy ? 15 : 11, rot: hash(seed) * Math.PI, born: timestamp, seed, heavy });
    if (this.scorch.length > MAX_SCORCH) this.scorch.splice(0, this.scorch.length - MAX_SCORCH);
    this.wisps.push({ x: position.x, y: position.y - 6, born: timestamp, bright: heavy, drift: (hash(seed + 1) - 0.5) * 18 });
    if (this.wisps.length > 30) this.wisps.shift();
    if (kind === "ELITE") vfx.triggerShake(1.4, 90);
    if (kind === "MINIBOSS") vfx.triggerShake(3.2, 220);

    this.recent = this.recent.filter((k) => timestamp - k.at < COMBO_WINDOW_MS);
    this.recent.push({ at: timestamp, x: position.x, y: position.y });
    const n = this.recent.length;
    if (n >= 3 && timestamp - this.lastComboAt > COMBO_WINDOW_MS) {
      const cx = this.recent.reduce((a, k) => a + k.x, 0) / n;
      const cy = this.recent.reduce((a, k) => a + k.y, 0) / n;
      vfx.spawnComboText({ x: cx, y: cy - 18 }, n);
      if (n >= 5) vfx.triggerShake(2.2, 140);
      this.lastComboAt = timestamp;
      this.recent = [];
    }
  }

  /** Scorch marks — call on the ground layer, before the creatures. */
  drawGround(ctx: CanvasRenderingContext2D, timestamp: number): void {
    this.scorch = this.scorch.filter((s) => timestamp - s.born < SCORCH_MS);
    for (const s of this.scorch) {
      const age = (timestamp - s.born) / SCORCH_MS;
      const a = (age < 0.04 ? age / 0.04 : 1) * (1 - age) * (s.heavy ? 0.78 : 0.62);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.scale(1, 0.55);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r);
      g.addColorStop(0, `rgba(18,10,6,${a})`);
      g.addColorStop(0.7, `rgba(30,18,10,${a * 0.6})`);
      g.addColorStop(1, "rgba(30,18,10,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, Math.PI * 2);
      ctx.fill();
      // splatter flecks
      ctx.fillStyle = `rgba(20,12,8,${a})`;
      for (let i = 0; i < 6; i++) {
        const ang = hash(s.seed + i) * Math.PI * 2;
        const d = s.r * (0.8 + hash(s.seed + i * 3) * 0.6);
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * d, Math.sin(ang) * d, 1 + hash(s.seed + i * 7) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // the last embers of a fresh mark
      if (age < 0.25) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255,140,60,${(1 - age / 0.25) * 0.35})`;
        ctx.beginPath();
        ctx.arc(0, 0, s.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** Soul wisps — call on the air layer, after the creatures. */
  drawAir(ctx: CanvasRenderingContext2D, timestamp: number): void {
    this.wisps = this.wisps.filter((w) => timestamp - w.born < WISP_MS);
    if (!this.wisps.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const w of this.wisps) {
      const k = (timestamp - w.born) / WISP_MS;
      const x = w.x + Math.sin(k * 6) * 4 + w.drift * k;
      const y = w.y - k * 46;
      const r = (w.bright ? 9 : 6) * (1 - k * 0.5);
      const a = Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * (1 - k) * (w.bright ? 0.9 : 0.6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,250,235,${a})`);
      g.addColorStop(0.4, `rgba(190,215,255,${a * 0.6})`);
      g.addColorStop(1, "rgba(150,180,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export const deathImpact = new DeathImpactLayer();
