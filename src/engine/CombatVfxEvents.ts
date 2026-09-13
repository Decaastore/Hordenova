import type { Vector2 } from "@/utils/geometry";

/**
 * Floating Damage Numbers rewrite — pure data describing damage that was
 * REALLY just applied to an enemy's real `hp` this tick (never a projectile
 * fired, an attack attempted, or a render-side hp-diff guess). Mirrors
 * AudioEvents.ts's own separation: this file lives in `engine/` so
 * GameEngine can emit these with zero Canvas/VfxManager coupling —
 * `rendering/CanvasRenderer.tsx` is the only place that turns these into an
 * actual floating-text spawn (via `VfxManager.reportEnemyDamage`).
 *
 * Two kinds, reported separately per the "DOT deve ser tratado
 * separadamente" requirement:
 *   HIT — a single discrete tower-attack damage application (CombatSystem's
 *         `dealDamage`, which returns exactly the real post-reduction
 *         amount subtracted from `enemy.hp`).
 *   DOT — one tick's worth of continuous burn damage (`advanceEnemy`'s
 *         `burnDamageDealt`, also the exact amount subtracted from
 *         `enemy.hp` that tick). Reported every tick it occurs; the
 *         rendering layer is responsible for aggregating these into
 *         readable periodic numbers instead of one-per-frame spam.
 */
export interface CombatVfxEvent {
  kind: "HIT" | "DOT";
  enemyId: string;
  /** The enemy's real position at the moment this damage was applied. */
  position: Vector2;
  /** Exact amount subtracted from `enemy.hp` — never a raw/pre-reduction value. */
  amount: number;
  /** HIT only — true when this exact hit rolled a real critical (see CombatSystem.ts's DamageEvent.isCrit). Always false for DOT. */
  isCrit: boolean;
}
