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
import { getTowerSpecialAtLevel, type TowerType } from "@/config/towerStats";
import { distance, type Vector2 } from "@/utils/geometry";

/**
 * Damage/status resolution only. Does NOT decide who died or award gold —
 * that is a bookkeeping concern the engine handles once per tick after
 * combat AND enemy movement (burn ticks also kill enemies) have both run,
 * so a kill is never attributed twice.
 */

/** One instance of a tower dealing damage — feeds BattleDiagnostics' failure-report recommendations. */
export interface DamageEvent {
  towerId: string;
  towerType: TowerType;
  enemyId: string;
  amount: number;
  /** The target's damageReduction at the moment of the hit — flags "high resistance" fights for diagnostics. */
  targetDamageReduction: number;
}

export interface CombatTickResult {
  projectiles: ProjectileInstance[];
  damageEvents: DamageEvent[];
}

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
): CombatTickResult {
  const projectiles: ProjectileInstance[] = [];
  const damageEvents: DamageEvent[] = [];

  const dealDamage = (tower: TowerInstance, enemy: EnemyInstance, rawDamage: number): void => {
    const targetDamageReduction = enemy.damageReduction;
    const actual = applyDamageToEnemy(enemy, rawDamage);
    damageEvents.push({
      towerId: tower.id,
      towerType: tower.type,
      enemyId: enemy.id,
      amount: actual,
      targetDamageReduction,
    });
  };

  for (const tower of towers) {
    tickTowerCooldown(tower, dtMs);
    if (!isTowerReadyToAttack(tower)) continue;

    const stats = getTowerStats(tower);
    const target = findPrimaryTarget(tower.position, stats.range, enemies);
    if (!target) continue;

    resetTowerCooldown(tower);
    const special = getTowerSpecialAtLevel(tower.type, tower.level);

    if (special.type === "IRONWOOD") {
      const isCrit = Math.random() < special.critChance;
      dealDamage(tower, target, stats.damage * (isCrit ? special.critMultiplier : 1));
      projectiles.push(createProjectile(tower.type, tower.position, target.position));

      // Extra projectiles (unlocked at level 10/20, see towerStats.ts) hit
      // additional nearby targets instead of piling more damage onto one —
      // a real behavior change, not just a bigger number.
      const alreadyHit = new Set<string>([target.id]);
      for (let i = 1; i < stats.projectileCount; i++) {
        const extra = findNearestUnhit(tower.position, stats.range, enemies, alreadyHit);
        if (!extra) break;
        const extraCrit = Math.random() < special.critChance;
        dealDamage(tower, extra, stats.damage * (extraCrit ? special.critMultiplier : 1));
        projectiles.push(createProjectile(tower.type, tower.position, extra.position));
        alreadyHit.add(extra.id);
      }
    } else if (special.type === "INFERNO") {
      for (const enemy of enemies) {
        if (isEnemyDead(enemy)) continue;
        if (distance(target.position, enemy.position) > special.aoeRadius) continue;
        dealDamage(tower, enemy, stats.damage);
        applyBurn(enemy, special.burnDamagePerSecond, special.burnDurationMs);
      }
      projectiles.push(createProjectile(tower.type, tower.position, target.position));
    } else if (special.type === "FROSTBORN") {
      dealDamage(tower, target, stats.damage);
      applySlow(target, special.slowPercent, special.slowDurationMs);
      projectiles.push(createProjectile(tower.type, tower.position, target.position));
    } else if (special.type === "STORMCALLER") {
      dealDamage(tower, target, stats.damage);

      const chainImpactPoints: Vector2[] = [];
      const alreadyHit = new Set<string>([target.id]);
      let chainOrigin = target;
      let chainDamage = stats.damage;

      for (let i = 0; i < special.chainTargets; i++) {
        chainDamage *= special.chainFalloff;
        const next = findNearestUnhit(chainOrigin.position, stats.range * 0.6, enemies, alreadyHit);
        if (!next) break;
        dealDamage(tower, next, chainDamage);
        chainImpactPoints.push(next.position);
        alreadyHit.add(next.id);
        chainOrigin = next;
      }

      projectiles.push(
        createProjectile(tower.type, tower.position, target.position, chainImpactPoints),
      );
    }
  }

  return { projectiles, damageEvents };
}
