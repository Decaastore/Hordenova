import type { TowerType } from "@/config/towerStats";
import type { Vector2 } from "@/utils/geometry";

/**
 * Purely cosmetic. CombatSystem resolves damage instantly (hitscan) and
 * emits one of these so the renderer has something to animate for a brief
 * moment — it carries no gameplay authority and the engine never reads it.
 */
export interface ProjectileInstance {
  id: string;
  towerType: TowerType;
  from: Vector2;
  to: Vector2;
  /** Extra impact points for Stormcaller's chain-lightning visual. */
  chainTargets: Vector2[];
  remainingMs: number;
  totalMs: number;
  /** Master Implementation spec section 27 — true for a tower's fixed-interval Special Attack (see config/towerSpecials.ts), never a normal attack. Purely a rendering signal (bigger/flashier draw in EntityRenderer.drawProjectile) — carries no extra gameplay authority than a normal projectile already had. */
  isSpecial: boolean;
}

let nextProjectileId = 1;

const DEFAULT_DURATION_MS = 140;
/** Specials get a slightly longer flight so the bigger visual actually reads before it resolves. */
const SPECIAL_DURATION_MS = 220;

export function createProjectile(
  towerType: TowerType,
  from: Vector2,
  to: Vector2,
  chainTargets: Vector2[] = [],
  isSpecial = false,
  durationMs: number = isSpecial ? SPECIAL_DURATION_MS : DEFAULT_DURATION_MS,
): ProjectileInstance {
  return {
    id: `projectile-${nextProjectileId++}`,
    towerType,
    from,
    to,
    chainTargets,
    remainingMs: durationMs,
    totalMs: durationMs,
    isSpecial,
  };
}

/** Mutates `projectile` in place, ticking its remaining lifetime down. */
export function tickProjectile(projectile: ProjectileInstance, dtMs: number): void {
  projectile.remainingMs = Math.max(0, projectile.remainingMs - dtMs);
}

export function isProjectileExpired(projectile: ProjectileInstance): boolean {
  return projectile.remainingMs <= 0;
}
