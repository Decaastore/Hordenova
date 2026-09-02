/**
 * Central data table for every tower type. No tower number should exist
 * anywhere outside this file (runtime scaling formulas live here too now —
 * entities/Tower.ts only forwards into getTowerLevelStats()).
 */

export type TowerType = "IRONWOOD" | "INFERNO" | "FROSTBORN" | "STORMCALLER";

export const TOWER_TYPES: readonly TowerType[] = [
  "IRONWOOD",
  "INFERNO",
  "FROSTBORN",
  "STORMCALLER",
];

/**
 * 30 levels, not 5 — Core Gameplay + Progression spec section 3: upgrades
 * must stay perceptible across a long build-and-strategize loop, not cap out
 * after a handful of clicks. Growth is formula-based (see
 * `levelGrowthMultiplier`) so it scales cleanly to any MAX_TOWER_LEVEL
 * instead of needing a hand-authored table entry per level.
 */
export const MAX_TOWER_LEVEL = 30;

/**
 * Levels at which a tower gets a step-change on top of its normal per-level
 * growth — the spec's "not endless flat +1%/+2%, some levels should feel
 * meaningfully different" requirement. Individual tower types also hang
 * unique behavior unlocks off specific milestones (see
 * `getTowerSpecialAtLevel` — e.g. Ironwood gains a second projectile at
 * level 10).
 */
const MILESTONE_LEVELS: readonly number[] = [5, 10, 15, 20, 25, 30];

function milestonesPassed(level: number): number {
  return MILESTONE_LEVELS.filter((milestone) => level >= milestone).length;
}

/** Smooth per-level growth plus a step bump at each milestone level. */
function levelGrowthMultiplier(level: number): number {
  const smooth = (level - 1) * 0.09;
  const milestoneBump = milestonesPassed(level) * 0.15;
  return 1 + smooth + milestoneBump;
}

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

export type TowerSpecial =
  | ({ type: "IRONWOOD" } & IronwoodSpecial)
  | ({ type: "INFERNO" } & InfernoSpecial)
  | ({ type: "FROSTBORN" } & FrostbornSpecial)
  | ({ type: "STORMCALLER" } & StormcallerSpecial);

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

/** Level-1 baseline for each tower's special behavior — the growth curves in `getTowerSpecialAtLevel` build on these. */
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
  /** Extra targets a single attack cycle can hit beyond the primary target. 1 = no bonus. */
  projectileCount: number;
}

/** Level is 1-indexed (Level 1..MAX_TOWER_LEVEL). */
export function getTowerLevelStats(type: TowerType, level: number): TowerLevelStats {
  const clamped = Math.min(Math.max(level, 1), MAX_TOWER_LEVEL);
  const def = TOWER_DEFINITIONS[type];
  const growth = levelGrowthMultiplier(clamped) - 1;

  // Damage grows fastest, range slowest — keeps "upgrade damage" the
  // headline choice while range/attack-speed still meaningfully improve.
  const damage = def.baseDamage * (1 + growth * 1.35);
  const attackSpeed = def.baseAttackSpeed * (1 + growth * 0.55);
  const range = def.baseRange * (1 + growth * 0.35);

  let projectileCount = 1;
  if (type === "IRONWOOD") {
    if (clamped >= 20) projectileCount = 3;
    else if (clamped >= 10) projectileCount = 2;
  }

  return {
    level: clamped,
    damage: round2(damage),
    attackSpeed: round2(attackSpeed),
    range: round2(range),
    projectileCount,
  };
}

/**
 * Level-scaled special behavior per tower type — the architectural proof
 * that every tower's identity-defining stat (not just the generic
 * damage/speed/range trio) can grow with level. Ironwood already got its
 * new-behavior unlock (projectile count) via `getTowerLevelStats` above;
 * this covers the "identifiable power growth" for its crit stats and for
 * the other three towers' unique mechanics.
 */
export function getTowerSpecialAtLevel(type: TowerType, level: number): TowerSpecial {
  const clamped = Math.min(Math.max(level, 1), MAX_TOWER_LEVEL);
  const milestones = milestonesPassed(clamped);

  switch (type) {
    case "IRONWOOD": {
      const base = TOWER_SPECIALS.IRONWOOD;
      return {
        type: "IRONWOOD",
        critChance: round2(Math.min(0.6, base.critChance + (clamped - 1) * 0.012)),
        critMultiplier: round2(base.critMultiplier + milestones * 0.25),
      };
    }
    case "INFERNO": {
      const base = TOWER_SPECIALS.INFERNO;
      return {
        type: "INFERNO",
        aoeRadius: round2(base.aoeRadius + (clamped - 1) * 1.4 + milestones * 4),
        burnDamagePerSecond: round2(base.burnDamagePerSecond + (clamped - 1) * 0.35),
        burnDurationMs: base.burnDurationMs + milestones * 300,
      };
    }
    case "FROSTBORN": {
      const base = TOWER_SPECIALS.FROSTBORN;
      return {
        type: "FROSTBORN",
        slowPercent: round2(Math.min(0.75, base.slowPercent + (clamped - 1) * 0.01)),
        slowDurationMs: base.slowDurationMs + milestones * 250,
      };
    }
    case "STORMCALLER": {
      const base = TOWER_SPECIALS.STORMCALLER;
      return {
        type: "STORMCALLER",
        chainTargets: base.chainTargets + Math.floor(clamped / 10),
        chainFalloff: Math.min(0.85, base.chainFalloff + milestones * 0.04),
      };
    }
  }
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
