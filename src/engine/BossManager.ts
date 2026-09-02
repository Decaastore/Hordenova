import type { BossDefinition } from "@/config/bossConfig";
import { getScaledEnemyStats } from "@/config/enemyStats";
import { getPointAtDistance } from "@/utils/geometry";
import { ENEMY_PATH } from "@/data/mapWhisperingWoods";
import { createEnemyInstance, type EnemyInstance } from "@/entities/Enemy";

let nextBossInstanceId = 1;

/** Below this HP fraction, a boss enrages once — see tickBossAbilities. */
const ENRAGE_HP_THRESHOLD = 0.3;
const ENRAGE_SPEED_MULTIPLIER = 1.4;
const ENRAGE_ABILITY_INTERVAL_MULTIPLIER = 0.5;

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
      enraged: false,
    },
  };
}

/**
 * Advances a boss's ability cadence. Returns any enemies the ability
 * summons this tick (empty otherwise) — the caller is responsible for
 * pushing them into the live enemies array, same as any other spawn.
 *
 * Also handles Enrage (spec section 9 — a boss fight needs to escalate,
 * not just be a bigger HP bar): the first time a MAIN boss drops below
 * ENRAGE_HP_THRESHOLD, it permanently speeds up and starts using its
 * ability roughly twice as often. Mini-bosses don't enrage — the ceremony
 * (and the extra pressure) is reserved for the real event.
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

  if (state.isMainBoss && !state.enraged && boss.maxHp > 0 && boss.hp / boss.maxHp <= ENRAGE_HP_THRESHOLD) {
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
    case "NONE":
    default:
      return [];
  }
}
