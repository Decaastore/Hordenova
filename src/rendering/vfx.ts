import type { Vector2 } from "@/utils/geometry";

/**
 * Purely cosmetic "game feel" layer (Phase 2 spec section 10): damage
 * numbers, hit flashes, death bursts, build/upgrade/gold feedback. This
 * is entirely renderer-owned state — it has NO connection to GameEngine
 * and never influences gameplay. CanvasRenderer detects interesting
 * frame-to-frame changes (an enemy's hp dropped, a tower's level went up,
 * gold increased, ...) and calls the `spawn*` functions here; `update`
 * ages everything and `draw` paints it, then expired entries are dropped.
 * Bounded lifetimes and small per-kind caps keep this cheap regardless of
 * run length.
 */

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  remainingMs: number;
  totalMs: number;
}

interface Burst {
  x: number;
  y: number;
  color: string;
  remainingMs: number;
  totalMs: number;
  particles: { angle: number; speed: number }[];
}

interface Ring {
  x: number;
  y: number;
  color: string;
  remainingMs: number;
  totalMs: number;
  maxRadius: number;
}

const MAX_FLOATING_TEXTS = 24;
const MAX_BURSTS = 16;
const MAX_RINGS = 8;

export class VfxManager {
  private floatingTexts: FloatingText[] = [];
  private bursts: Burst[] = [];
  private rings: Ring[] = [];

  spawnDamageNumber(position: Vector2, amount: number, isCrit: boolean): void {
    if (amount < 0.5) return;
    this.pushFloatingText({
      x: position.x + (Math.random() - 0.5) * 8,
      y: position.y - 12,
      text: `-${Math.round(amount)}`,
      color: isCrit ? "#ffd75e" : "#f1ecff",
      remainingMs: 650,
      totalMs: 650,
    });
  }

  spawnGoldPopup(position: Vector2, amount: number): void {
    if (amount <= 0) return;
    this.pushFloatingText({
      x: position.x,
      y: position.y - 20,
      text: `+${amount}g`,
      color: "#e8c15a",
      remainingMs: 800,
      totalMs: 800,
    });
  }

  spawnDeathBurst(position: Vector2, color: string): void {
    this.pushBurst({
      x: position.x,
      y: position.y,
      color,
      remainingMs: 420,
      totalMs: 420,
      particles: Array.from({ length: 8 }, (_, i) => ({
        angle: (i / 8) * Math.PI * 2 + Math.random() * 0.3,
        speed: 40 + Math.random() * 30,
      })),
    });
  }

  spawnBaseHitFlash(position: Vector2): void {
    this.pushBurst({
      x: position.x,
      y: position.y,
      color: "#e2574a",
      remainingMs: 300,
      totalMs: 300,
      particles: Array.from({ length: 5 }, (_, i) => ({
        angle: (i / 5) * Math.PI * 2,
        speed: 25,
      })),
    });
  }

  spawnBuildRing(position: Vector2, color: string): void {
    this.pushRing({ x: position.x, y: position.y, color, remainingMs: 380, totalMs: 380, maxRadius: 30 });
  }

  spawnUpgradeBurst(position: Vector2, color: string): void {
    this.pushRing({ x: position.x, y: position.y, color, remainingMs: 320, totalMs: 320, maxRadius: 22 });
    this.pushFloatingText({
      x: position.x,
      y: position.y - 18,
      text: "UPGRADED",
      color,
      remainingMs: 600,
      totalMs: 600,
    });
  }

  private pushFloatingText(entry: FloatingText): void {
    this.floatingTexts.push(entry);
    if (this.floatingTexts.length > MAX_FLOATING_TEXTS) this.floatingTexts.shift();
  }

  private pushBurst(entry: Burst): void {
    this.bursts.push(entry);
    if (this.bursts.length > MAX_BURSTS) this.bursts.shift();
  }

  private pushRing(entry: Ring): void {
    this.rings.push(entry);
    if (this.rings.length > MAX_RINGS) this.rings.shift();
  }

  update(dtMs: number): void {
    for (const t of this.floatingTexts) t.remainingMs -= dtMs;
    for (const b of this.bursts) b.remainingMs -= dtMs;
    for (const r of this.rings) r.remainingMs -= dtMs;
    this.floatingTexts = this.floatingTexts.filter((t) => t.remainingMs > 0);
    this.bursts = this.bursts.filter((b) => b.remainingMs > 0);
    this.rings = this.rings.filter((r) => r.remainingMs > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const ring of this.rings) {
      const progress = 1 - ring.remainingMs / ring.totalMs;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.maxRadius * progress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const burst of this.bursts) {
      const progress = 1 - burst.remainingMs / burst.totalMs;
      const traveled = progress * 18;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = burst.color;
      for (const p of burst.particles) {
        const px = burst.x + Math.cos(p.angle) * traveled * (p.speed / 40);
        const py = burst.y + Math.sin(p.angle) * traveled * (p.speed / 40);
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const t of this.floatingTexts) {
      const progress = 1 - t.remainingMs / t.totalMs;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - progress) * 1.6);
      ctx.fillStyle = t.color;
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t.text, t.x, t.y - progress * 16);
      ctx.restore();
    }
  }
}
