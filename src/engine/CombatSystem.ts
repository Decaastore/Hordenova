import {
  disableTower,
  getTowerStats,
  isTowerReadyForSpecial,
  isTowerReadyToAttack,
  resetTowerCooldown,
  resetTowerSpecialCooldown,
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
import { getTowerSpecialAtLevel, type TowerSpecial, type TowerType } from "@/config/towerStats";
import { applySpecializationToSpecial } from "@/config/specializations";
import { ENEMY_DEFINITIONS } from "@/config/enemyStats";
import { FROSTBORN_SPECIAL, INFERNO_SPECIAL, IRONWOOD_SPECIAL, STORMCALLER_SPECIAL } from "@/config/towerSpecials";
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
  /** True only for the hit that just froze the target (100% slow, not a partial one) — purely descriptive, read by GameEngine's audio layer to fire the "real freeze" SFX exactly once per freeze (Audio spec section 3), never derived from damage math. */
  isFreeze?: boolean;
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
  ): DamageEvent => {
    const targetDamageReduction = enemy.damageReduction;
    const actual = applyDamageToEnemy(enemy, rawDamage, armorPenetration);
    const event: DamageEvent = {
      towerId: tower.id,
      towerType: tower.type,
      enemyId: enemy.id,
      amount: actual,
      targetDamageReduction,
    };
    damageEvents.push(event);
    return event;
  };

  for (const tower of towers) {
    tickTowerCooldown(tower, dtMs);

    // Normal attack — unchanged cadence/logic. No longer `continue`s the
    // whole tower on a miss/no-target: the Special Attack block below is a
    // fully independent cooldown (Master Implementation spec section
    // 26-28) and must still get its own chance to fire on the same tick
    // even when the normal attack isn't ready or has nothing to hit.
    if (isTowerReadyToAttack(tower)) {
      resolveNormalAttack(tower, enemies, dealDamage, projectiles);
    }

    if (isTowerReadyForSpecial(tower)) {
      resolveSpecialAttack(tower, enemies, dealDamage, projectiles);
    }
  }

  return { projectiles, damageEvents };
}

function resolveNormalAttack(
  tower: TowerInstance,
  enemies: readonly EnemyInstance[],
  dealDamage: (tower: TowerInstance, enemy: EnemyInstance, rawDamage: number, armorPenetration?: number) => DamageEvent,
  projectiles: ProjectileInstance[],
): void {
  const stats = getTowerStats(tower);
  const target = findPrimaryTarget(tower.position, stats.range, enemies);
  if (!target) return;

  resetTowerCooldown(tower);
  const special = applySpecializationToSpecial(
    getTowerSpecialAtLevel(tower.type, tower.level),
    tower.specializationId,
    tower.specializationLevel,
  );

  {
    if (special.type === "IRONWOOD") {
      const bossMult = (enemy: EnemyInstance) => (enemy.boss ? special.bossDamageMultiplier : 1);
      const armorPen = special.bonusArmorPenetration ?? 0;
      const isCrit = Math.random() < special.critChance;
      dealDamage(tower, target, stats.damage * (isCrit ? special.critMultiplier : 1) * bossMult(target), armorPen);
      projectiles.push(createProjectile(tower.type, tower.position, target.position));

      // Extra projectiles (unlocked at level 10/20, see towerStats.ts, plus
      // an optional specialization bonus — see config/specializations.ts)
      // hit additional nearby targets instead of piling more damage onto
      // one — a real behavior change, not just a bigger number.
      const alreadyHit = new Set<string>([target.id]);
      const totalProjectiles = stats.projectileCount + (special.bonusProjectiles ?? 0);
      for (let i = 1; i < totalProjectiles; i++) {
        const extra = findNearestUnhit(tower.position, stats.range, enemies, alreadyHit);
        if (!extra) break;
        const extraCrit = Math.random() < special.critChance;
        dealDamage(tower, extra, stats.damage * (extraCrit ? special.critMultiplier : 1) * bossMult(extra), armorPen);
        projectiles.push(createProjectile(tower.type, tower.position, extra.position));
        alreadyHit.add(extra.id);
      }
    } else if (special.type === "INFERNO") {
      const comboMult = special.burningComboDamageMultiplier ?? 0;
      for (const enemy of enemies) {
        if (isEnemyDead(enemy)) continue;
        if (distance(target.position, enemy.position) > special.aoeRadius) continue;
        // Detonator specialization: a hit landing on an already-burning
        // target deals bonus impact damage — an "explosion" flavor that
        // reuses the existing burn-flag check instead of a new kill-time hook.
        const mult = enemy.burn ? 1 + comboMult : 1;
        dealDamage(tower, enemy, stats.damage * mult);
        applyBurn(enemy, special.burnDamagePerSecond, special.burnDurationMs, special.burnMaxStacks);
      }
      projectiles.push(createProjectile(tower.type, tower.position, target.position));
    } else if (special.type === "FROSTBORN") {
      // Shatter specialization: bonus damage against a target that's
      // already fully frozen (a 100% slow) rather than the normal partial one.
      const frozenMult = target.slow?.percent === 1 ? 1 + (special.frozenBonusDamageMultiplier ?? 0) : 1;
      const event = dealDamage(tower, target, stats.damage * frozenMult);
      // Deep Freeze (unlocked at level 10): a chance to fully stop the
      // target instead of the normal partial slow — reuses the exact same
      // slow-effect plumbing (100% = a freeze), no new status type needed.
      const isFreeze = special.freezeChance > 0 && Math.random() < special.freezeChance;
      if (isFreeze) {
        applySlow(target, 1, special.freezeDurationMs);
        event.isFreeze = true;
      } else {
        applySlow(target, special.slowPercent, special.slowDurationMs);
      }
      projectiles.push(createProjectile(tower.type, tower.position, target.position));
    } else if (special.type === "STORMCALLER") {
      const bonusFlat = special.bonusFlatDamage ?? 0;
      dealDamage(tower, target, stats.damage + bonusFlat, special.armorPenetration);

      const chainImpactPoints: Vector2[] = [];
      const alreadyHit = new Set<string>([target.id]);
      let chainOrigin = target;
      let chainDamage = stats.damage + bonusFlat;

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
}

/**
 * Master Implementation spec section 26-28 — Special Attack. Fully
 * independent of `resolveNormalAttack`'s cooldown/logic above: fires on its
 * own fixed interval (config/towerSpecials.ts), with its own per-type
 * identity, using the SAME `dealDamage`/status-effect plumbing so it's
 * still subject to the real damageReduction/armorPenetration math — just a
 * much bigger, rarer hit, never a second copy of the normal attack's own
 * per-level growth curve. Note: "special" elsewhere in this file (and in
 * config/towerStats.ts's `TowerSpecial`) means the tower's per-level
 * identity stats (crit chance, aoeRadius, etc.) — an unfortunate but
 * pre-existing name collision with the player-facing "Special Attack" this
 * function resolves; kept distinct here as `ultimate`.
 */
function resolveSpecialAttack(
  tower: TowerInstance,
  enemies: readonly EnemyInstance[],
  dealDamage: (tower: TowerInstance, enemy: EnemyInstance, rawDamage: number, armorPenetration?: number) => DamageEvent,
  projectiles: ProjectileInstance[],
): void {
  const stats = getTowerStats(tower);
  const target = findPrimaryTarget(tower.position, stats.range, enemies);
  if (!target) return;

  resetTowerSpecialCooldown(tower);
  const ultimate = tower.type;

  if (ultimate === "IRONWOOD") {
    dealDamage(tower, target, stats.damage * IRONWOOD_SPECIAL.damageMultiplier, IRONWOOD_SPECIAL.armorPenetration);
    projectiles.push(createProjectile(tower.type, tower.position, target.position, [], true));
  } else if (ultimate === "INFERNO") {
    const infernoSpecial = getTowerSpecialAtLevel("INFERNO", tower.level) as Extract<TowerSpecial, { type: "INFERNO" }>;
    const radius = infernoSpecial.aoeRadius * INFERNO_SPECIAL.radiusMultiplier;
    for (const enemy of enemies) {
      if (isEnemyDead(enemy)) continue;
      if (distance(target.position, enemy.position) > radius) continue;
      dealDamage(tower, enemy, stats.damage * INFERNO_SPECIAL.damageMultiplier);
      applyBurn(enemy, infernoSpecial.burnDamagePerSecond, infernoSpecial.burnDurationMs, infernoSpecial.burnMaxStacks);
    }
    projectiles.push(createProjectile(tower.type, tower.position, target.position, [], true));
  } else if (ultimate === "FROSTBORN") {
    // A nova centered on the TOWER itself, not the target — every enemy in
    // range is fully frozen, not just the primary target (spec: area
    // control identity, distinct from Ironwood's single-target burst).
    for (const enemy of enemies) {
      if (isEnemyDead(enemy)) continue;
      if (distance(tower.position, enemy.position) > stats.range) continue;
      dealDamage(tower, enemy, stats.damage * FROSTBORN_SPECIAL.damageMultiplier);
      applySlow(enemy, 1, FROSTBORN_SPECIAL.freezeDurationMs);
    }
    projectiles.push(createProjectile(tower.type, tower.position, target.position, [], true));
  } else if (ultimate === "STORMCALLER") {
    const stormSpecial = getTowerSpecialAtLevel("STORMCALLER", tower.level) as Extract<TowerSpecial, { type: "STORMCALLER" }>;
    let chainDamage = stats.damage * STORMCALLER_SPECIAL.damageMultiplier;
    dealDamage(tower, target, chainDamage, stormSpecial.armorPenetration);

    const chainImpactPoints: Vector2[] = [];
    const alreadyHit = new Set<string>([target.id]);
    let chainOrigin = target;
    const totalChain = stormSpecial.chainTargets + STORMCALLER_SPECIAL.extraChainTargets;
    for (let i = 0; i < totalChain; i++) {
      chainDamage *= stormSpecial.chainFalloff;
      const next = findNearestUnhit(chainOrigin.position, stats.range * 0.6, enemies, alreadyHit);
      if (!next) break;
      dealDamage(tower, next, chainDamage, stormSpecial.armorPenetration);
      chainImpactPoints.push(next.position);
      alreadyHit.add(next.id);
      chainOrigin = next;
    }
    projectiles.push(createProjectile(tower.type, tower.position, target.position, chainImpactPoints, true));
  }
}
