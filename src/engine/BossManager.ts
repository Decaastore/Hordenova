import type { BossDefinition } from "@/config/bossConfig";
import { getScaledEnemyStats } from "@/config/enemyStats";
import { getPointAtDistance } from "@/utils/geometry";
import { ENEMY_PATH } from "@/data/mapWhisperingWoods";
import { createEnemyInstance, type EnemyInstance } from "@/entities/Enemy";

let nextBossInstanceId = 1;

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
  const hp = Math.round(bruteBaseline.hp * def.hpMultiplierVsBrute);

  return {
    id: `boss-${nextBossInstanceId++}`,
    type: def.isMainBoss ? "BRUTE" : "SHIELDBEARER",
    hp,
    maxHp: hp,
    baseSpeed: def.speed,
    damageToBase: def.damageToBase,
    goldReward: def.goldReward,
    damageReduction: def.isMainBoss ? 0 : 0.15,
    distanceTraveled: 0,
    position: start.position,
    direction: start.direction,
    slow: null,
    burn: null,
    boss: {
      bossId: def.id,
      name: def.name,
      isMainBoss: def.isMainBoss,
      ability: def.ability,
      abilityIntervalMs: def.abilityIntervalMs,
      baseDamageReduction: def.isMainBoss ? 0 : 0.15,
      shieldUntilMs: null,
      nextAbilityAtMs: nowMs + def.abilityIntervalMs,
    },
  };
}

/**
 * Advances a boss's ability cadence. Returns any enemies the ability
 * summons this tick (empty otherwise) — the caller is responsible for
 * pushing them into the live enemies array, same as any other spawn.
 */
export function tickBossAbilities(
  boss: EnemyInstance,
  nowMs: number,
  waveNumber: number,
): EnemyInstance[] {
  const state = boss.boss;
  if (!state) return [];

  if (state.shieldUntilMs !== null && nowMs >= state.shieldUntilMs) {
    boss.damageReduction = state.baseDamageReduction;
    state.shieldUntilMs = null;
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
    case "NONE":
    default:
      return [];
  }
}
