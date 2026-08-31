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
}

let nextProjectileId = 1;

const DEFAULT_DURATION_MS = 140;

export function createProjectile(
  towerType: TowerType,
  from: Vector2,
  to: Vector2,
  chainTargets: Vector2[] = [],
  durationMs: number = DEFAULT_DURATION_MS,
): ProjectileInstance {
  return {
    id: `projectile-${nextProjectileId++}`,
    towerType,
    from,
    to,
    chainTargets,
    remainingMs: durationMs,
    totalMs: durationMs,
  };
}

/** Mutates `projectile` in place, ticking its remaining lifetime down. */
export function tickProjectile(projectile: ProjectileInstance, dtMs: number): void {
  projectile.remainingMs = Math.max(0, projectile.remainingMs - dtMs);
}

export function isProjectileExpired(projectile: ProjectileInstance): boolean {
  return projectile.remainingMs <= 0;
}
