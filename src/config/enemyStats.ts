/**
 * Central data table for every enemy type. Wave-to-wave scaling formula
 * lives here too, so no wave-difficulty number is hidden inside the engine.
 */

export type EnemyType = "CRAWLER" | "RUNNER" | "BRUTE" | "SHIELDBEARER";

export const ENEMY_TYPES: readonly EnemyType[] = [
  "CRAWLER",
  "RUNNER",
  "BRUTE",
  "SHIELDBEARER",
];

export interface EnemyDefinition {
  type: EnemyType;
  name: string;
  role: string;
  baseHp: number;
  /** World units per second. */
  baseSpeed: number;
  /** Damage dealt to the base if this enemy reaches the end of the path. */
  baseDamageToBase: number;
  /** Gold granted to the player when killed. */
  goldReward: number;
  /** Flat fraction of incoming damage ignored (0..1). 0 for most enemies. */
  damageReduction: number;
}

export const ENEMY_DEFINITIONS: Record<EnemyType, EnemyDefinition> = {
  CRAWLER: {
    type: "CRAWLER",
    name: "Crawler",
    role: "Basic enemy, balanced stats.",
    baseHp: 40,
    baseSpeed: 60,
    baseDamageToBase: 5,
    goldReward: 5,
    damageReduction: 0,
  },
  RUNNER: {
    type: "RUNNER",
    name: "Runner",
    role: "Very fast, low HP. Pressures slow-firing towers.",
    baseHp: 20,
    baseSpeed: 130,
    baseDamageToBase: 3,
    goldReward: 4,
    damageReduction: 0,
  },
  BRUTE: {
    type: "BRUTE",
    name: "Brute",
    role: "High HP, slow. Tests sustained DPS.",
    baseHp: 220,
    baseSpeed: 32,
    baseDamageToBase: 15,
    goldReward: 12,
    damageReduction: 0,
  },
  SHIELDBEARER: {
    type: "SHIELDBEARER",
    name: "Shieldbearer",
    role: "Reduces incoming damage. Forces tower-composition decisions.",
    baseHp: 70,
    baseSpeed: 48,
    baseDamageToBase: 8,
    goldReward: 8,
    damageReduction: 0.35,
  },
};

/** Growth applied per wave number to HP only — enemies get tougher, not just more numerous. */
const HP_GROWTH_PER_WAVE = 0.06;
/** Small reward growth so later waves stay worth playing. */
const GOLD_GROWTH_PER_WAVE = 0.03;

export interface ScaledEnemyStats {
  hp: number;
  speed: number;
  damageToBase: number;
  goldReward: number;
  damageReduction: number;
}

export function getScaledEnemyStats(type: EnemyType, waveNumber: number): ScaledEnemyStats {
  const def = ENEMY_DEFINITIONS[type];
  const waveIndex = Math.max(waveNumber - 1, 0);
  const hpMultiplier = 1 + waveIndex * HP_GROWTH_PER_WAVE;
  const goldMultiplier = 1 + waveIndex * GOLD_GROWTH_PER_WAVE;
  return {
    hp: Math.round(def.baseHp * hpMultiplier),
    speed: def.baseSpeed,
    damageToBase: def.baseDamageToBase,
    goldReward: Math.round(def.goldReward * goldMultiplier),
    damageReduction: def.damageReduction,
  };
}
