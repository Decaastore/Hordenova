/**
 * Central data table for every tower type. No tower number should exist
 * anywhere outside this file (runtime scaling formulas live in
 * entities/Tower.ts, but the raw values below are the single source of truth).
 */

export type TowerType = "IRONWOOD" | "INFERNO" | "FROSTBORN" | "STORMCALLER";

export const TOWER_TYPES: readonly TowerType[] = [
  "IRONWOOD",
  "INFERNO",
  "FROSTBORN",
  "STORMCALLER",
];

export const MAX_TOWER_LEVEL = 5;

/**
 * Per-level multipliers applied to base stats. Index 0 = Level 1 (100%).
 * Range growth follows the spec's target curve (100/110/120/130/145%).
 */
const RANGE_MULTIPLIERS: readonly number[] = [1.0, 1.1, 1.2, 1.3, 1.45];
const DAMAGE_MULTIPLIERS: readonly number[] = [1.0, 1.25, 1.55, 1.9, 2.3];
const ATTACK_SPEED_MULTIPLIERS: readonly number[] = [1.0, 1.08, 1.16, 1.24, 1.35];

export interface IronwoodSpecial {
  critChance: number; // 0..1
  critMultiplier: number;
}

export interface InfernoSpecial {
  aoeRadius: number;
  burnDamagePerSecond: number;
  burnDurationMs: number;
}

export interface FrostbornSpecial {
  slowPercent: number; // 0..1, fraction of speed removed
  slowDurationMs: number;
}

export interface StormcallerSpecial {
  chainTargets: number; // extra targets hit beyond the primary one
  chainFalloff: number; // damage multiplier applied per chain jump
}

export interface TowerDefinition {
  type: TowerType;
  name: string;
  role: string;
  description: string;
  buildCost: number;
  baseDamage: number;
  baseAttackSpeed: number; // attacks per second
  baseRange: number; // world units
  upgradeCostBase: number;
}

export const TOWER_DEFINITIONS: Record<TowerType, TowerDefinition> = {
  IRONWOOD: {
    type: "IRONWOOD",
    name: "Ironwood",
    role: "Single Target / Critical",
    description: "High single-target damage with a chance to land critical hits.",
    buildCost: 50,
    baseDamage: 18,
    baseAttackSpeed: 1.0,
    baseRange: 150,
    upgradeCostBase: 40,
  },
  INFERNO: {
    type: "INFERNO",
    name: "Inferno",
    role: "Area Damage / Burn",
    description: "Short-to-medium range splash damage that burns everything it hits.",
    buildCost: 60,
    baseDamage: 10,
    baseAttackSpeed: 0.9,
    baseRange: 115,
    upgradeCostBase: 48,
  },
  FROSTBORN: {
    type: "FROSTBORN",
    name: "Frostborn",
    role: "Slow / Crowd Control",
    description: "Moderate damage; every hit slows the target down.",
    buildCost: 55,
    baseDamage: 8,
    baseAttackSpeed: 1.1,
    baseRange: 140,
    upgradeCostBase: 44,
  },
  STORMCALLER: {
    type: "STORMCALLER",
    name: "Stormcaller",
    role: "Long Range / Chain Damage",
    description: "Long range lightning that arcs to nearby enemies; attacks slowly.",
    buildCost: 70,
    baseDamage: 14,
    baseAttackSpeed: 0.6,
    baseRange: 190,
    upgradeCostBase: 56,
  },
};

export const TOWER_SPECIALS: {
  IRONWOOD: IronwoodSpecial;
  INFERNO: InfernoSpecial;
  FROSTBORN: FrostbornSpecial;
  STORMCALLER: StormcallerSpecial;
} = {
  IRONWOOD: { critChance: 0.15, critMultiplier: 2.0 },
  INFERNO: { aoeRadius: 55, burnDamagePerSecond: 3, burnDurationMs: 3000 },
  FROSTBORN: { slowPercent: 0.25, slowDurationMs: 2000 },
  STORMCALLER: { chainTargets: 2, chainFalloff: 0.5 },
};

export interface TowerLevelStats {
  level: number;
  damage: number;
  attackSpeed: number;
  range: number;
}

/** Level is 1-indexed (Level 1..MAX_TOWER_LEVEL). */
export function getTowerLevelStats(type: TowerType, level: number): TowerLevelStats {
  const clamped = Math.min(Math.max(level, 1), MAX_TOWER_LEVEL);
  const index = clamped - 1;
  const def = TOWER_DEFINITIONS[type];
  return {
    level: clamped,
    damage: round2(def.baseDamage * (DAMAGE_MULTIPLIERS[index] ?? 1)),
    attackSpeed: round2(def.baseAttackSpeed * (ATTACK_SPEED_MULTIPLIERS[index] ?? 1)),
    range: round2(def.baseRange * (RANGE_MULTIPLIERS[index] ?? 1)),
  };
}

/** Gold cost to go from `currentLevel` to `currentLevel + 1`. Returns null at max level. */
export function getUpgradeCost(type: TowerType, currentLevel: number): number | null {
  if (currentLevel >= MAX_TOWER_LEVEL) return null;
  const def = TOWER_DEFINITIONS[type];
  const targetLevel = currentLevel + 1;
  return Math.round(def.upgradeCostBase * targetLevel * 0.75);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
