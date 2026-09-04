import type { Vector2 } from "@/utils/geometry";
import { drawMagicCore } from "./lighting";
import type { CastleHpTier } from "@/config/castleConfig";

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
  particles: { angle: number; speed: number; curve: number }[];
  /** Premium-tier bursts (Etapa 4) paint a white-hot core under the particles. */
  hotCore?: boolean;
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
  private shakeRemainingMs = 0;
  private shakeTotalMs = 0;
  private shakeMagnitude = 0;

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

  /**
   * `travelDirection`, when given (premium-tier deaths — Etapa 4), biases
   * the burst into a cone flying backward off the enemy's own heading with
   * curved trails, instead of a plain uniform ring — reads as directional
   * debris rather than a generic poof.
   */
  spawnDeathBurst(position: Vector2, color: string, travelDirection?: Vector2, hotCore = false): void {
    const baseAngle = travelDirection ? Math.atan2(travelDirection.y, travelDirection.x) + Math.PI : 0;
    const spread = travelDirection ? Math.PI * 0.9 : Math.PI * 2;
    const count = travelDirection ? 12 : 8;
    this.pushBurst({
      x: position.x,
      y: position.y,
      color,
      remainingMs: travelDirection ? 520 : 420,
      totalMs: travelDirection ? 520 : 420,
      hotCore,
      particles: Array.from({ length: count }, (_, i) => ({
        angle: baseAngle + (i / count - 0.5) * spread + (Math.random() - 0.5) * 0.3,
        speed: 40 + Math.random() * 34,
        curve: (Math.random() - 0.5) * 1.6,
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
        curve: 0,
      })),
    });
  }

  /**
   * Castle Damage Event VFX (Progression 2.0 spec section 12/13): the
   * central "an enemy just breached the base" moment, driven by the same
   * instant GameEngine already flags via the `castle_damage` audio event
   * (see engine/GameEngine.ts's `emitAudio({ type: "castle_damage" })`).
   * Escalates with `tier` (config/castleConfig.ts) so a hit at low HP reads
   * as more dangerous than a scratch at full HP — more debris, a stronger
   * shake — without needing a second, duplicate damage system.
   */
  spawnCastleImpact(position: Vector2, tier: CastleHpTier): void {
    const severity = Math.min(4, tier); // tier 5 (0%) reuses tier 4's intensity — the defeat overlay takes over immediately after.
    const particleCount = 5 + severity * 2;
    this.pushBurst({
      x: position.x,
      y: position.y,
      color: severity >= 3 ? "#ff6a3a" : "#e2574a",
      remainingMs: 260 + severity * 40,
      totalMs: 260 + severity * 40,
      hotCore: severity >= 3,
      particles: Array.from({ length: particleCount }, (_, i) => ({
        angle: (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
        speed: 22 + severity * 8 + Math.random() * 16,
        curve: (Math.random() - 0.5) * 1.2,
      })),
    });
    this.triggerShake(1.5 + severity * 1.3, 140 + severity * 40);
  }

  /**
   * Boss Siege Attack impact (Master Implementation Pass spec section
   * 13/15): a boss hitting a tower is exactly the "major ability" camera
   * shake is meant for — short, controlled, non-accumulating, same as
   * every other shake trigger in this file.
   */
  spawnTowerSiegeImpact(position: Vector2): void {
    this.pushBurst({
      x: position.x,
      y: position.y,
      color: "#ff6a3a",
      remainingMs: 320,
      totalMs: 320,
      hotCore: true,
      particles: Array.from({ length: 9 }, (_, i) => ({
        angle: (i / 9) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
        speed: 30 + Math.random() * 20,
        curve: (Math.random() - 0.5) * 1.2,
      })),
    });
    this.triggerShake(3, 180);
  }

  /** Bounded, additive camera shake — a new trigger while one is active just refreshes toward the stronger of the two rather than stacking indefinitely. */
  triggerShake(magnitude: number, durationMs: number): void {
    if (magnitude < this.shakeMagnitude && this.shakeRemainingMs > 0) return;
    this.shakeMagnitude = magnitude;
    this.shakeRemainingMs = durationMs;
    this.shakeTotalMs = durationMs;
  }

  /** World-space jitter offset for the current frame — CanvasRenderer applies this to its world->canvas transform. {0,0} when no shake is active. */
  getShakeOffset(): Vector2 {
    if (this.shakeRemainingMs <= 0) return { x: 0, y: 0 };
    const progress = this.shakeRemainingMs / this.shakeTotalMs;
    const amount = this.shakeMagnitude * progress;
    return {
      x: (Math.random() - 0.5) * 2 * amount,
      y: (Math.random() - 0.5) * 2 * amount,
    };
  }

  /**
   * Premium-tier hit impact (Etapa 4): white-hot core + colored halo at the
   * strike point plus a few sparks kicked back along the incoming shot's
   * direction, with curved trails. Currently only spawned for hits landing
   * on the Crawler proof enemy.
   */
  spawnHitImpact(position: Vector2, color: string, incomingDirection: Vector2): void {
    const backAngle = Math.atan2(-incomingDirection.y, -incomingDirection.x);
    this.pushBurst({
      x: position.x,
      y: position.y,
      color,
      remainingMs: 260,
      totalMs: 260,
      hotCore: true,
      particles: Array.from({ length: 6 }, (_, i) => ({
        angle: backAngle + (i / 6 - 0.5) * (Math.PI * 0.7) + (Math.random() - 0.5) * 0.25,
        speed: 55 + Math.random() * 25,
        curve: (Math.random() - 0.5) * 1.2,
      })),
    });
  }

  /**
   * Freeze SHATTER (spec section 11/12): the instant a full Frostborn
   * freeze naturally expires, the ice reads as physically breaking apart
   * rather than just silently switching the enemy back on. A wide,
   * fast, all-around radial burst (unlike the narrower directional bursts
   * used for hits/kills) plus a bright core flash is what sells
   * "crystalline structure shattering" with the same particle/burst
   * primitives the rest of this file already uses — no new rendering
   * primitive needed, no gameplay coupling (the caller only ever calls
   * this after independently observing the enemy's own slow effect
   * already ended; this method itself doesn't touch or know about it).
   */
  spawnFreezeShatter(position: Vector2): void {
    const count = 10;
    this.pushBurst({
      x: position.x,
      y: position.y,
      color: "#bdf3ff",
      remainingMs: 380,
      totalMs: 380,
      hotCore: true,
      particles: Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25,
        speed: 55 + Math.random() * 30,
        curve: (Math.random() - 0.5) * 0.6, // straighter, sharper flight than a rounded death burst — reads as rigid shards, not smoke
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
    if (this.shakeRemainingMs > 0) this.shakeRemainingMs = Math.max(0, this.shakeRemainingMs - dtMs);
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
      ctx.save();
      ctx.globalAlpha = 1 - progress;

      if (burst.hotCore) {
        drawMagicCore(ctx, burst.x, burst.y, (1 - progress) * 16, burst.color);
      }

      const traveled = progress * 18;
      for (const p of burst.particles) {
        const dist = traveled * (p.speed / 40);
        const dirX = Math.cos(p.angle);
        const dirY = Math.sin(p.angle);
        // Curved trail: offset perpendicular to travel, growing with distance,
        // so the spark arcs instead of flying in a straight line.
        const perpX = -dirY;
        const perpY = dirX;
        const curveAmount = p.curve * dist * 0.35;
        const px = burst.x + dirX * dist + perpX * curveAmount;
        const py = burst.y + dirY * dist + perpY * curveAmount;
        const midDist = dist * 0.5;
        const midX = burst.x + dirX * midDist + perpX * (p.curve * midDist * 0.35);
        const midY = burst.y + dirY * midDist + perpY * (p.curve * midDist * 0.35);

        ctx.strokeStyle = burst.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(burst.x, burst.y);
        ctx.quadraticCurveTo(midX, midY, px, py);
        ctx.stroke();

        ctx.fillStyle = burst.hotCore ? "#fff6dd" : burst.color;
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
