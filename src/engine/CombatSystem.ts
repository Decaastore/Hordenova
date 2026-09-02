import {
  disableTower,
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
import { ENEMY_DEFINITIONS } from "@/config/enemyStats";
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

/**
 * DISABLER-archetype enemies (regular type or a mini-boss with the DISABLE
 * ability) periodically jam the nearest tower — spec section 3's "the
 * enemy interferes with the build itself, not just its own stats". Shared
 * by both call sites (GameEngine, per regular DISABLER enemy) and
 * BossManager's DISABLE ability case) so there's one implementation of
 * "find and jam the nearest tower", not two.
 */
export function tryDisableNearestTower(
  origin: Vector2,
  radius: number,
  durationMs: number,
  towers: readonly TowerInstance[],
): void {
  let nearest: TowerInstance | null = null;
  let nearestDistance = Infinity;
  for (const tower of towers) {
    const d = distance(origin, tower.position);
    if (d > radius || d >= nearestDistance) continue;
    nearest = tower;
    nearestDistance = d;
  }
  if (nearest) disableTower(nearest, durationMs);
}

/** Ticks every regular DISABLER-type enemy's jam cooldown, triggering `tryDisableNearestTower` when due. Mini-boss DISABLE is handled separately by BossManager (it already has its own ability-cadence ticking). */
export function tickEnemyDisableAbilities(
  enemies: readonly EnemyInstance[],
  towers: readonly TowerInstance[],
  nowMs: number,
): void {
  for (const enemy of enemies) {
    if (enemy.type !== "DISABLER" || !enemy.disablerState || isEnemyDead(enemy)) continue;
    if (nowMs < enemy.disablerState.nextTriggerAtMs) continue;

    const def = ENEMY_DEFINITIONS.DISABLER;
    enemy.disablerState.nextTriggerAtMs = nowMs + (def.disablerIntervalMs ?? 4000);
    tryDisableNearestTower(enemy.position, def.disablerRadius ?? 260, def.disablerDurationMs ?? 1500, towers);
  }
}

export function tickCombat(
  towers: readonly TowerInstance[],
  enemies: readonly EnemyInstance[],
  dtMs: number,
): CombatTickResult {
  const projectiles: ProjectileInstance[] = [];
  const damageEvents: DamageEvent[] = [];

  const dealDamage = (
    tower: TowerInstance,
    enemy: EnemyInstance,
    rawDamage: number,
    armorPenetration = 0,
  ): void => {
    const targetDamageReduction = enemy.damageReduction;
    const actual = applyDamageToEnemy(enemy, rawDamage, armorPenetration);
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
      const bossMult = (enemy: EnemyInstance) => (enemy.boss ? special.bossDamageMultiplier : 1);
      const isCrit = Math.random() < special.critChance;
      dealDamage(tower, target, stats.damage * (isCrit ? special.critMultiplier : 1) * bossMult(target));
      projectiles.push(createProjectile(tower.type, tower.position, target.position));

      // Extra projectiles (unlocked at level 10/20, see towerStats.ts) hit
      // additional nearby targets instead of piling more damage onto one —
      // a real behavior change, not just a bigger number.
      const alreadyHit = new Set<string>([target.id]);
      for (let i = 1; i < stats.projectileCount; i++) {
        const extra = findNearestUnhit(tower.position, stats.range, enemies, alreadyHit);
        if (!extra) break;
        const extraCrit = Math.random() < special.critChance;
        dealDamage(tower, extra, stats.damage * (extraCrit ? special.critMultiplier : 1) * bossMult(extra));
        projectiles.push(createProjectile(tower.type, tower.position, extra.position));
        alreadyHit.add(extra.id);
      }
    } else if (special.type === "INFERNO") {
      for (const enemy of enemies) {
        if (isEnemyDead(enemy)) continue;
        if (distance(target.position, enemy.position) > special.aoeRadius) continue;
        dealDamage(tower, enemy, stats.damage);
        applyBurn(enemy, special.burnDamagePerSecond, special.burnDurationMs, special.burnMaxStacks);
      }
      projectiles.push(createProjectile(tower.type, tower.position, target.position));
    } else if (special.type === "FROSTBORN") {
      dealDamage(tower, target, stats.damage);
      // Deep Freeze (unlocked at level 10): a chance to fully stop the
      // target instead of the normal partial slow — reuses the exact same
      // slow-effect plumbing (100% = a freeze), no new status type needed.
      const isFreeze = special.freezeChance > 0 && Math.random() < special.freezeChance;
      if (isFreeze) {
        applySlow(target, 1, special.freezeDurationMs);
      } else {
        applySlow(target, special.slowPercent, special.slowDurationMs);
      }
      projectiles.push(createProjectile(tower.type, tower.position, target.position));
    } else if (special.type === "STORMCALLER") {
      dealDamage(tower, target, stats.damage, special.armorPenetration);

      const chainImpactPoints: Vector2[] = [];
      const alreadyHit = new Set<string>([target.id]);
      let chainOrigin = target;
      let chainDamage = stats.damage;

      for (let i = 0; i < special.chainTargets; i++) {
        chainDamage *= special.chainFalloff;
        const next = findNearestUnhit(chainOrigin.position, stats.range * 0.6, enemies, alreadyHit);
        if (!next) break;
        dealDamage(tower, next, chainDamage, special.armorPenetration);
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
