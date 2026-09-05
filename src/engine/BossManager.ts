import type { BossDefinition } from "@/config/bossConfig";
import { getScaledEnemyStats } from "@/config/enemyStats";
import { getEndgameBossHpMultiplierBonus } from "@/config/phaseConfig";
import { getPointAtDistance, distance } from "@/utils/geometry";
import { ENEMY_PATH } from "@/data/mapWhisperingWoods";
import { createEnemyInstance, REGEN_SUPPRESSION_MS, type EnemyInstance } from "@/entities/Enemy";
import { tryDisableNearestTower } from "./CombatSystem";
import type { TowerInstance } from "@/entities/Tower";
import {
  SIEGE_INTERVAL_MS,
  SIEGE_RADIUS,
  SIEGE_TELEGRAPH_MS,
  SIEGE_DAMAGE_FRACTION_OF_MAX_HP,
} from "@/config/bossSiege";

let nextBossInstanceId = 1;

/** Below this HP fraction, a boss enrages once — see tickBossAbilities. */
const ENRAGE_HP_THRESHOLD = 0.3;
const ENRAGE_SPEED_MULTIPLIER = 1.4;
const ENRAGE_ABILITY_INTERVAL_MULTIPLIER = 0.5;
const DISABLE_RADIUS = 300;
const DISABLE_DURATION_MS = 2000;

/**
 * Builds a boss (or mini-boss) as an EnemyInstance so it flows through the
 * exact same movement/damage/status pipeline as every other enemy — only
 * the extra `boss` field marks it as special. HP baselines off a same-wave
 * Brute (the tankiest regular enemy) rather than a hardcoded number, so
 * bosses automatically scale with the same wave-difficulty curve.
 */
export function createBossInstance(def: BossDefinition, waveNumber: number, nowMs: number): EnemyInstance {
  const bruteBaseline = getScaledEnemyStats("BRUTE", waveNumber);
  const start = getPointAtDistance(ENEMY_PATH, 0);
  // CORREÇÃO DE REQUISITOS (BOSS STALL FIX) — a small, bounded, ever-so-
  // slowly-growing multiplier on top of the boss's normal HP baseline once
  // the post-130 endgame rotation is underway (1 = no change everywhere
  // else) — see phaseConfig.ts's own doc comment for the full rationale.
  const hp = Math.round(bruteBaseline.hp * def.hpMultiplierVsBrute * getEndgameBossHpMultiplierBonus(waveNumber));

  return {
    id: `boss-${nextBossInstanceId++}`,
    type: def.isMainBoss ? "BRUTE" : "SHIELDBEARER",
    hp,
    maxHp: hp,
    baseSpeed: def.speed,
    damageToBase: def.damageToBase,
    goldReward: def.goldReward,
    damageReduction: def.resistance,
    regenPerSecond: hp * def.regenPercentPerSecond,
    distanceTraveled: 0,
    position: start.position,
    direction: start.direction,
    slow: null,
    burn: null,
    ccResistanceStacks: 0,
    ccResistanceDecayRemainingMs: 0,
    msSinceLastDamage: REGEN_SUPPRESSION_MS,
    boss: {
      bossId: def.id,
      nameKey: def.i18nKey,
      isMainBoss: def.isMainBoss,
      ability: def.ability,
      abilityIntervalMs: def.abilityIntervalMs,
      baseDamageReduction: def.resistance,
      shieldUntilMs: null,
      nextAbilityAtMs: nowMs + def.abilityIntervalMs,
      enraged: false,
      // Master Implementation Pass spec section 13 — main-boss-only scope
      // (see config/bossSiege.ts's doc comment for why mini-bosses don't
      // get this in this first pass).
      nextSiegeAtMs: def.isMainBoss ? nowMs + SIEGE_INTERVAL_MS : null,
      siegeTelegraphRemainingMs: 0,
      siegeTargetTowerId: null,
    },
  };
}

export interface SiegeHitEvent {
  targetTowerId: string;
  rawDamage: number;
}

/**
 * Advances a boss's Siege Attack cadence — fully independent of
 * tickBossAbilities' own cadence above. Two-phase: first picks the nearest
 * in-range tower and starts a telegraph (spec: "com telegraph" — never an
 * instant, unreadable hit), then resolves the actual hit once the
 * telegraph expires. Returns a SiegeHitEvent only on the tick the hit
 * actually lands (so the caller can apply damage/VFX/SFX exactly once),
 * null every other tick.
 */
export function tickBossSiege(boss: EnemyInstance, nowMs: number, dtMs: number, towers: readonly TowerInstance[]): SiegeHitEvent | null {
  const state = boss.boss;
  if (!state || state.nextSiegeAtMs === null) return null;

  // Phase 2: a telegraph is already running — count it down, resolve on expiry.
  if (state.siegeTelegraphRemainingMs > 0) {
    state.siegeTelegraphRemainingMs = Math.max(0, state.siegeTelegraphRemainingMs - dtMs);
    if (state.siegeTelegraphRemainingMs > 0) return null;

    const targetTowerId = state.siegeTargetTowerId;
    state.siegeTargetTowerId = null;
    if (!targetTowerId) return null;
    const target = towers.find((t) => t.id === targetTowerId);
    if (!target) return null; // the tower could have been sold/removed mid-telegraph in a future build — never crash on a stale id
    return { targetTowerId, rawDamage: target.maxHp * SIEGE_DAMAGE_FRACTION_OF_MAX_HP };
  }

  // Phase 1: due for a new siege — find the nearest tower in range and start telegraphing.
  if (nowMs < state.nextSiegeAtMs) return null;
  state.nextSiegeAtMs = nowMs + SIEGE_INTERVAL_MS;

  let nearest: TowerInstance | null = null;
  let nearestDistance = Infinity;
  for (const tower of towers) {
    const d = distance(boss.position, tower.position);
    if (d > SIEGE_RADIUS || d >= nearestDistance) continue;
    nearest = tower;
    nearestDistance = d;
  }
  if (nearest) {
    state.siegeTargetTowerId = nearest.id;
    state.siegeTelegraphRemainingMs = SIEGE_TELEGRAPH_MS;
  }
  return null;
}

/**
 * Advances a boss's ability cadence. Returns any enemies the ability
 * summons this tick (empty otherwise) — the caller is responsible for
 * pushing them into the live enemies array, same as any other spawn.
 *
 * Enrage (spec section 8/9 — "múltiplas fases" / a fight has to escalate,
 * not just be a bigger HP bar): triggers below ENRAGE_HP_THRESHOLD for
 * EVERY main boss automatically (their built-in phase 2), AND for any
 * mini-boss whose signature ability is explicitly "BERSERKER" — the one
 * mini-boss archetype defined by getting more dangerous as it's hurt.
 * REGEN is intentionally NOT one of the cases below — that archetype
 * (regular enemy or mini-boss) heals passively every tick via
 * `regenPerSecond` on the EnemyInstance itself (entities/Enemy.ts
 * advanceEnemy), the same mechanism for both, so there's nothing to do
 * here on the ability's own interval.
 */
export function tickBossAbilities(
  boss: EnemyInstance,
  nowMs: number,
  waveNumber: number,
  towers: readonly TowerInstance[],
): EnemyInstance[] {
  const state = boss.boss;
  if (!state) return [];

  if (state.shieldUntilMs !== null && nowMs >= state.shieldUntilMs) {
    boss.damageReduction = state.baseDamageReduction;
    state.shieldUntilMs = null;
  }

  const enragesOnLowHp = state.isMainBoss || state.ability === "BERSERKER";
  if (enragesOnLowHp && !state.enraged && boss.maxHp > 0 && boss.hp / boss.maxHp <= ENRAGE_HP_THRESHOLD) {
    state.enraged = true;
    boss.baseSpeed *= ENRAGE_SPEED_MULTIPLIER;
    state.abilityIntervalMs = Math.round(state.abilityIntervalMs * ENRAGE_ABILITY_INTERVAL_MULTIPLIER);
    state.nextAbilityAtMs = Math.min(state.nextAbilityAtMs, nowMs + state.abilityIntervalMs);
  }

  if (nowMs < state.nextAbilityAtMs) return [];
  state.nextAbilityAtMs = nowMs + state.abilityIntervalMs;

  switch (state.ability) {
    case "SHIELD": {
      boss.damageReduction = 0.85;
      state.shieldUntilMs = nowMs + 2500;
      return [];
    }
    case "SUMMON": {
      return [createEnemyInstance("CRAWLER", waveNumber), createEnemyInstance("CRAWLER", waveNumber)];
    }
    case "DISABLE": {
      tryDisableNearestTower(boss.position, DISABLE_RADIUS, DISABLE_DURATION_MS, towers);
      return [];
    }
    case "REGEN":
    case "BERSERKER":
    case "NONE":
    default:
      return [];
  }
}
