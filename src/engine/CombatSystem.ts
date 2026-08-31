import {
  getTowerStats,
  isTowerReadyToAttack,
  resetTowerCooldown,
  tickTowerCooldown,
  type TowerInstance,
} from "@/entities/Tower";
import {
  applyBurn,
  applyDamageToEnemy,
  applySlow,
  isEnemyDead,
  type EnemyInstance,
} from "@/entities/Enemy";
import { createProjectile, type ProjectileInstance } from "@/entities/Projectile";
import { TOWER_SPECIALS } from "@/config/towerStats";
import { distance, type Vector2 } from "@/utils/geometry";

/**
 * Damage/status resolution only. Does NOT decide who died or award gold —
 * that is a bookkeeping concern the engine handles once per tick after
 * combat AND enemy movement (burn ticks also kill enemies) have both run,
 * so a kill is never attributed twice.
 */

/** The enemy furthest along the path within range — classic "first" TD targeting. */
export function findPrimaryTarget(
  origin: Vector2,
  range: number,
  enemies: readonly EnemyInstance[],
): EnemyInstance | null {
  let best: EnemyInstance | null = null;
  for (const enemy of enemies) {
    if (isEnemyDead(enemy)) continue;
    if (distance(origin, enemy.position) > range) continue;
    if (!best || enemy.distanceTraveled > best.distanceTraveled) best = enemy;
  }
  return best;
}

function findNearestUnhit(
  origin: Vector2,
  range: number,
  enemies: readonly EnemyInstance[],
  exclude: ReadonlySet<string>,
): EnemyInstance | null {
  let best: EnemyInstance | null = null;
  let bestDistance = Infinity;
  for (const enemy of enemies) {
    if (isEnemyDead(enemy) || exclude.has(enemy.id)) continue;
    const d = distance(origin, enemy.position);
    if (d > range) continue;
    if (d < bestDistance) {
      best = enemy;
      bestDistance = d;
    }
  }
  return best;
}

export function tickCombat(
  towers: readonly TowerInstance[],
  enemies: readonly EnemyInstance[],
  dtMs: number,
): ProjectileInstance[] {
  const projectiles: ProjectileInstance[] = [];

  for (const tower of towers) {
    tickTowerCooldown(tower, dtMs);
    if (!isTowerReadyToAttack(tower)) continue;

    const stats = getTowerStats(tower);
    const target = findPrimaryTarget(tower.position, stats.range, enemies);
    if (!target) continue;

    resetTowerCooldown(tower);

    if (tower.type === "IRONWOOD") {
      const special = TOWER_SPECIALS.IRONWOOD;
      const isCrit = Math.random() < special.critChance;
      applyDamageToEnemy(target, stats.damage * (isCrit ? special.critMultiplier : 1));
      projectiles.push(createProjectile(tower.type, tower.position, target.position));
    } else if (tower.type === "INFERNO") {
      const special = TOWER_SPECIALS.INFERNO;
      for (const enemy of enemies) {
        if (isEnemyDead(enemy)) continue;
        if (distance(target.position, enemy.position) > special.aoeRadius) continue;
        applyDamageToEnemy(enemy, stats.damage);
        applyBurn(enemy, special.burnDamagePerSecond, special.burnDurationMs);
      }
      projectiles.push(createProjectile(tower.type, tower.position, target.position));
    } else if (tower.type === "FROSTBORN") {
      const special = TOWER_SPECIALS.FROSTBORN;
      applyDamageToEnemy(target, stats.damage);
      applySlow(target, special.slowPercent, special.slowDurationMs);
      projectiles.push(createProjectile(tower.type, tower.position, target.position));
    } else if (tower.type === "STORMCALLER") {
      const special = TOWER_SPECIALS.STORMCALLER;
      applyDamageToEnemy(target, stats.damage);

      const chainImpactPoints: Vector2[] = [];
      const alreadyHit = new Set<string>([target.id]);
      let chainOrigin = target;
      let chainDamage = stats.damage;

      for (let i = 0; i < special.chainTargets; i++) {
        chainDamage *= special.chainFalloff;
        const next = findNearestUnhit(chainOrigin.position, stats.range * 0.6, enemies, alreadyHit);
        if (!next) break;
        applyDamageToEnemy(next, chainDamage);
        chainImpactPoints.push(next.position);
        alreadyHit.add(next.id);
        chainOrigin = next;
      }

      projectiles.push(
        createProjectile(tower.type, tower.position, target.position, chainImpactPoints),
      );
    }
  }

  return projectiles;
}
