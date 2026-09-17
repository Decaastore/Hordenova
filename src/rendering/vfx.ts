import type { Vector2 } from "@/utils/geometry";
import { drawMagicCore } from "./lighting";
import type { CastleHpTier } from "@/config/castleConfig";
import type { CreatureVfxFamily, CreatureWeightClass } from "@/config/creatureVfxProfile";

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

/**
 * Floating Damage Numbers — kept as its own tagged union of concerns:
 * `kind` drives both the merge-cap logic (`reportEnemyDamage` below) and
 * the draw-time styling split between a real tower hit and a DOT tick.
 * `"OTHER"` is every pre-existing non-damage use of a floating text (the
 * "UPGRADED" label) — never merge-capped, never DOT-styled.
 */
interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  remainingMs: number;
  totalMs: number;
  /** Numeric running total for HIT/DOT texts — lets `reportEnemyDamage` merge more damage into an already-visible number instead of stacking a second one. Unused (0) for "OTHER" texts. */
  amount: number;
  kind: "HIT" | "DOT" | "OTHER";
  /** Present only for HIT/DOT — the enemy this number is tracking, so at most one live HIT text and one live DOT text can ever exist per enemy (see MAX_TEXTS_PER_ENEMY_PER_KIND). */
  enemyId?: string;
  isCrit: boolean;
  fontSizePx: number;
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
  /** VISUAL POLISH PASS — per-burst particle thickness/size, defaulting to the original 1.4/1.8 (every pre-existing spawn* call is unaffected). Material hit/death bursts opt into slightly thicker strokes/dots (see HIT_STYLE/DEATH_STYLE) because they now fire on every creature at real gameplay zoom, where the original thin proof-of-concept size read as invisible against the map's own detail. */
  lineWidth?: number;
  dotRadius?: number;
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
// CREATURE VFX & IMPACT PASS — bumped from 16: material hits/deaths now fire
// for every creature (not just the Crawler proof piece), so a busy 30-50
// enemy scene needs a bit more headroom. Still a hard, small cap — combined
// with each burst's own short (200-520ms) lifetime, this is the whole
// performance strategy (spec section 17): bounded pool + short-lived
// entries, no per-frame allocation growth regardless of run length. Oldest
// entries are evicted first (pushBurst below), which in practice means the
// newest, most relevant impacts (spec section 18's priority order) are what
// stays on screen when many creatures are hit in the same frame.
const MAX_BURSTS = 22;
const MAX_RINGS = 8;

/**
 * Fixed (non-sliding) aggregation windows for `reportEnemyDamage`: the
 * window starts on the FIRST hit/tick reported for an enemy and always
 * flushes after this many ms, however many more hits arrived in between —
 * it is never extended by a new incoming hit. That's what lets sustained
 * real damage still surface new numbers at a bounded, real cadence (rule
 * 3: "não quero números aparecendo muito mais rapidamente do que o
 * inimigo realmente está recebendo dano") instead of being deferred
 * indefinitely under continuous fire. HIT gets a short window since a
 * volley of towers firing together should read as one number; DOT gets a
 * longer one since burn ticks every frame and needs heavier aggregation.
 */
const HIT_BATCH_WINDOW_MS = 90;
const DOT_BATCH_WINDOW_MS = 450;

interface PendingDamage {
  position: Vector2;
  amount: number;
  isCrit: boolean;
  remainingMs: number;
}

interface BurstStyle {
  color: string;
  count: number;
  speed: number;
  speedJitter: number;
  /** Radians — how straight (small) vs curved (large) the particle's flight arcs, see Burst.particles' curve field. Rigid materials (crystal, armored) stay low; soft/organic materials curve more. */
  curve: number;
  spread: number;
  durationMs: number;
  hotCore?: boolean;
  lineWidth?: number;
  dotRadius?: number;
}

/**
 * CREATURE VFX & IMPACT PASS — one HIT burst recipe per material family
 * (spec section 3/5), kept deliberately restrained (short duration, few
 * particles, no neon) so a hit reads as "this landed" without dominating the
 * creature underneath it (spec section 5: "o impacto deve durar pouco").
 *
 * VISUAL POLISH PASS — speed/lineWidth/dotRadius raised from the first cut:
 * live testing at the game's real zoom (dozens of tiny creatures on a
 * detailed map) showed the original thin/small particles were essentially
 * invisible next to decorations and the enemy's own HP bar, undermining the
 * whole point of "reforçar a criatura" (spec section 1). Duration/count are
 * UNCHANGED — this is a size/thickness correction, not a bigger effect.
 */
const HIT_STYLE: Record<CreatureVfxFamily, BurstStyle> = {
  ORGANIC: { color: "#c97a5c", count: 5, speed: 40, speedJitter: 16, curve: 1.1, spread: Math.PI * 0.7, durationMs: 200, lineWidth: 2, dotRadius: 2.6 },
  CRYSTAL: { color: "#bdeaff", count: 6, speed: 58, speedJitter: 18, curve: 0.5, spread: Math.PI * 0.6, durationMs: 220, hotCore: true, lineWidth: 2.2, dotRadius: 2.8 },
  ARMORED: { color: "#c7ccd2", count: 5, speed: 38, speedJitter: 14, curve: 0.6, spread: Math.PI * 0.65, durationMs: 210, lineWidth: 2.2, dotRadius: 2.8 },
  PLANT: { color: "#8fd48a", count: 5, speed: 30, speedJitter: 12, curve: 1.4, spread: Math.PI * 0.8, durationMs: 230, lineWidth: 2, dotRadius: 2.6 },
  CHARRED: { color: "#e0925a", count: 5, speed: 32, speedJitter: 14, curve: 1.0, spread: Math.PI * 0.7, durationMs: 240, lineWidth: 2, dotRadius: 2.6 },
  AQUATIC: { color: "#6ec7e0", count: 6, speed: 42, speedJitter: 16, curve: 0.9, spread: Math.PI * 0.75, durationMs: 220, lineWidth: 2, dotRadius: 2.6 },
};

/**
 * CREATURE VFX & IMPACT PASS — one DEATH burst recipe per material family
 * (spec section 13). `ring` adds a brief expanding ring alongside the
 * particle burst (crystal's crack-flash read, aquatic's water displacement).
 * VISUAL POLISH PASS — same size correction as HIT_STYLE above.
 */
const DEATH_STYLE: Record<CreatureVfxFamily, BurstStyle & { ring?: boolean }> = {
  ORGANIC: { color: "#b06a4e", count: 9, speed: 44, speedJitter: 22, curve: 1.3, spread: Math.PI * 0.9, durationMs: 420, lineWidth: 2, dotRadius: 2.6 },
  CRYSTAL: { color: "#bdeaff", count: 11, speed: 68, speedJitter: 26, curve: 0.35, spread: Math.PI * 2, durationMs: 460, hotCore: true, ring: true, lineWidth: 2.4, dotRadius: 3 },
  ARMORED: { color: "#9aa0a8", count: 10, speed: 42, speedJitter: 20, curve: 0.7, spread: Math.PI * 2, durationMs: 480, lineWidth: 2.4, dotRadius: 3 },
  PLANT: { color: "#7fc47a", count: 9, speed: 26, speedJitter: 12, curve: 1.6, spread: Math.PI * 2, durationMs: 520, lineWidth: 2, dotRadius: 2.6 },
  CHARRED: { color: "#c97a45", count: 10, speed: 28, speedJitter: 14, curve: 1.2, spread: Math.PI * 2, durationMs: 520, lineWidth: 2, dotRadius: 2.8 },
  AQUATIC: { color: "#5cb3d4", count: 10, speed: 46, speedJitter: 20, curve: 0.8, spread: Math.PI * 2, durationMs: 440, ring: true, lineWidth: 2.2, dotRadius: 2.8 },
};

const DEATH_WEIGHT_SCALE: Record<CreatureWeightClass, { countMul: number; speedMul: number; durationMul: number }> = {
  LIGHT: { countMul: 0.7, speedMul: 0.85, durationMul: 0.85 },
  MEDIUM: { countMul: 1, speedMul: 1, durationMul: 1 },
  HEAVY: { countMul: 1.3, speedMul: 1.1, durationMul: 1.15 },
  MINIBOSS: { countMul: 1.7, speedMul: 1.2, durationMul: 1.35 },
  BOSS: { countMul: 2.2, speedMul: 1.35, durationMul: 1.6 },
};

export class VfxManager {
  private floatingTexts: FloatingText[] = [];
  private bursts: Burst[] = [];
  private rings: Ring[] = [];
  private shakeRemainingMs = 0;
  private shakeTotalMs = 0;
  private shakeMagnitude = 0;
  private pendingHits = new Map<string, PendingDamage>();
  private pendingDot = new Map<string, PendingDamage>();

  /**
   * Entry point for the REAL damage pipeline (CanvasRenderer draining
   * `GameEngine.drainCombatVfxEvents()`) — never called with a guessed or
   * projectile-fired amount. Accumulates into a fixed per-enemy time
   * bucket (see HIT_BATCH_WINDOW_MS / DOT_BATCH_WINDOW_MS) instead of
   * spawning immediately, so N hits landing within the same short window
   * become exactly one floating number (rule 2/13). HIT and DOT are
   * tracked in separate maps so periodic damage never competes with or
   * suppresses discrete hit numbers (rule 9).
   */
  reportEnemyDamage(enemyId: string, position: Vector2, amount: number, isCrit: boolean, kind: "HIT" | "DOT"): void {
    if (amount <= 0) return;
    const map = kind === "HIT" ? this.pendingHits : this.pendingDot;
    const pending = map.get(enemyId);
    if (pending) {
      pending.amount += amount;
      pending.position = position;
      if (isCrit) pending.isCrit = true;
    } else {
      map.set(enemyId, {
        position,
        amount,
        isCrit,
        remainingMs: kind === "HIT" ? HIT_BATCH_WINDOW_MS : DOT_BATCH_WINDOW_MS,
      });
    }
  }

  private flushPending(map: Map<string, PendingDamage>, dtMs: number, kind: "HIT" | "DOT"): void {
    for (const [enemyId, pending] of map) {
      pending.remainingMs -= dtMs;
      if (pending.remainingMs <= 0) {
        this.spawnDamageNumber(pending.position, pending.amount, pending.isCrit, enemyId, kind);
        map.delete(enemyId);
      }
    }
  }

  private colorFor(kind: "HIT" | "DOT" | "OTHER", isCrit: boolean): string {
    if (kind === "DOT") return "#ff9d5c";
    return isCrit ? "#ffd75e" : "#f1ecff";
  }

  private fontSizeFor(kind: "HIT" | "DOT" | "OTHER", isCrit: boolean): number {
    if (kind === "DOT") return 10;
    return isCrit ? 17 : 13;
  }

  /**
   * Public spawn primitive — kept 3-arg-compatible (position, amount,
   * isCrit) for direct/one-off callers and the existing test suite. The
   * two optional trailing params are how `reportEnemyDamage`'s flush
   * enforces the hard per-enemy-per-kind cap (rule 6/7): when an
   * `enemyId`+`kind` is given and a live text for that exact pair already
   * exists on screen, the new damage MERGES into it (adds to its amount,
   * restarts its pop/fade animation) instead of stacking a second,
   * overlapping number. Calls with no `enemyId` (or `kind: "OTHER"`, e.g.
   * the "UPGRADED" label) always push a fresh entry, unchanged from the
   * original behavior.
   */
  spawnDamageNumber(
    position: Vector2,
    amount: number,
    isCrit: boolean,
    enemyId?: string,
    kind: "HIT" | "DOT" | "OTHER" = "OTHER",
  ): void {
    if (amount < 0.5) return;
    const offsetX = kind === "DOT" ? 9 : (Math.random() - 0.5) * 8;
    const offsetY = kind === "DOT" ? 10 : 0;

    if (enemyId && kind !== "OTHER") {
      const existing = this.floatingTexts.find((t) => t.enemyId === enemyId && t.kind === kind);
      if (existing) {
        existing.amount += amount;
        existing.isCrit = existing.isCrit || isCrit;
        existing.text = `-${Math.round(existing.amount)}`;
        existing.color = this.colorFor(kind, existing.isCrit);
        existing.fontSizePx = this.fontSizeFor(kind, existing.isCrit);
        existing.x = position.x + offsetX;
        existing.y = position.y - 12 + offsetY;
        existing.remainingMs = existing.totalMs;
        return;
      }
    }

    const totalMs = kind === "DOT" ? 550 : isCrit ? 750 : 650;
    this.pushFloatingText({
      x: position.x + offsetX,
      y: position.y - 12 + offsetY,
      text: `-${Math.round(amount)}`,
      color: this.colorFor(kind, isCrit),
      remainingMs: totalMs,
      totalMs,
      amount,
      kind,
      enemyId,
      isCrit,
      fontSizePx: this.fontSizeFor(kind, isCrit),
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

  /**
   * CREATURE VFX & IMPACT PASS — material-specific hit reaction (spec
   * sections 3/5/7): the concrete answer to "não usar a mesma explosão em
   * todos os hits". Each family gets its own particle count/speed/curve/
   * color instead of one shared burst config, and `isCrit` amplifies the
   * SAME family shape (more particles, a brief hot core) rather than
   * switching to a different, unrelated crit effect — spec section 7's "o
   * crítico ainda precisa pertencer ao universo visual" requirement. Reuses
   * the existing bounded burst pool (pushBurst/MAX_BURSTS) — no new
   * particle system, no per-frame allocation beyond one short-lived entry.
   */
  spawnCreatureHit(position: Vector2, family: CreatureVfxFamily, isCrit: boolean, incomingDirection?: Vector2): void {
    const style = HIT_STYLE[family];
    const backAngle = incomingDirection
      ? Math.atan2(-incomingDirection.y, -incomingDirection.x)
      : Math.random() * Math.PI * 2;
    // VISUAL POLISH PASS spec section 4 — crit amplifies the SAME family
    // shape (more particles, faster/farther travel, a visibly bigger core
    // and dots) rather than switching to a different effect; readable at a
    // glance without a second color language or neon.
    const count = style.count + (isCrit ? 4 : 0);
    const spread = style.spread;
    const critMul = isCrit ? 1.4 : 1;
    this.pushBurst({
      x: position.x,
      y: position.y,
      color: style.color,
      remainingMs: style.durationMs,
      totalMs: style.durationMs,
      hotCore: isCrit || style.hotCore,
      lineWidth: (style.lineWidth ?? 1.4) * (isCrit ? 1.2 : 1),
      dotRadius: (style.dotRadius ?? 1.8) * (isCrit ? 1.3 : 1),
      particles: Array.from({ length: count }, (_, i) => ({
        angle: backAngle + (i / count - 0.5) * spread + (Math.random() - 0.5) * 0.25,
        speed: style.speed * critMul + Math.random() * style.speedJitter,
        curve: (Math.random() - 0.5) * style.curve,
      })),
    });
  }

  /**
   * CREATURE VFX & IMPACT PASS — material-specific death sequence (spec
   * section 13): organic collapses with soft fragments, crystal shatters
   * into sharp rigid shards, armored/heavy kicks up a wider dust cloud,
   * plant disperses as drifting petals, charred crumbles into embers/ash,
   * aquatic bursts into droplets plus a brief expanding water ring. `weight`
   * scales scale/count/duration on top of the family shape so a boss death
   * reads as a bigger event than the same family's regular creature without
   * needing a second, duplicate system.
   */
  spawnCreatureDeath(position: Vector2, family: CreatureVfxFamily, weight: CreatureWeightClass, travelDirection?: Vector2): void {
    const style = DEATH_STYLE[family];
    const weightMul = DEATH_WEIGHT_SCALE[weight];
    const baseAngle = travelDirection ? Math.atan2(travelDirection.y, travelDirection.x) + Math.PI : 0;
    const spread = travelDirection ? style.spread : Math.PI * 2;
    const count = Math.round(style.count * weightMul.countMul);
    this.pushBurst({
      x: position.x,
      y: position.y,
      color: style.color,
      remainingMs: style.durationMs * weightMul.durationMul,
      totalMs: style.durationMs * weightMul.durationMul,
      hotCore: style.hotCore,
      lineWidth: style.lineWidth,
      dotRadius: (style.dotRadius ?? 1.8) * Math.min(1.6, weightMul.countMul),
      particles: Array.from({ length: count }, (_, i) => ({
        angle: baseAngle + (i / count - 0.5) * spread + (Math.random() - 0.5) * 0.3,
        speed: (style.speed + Math.random() * style.speedJitter) * weightMul.speedMul,
        curve: (Math.random() - 0.5) * style.curve,
      })),
    });
    if (style.ring) {
      this.pushRing({
        x: position.x,
        y: position.y,
        color: style.color,
        remainingMs: 340 * weightMul.durationMul,
        totalMs: 340 * weightMul.durationMul,
        maxRadius: 16 * weightMul.countMul,
      });
    }
  }

  /**
   * Boss entrance impact (spec section 11): a small, controlled ground hit
   * at the boss's own entry point the instant BOSS_INTRO begins, tinted by
   * its material family — paired with the existing camera shake (spec
   * section 11: "impacto no terreno" + "VFX de entrada"), never a second,
   * louder effect competing with it.
   */
  spawnBossEntranceImpact(position: Vector2, family: CreatureVfxFamily): void {
    const style = HIT_STYLE[family];
    const count = 12;
    this.pushBurst({
      x: position.x,
      y: position.y,
      color: style.color,
      remainingMs: 460,
      totalMs: 460,
      hotCore: true,
      lineWidth: 2.4,
      dotRadius: 3.2,
      particles: Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
        speed: 34 + Math.random() * 26,
        curve: (Math.random() - 0.5) * style.curve,
      })),
    });
    // VISUAL POLISH PASS spec section 7 — a wide, slow ground-dust ring
    // alongside the particle burst so the entrance reads as "impacto no
    // terreno" (the ground itself responding), not just sparks in the air.
    this.pushRing({
      x: position.x,
      y: position.y,
      color: style.color,
      remainingMs: 520,
      totalMs: 520,
      maxRadius: 26,
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
      amount: 0,
      kind: "OTHER",
      isCrit: false,
      fontSizePx: 12,
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
    this.flushPending(this.pendingHits, dtMs, "HIT");
    this.flushPending(this.pendingDot, dtMs, "DOT");
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
        ctx.lineWidth = burst.lineWidth ?? 1.4;
        ctx.beginPath();
        ctx.moveTo(burst.x, burst.y);
        ctx.quadraticCurveTo(midX, midY, px, py);
        ctx.stroke();

        ctx.fillStyle = burst.hotCore ? "#fff6dd" : burst.color;
        ctx.beginPath();
        ctx.arc(px, py, burst.dotRadius ?? 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const t of this.floatingTexts) {
      const progress = 1 - t.remainingMs / t.totalMs;
      // "Pop" on impact: the number overshoots scale in the first ~18% of
      // its life (crits pop a bit harder), then eases back to 1x — reads
      // as a hit landing, not text quietly fading in.
      const popStrength = t.isCrit ? 0.5 : 0.35;
      const pop = progress < 0.18 ? 1 + (1 - progress / 0.18) * popStrength : 1;
      // Ease-out rise: fast at first, settling near the top — smoother and
      // less mechanical than a linear climb. DOT numbers rise a shorter
      // distance so they read as a lighter, secondary signal next to a
      // full tower hit.
      const eased = 1 - Math.pow(1 - progress, 3);
      const rise = t.kind === "DOT" ? 20 : 28;
      const alphaMul = t.kind === "DOT" ? 0.85 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - progress) * 1.6) * alphaMul;
      ctx.font = `bold ${t.fontSizePx}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.translate(t.x, t.y - eased * rise);
      ctx.scale(pop, pop);
      ctx.lineWidth = t.kind === "DOT" ? 2 : 3;
      ctx.strokeStyle = "rgba(10,8,5,0.85)";
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }
}
