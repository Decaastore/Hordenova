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
 * `getTowerSpecialAtLevel` and `MILESTONE_UNLOCKS` below — e.g. Ironwood
 * gains a second projectile at level 10).
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
  /** Extra multiplier applied only when the target is a boss/mini-boss. 1 = no bonus. Unlocks at level 15 ("Giant Slayer"). */
  bossDamageMultiplier: number;
  /** Specialization-only bonus (Progression 2.0 — see config/specializations.ts): extra targets on top of the level-driven projectileCount. 0 when no specialization is chosen. */
  bonusProjectiles?: number;
  /** Specialization-only bonus: additional armor-penetration fraction applied to every hit. 0 when no specialization is chosen. */
  bonusArmorPenetration?: number;
}

export interface InfernoSpecial {
  aoeRadius: number;
  burnDamagePerSecond: number;
  burnDurationMs: number;
  /** How many overlapping burn applications can stack their DPS on the same target. 1 = no stacking. Unlocks at level 10 ("Wildfire"). */
  burnMaxStacks: number;
  /** Specialization-only bonus: extra damage multiplier applied to a hit landing on an already-burning target ("Detonator" path). 0 when no specialization is chosen. */
  burningComboDamageMultiplier?: number;
}

export interface FrostbornSpecial {
  slowPercent: number; // 0..1, fraction of speed removed
  slowDurationMs: number;
  /** Chance per hit to fully stop the target (a slow of 100%) instead of the normal partial slow. 0 = never. Unlocks at level 10 ("Deep Freeze"). */
  freezeChance: number;
  freezeDurationMs: number;
  /** Specialization-only bonus: extra damage multiplier applied to a hit landing on a fully-frozen target ("Shatter" path). 0 when no specialization is chosen. */
  frozenBonusDamageMultiplier?: number;
}

export interface StormcallerSpecial {
  chainTargets: number; // extra targets hit beyond the primary one
  chainFalloff: number; // damage multiplier applied per chain jump
  /** Fraction of the target's damage reduction ignored on every hit. 0 = none. Unlocks at level 10 ("Arcane Surge") — Stormcaller's answer to armored enemies. */
  armorPenetration: number;
  /** Specialization-only bonus: flat magic damage added to every hit ("Arcane Surge" specialization path). 0 when no specialization is chosen. */
  bonusFlatDamage?: number;
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
    role: "Single Target / Critical / Boss Damage",
    description: "High single-target burst with a chance to crit. Gains extra projectiles and a bonus vs bosses as it levels — the tower to lean on when a boss just won't die.",
    buildCost: 50,
    baseDamage: 18,
    baseAttackSpeed: 1.0,
    baseRange: 150,
    upgradeCostBase: 40,
  },
  INFERNO: {
    type: "INFERNO",
    name: "Inferno",
    role: "Area Damage / Sustained Burn",
    description: "Splash damage that ignites everything it hits. Burn stacks at higher levels, turning a crowded lane into a sustained damage field — built for when too many enemies pile up at once.",
    buildCost: 60,
    baseDamage: 10,
    baseAttackSpeed: 0.9,
    baseRange: 115,
    upgradeCostBase: 48,
  },
  FROSTBORN: {
    type: "FROSTBORN",
    name: "Frostborn",
    role: "Slow / Crowd Control / Freeze",
    description: "Every hit slows its target, and higher levels add a chance to freeze it solid. The answer when fast enemies keep slipping past before your other towers can finish them.",
    buildCost: 55,
    baseDamage: 8,
    baseAttackSpeed: 1.1,
    baseRange: 140,
    upgradeCostBase: 44,
  },
  STORMCALLER: {
    type: "STORMCALLER",
    name: "Stormcaller",
    role: "Magic / Chain Damage / Armor Penetration",
    description: "Long-range arcane lightning that arcs between enemies and, at higher levels, tears straight through armor. The tower that keeps working when heavily armored enemies shrug off everything else.",
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
  IRONWOOD: { critChance: 0.15, critMultiplier: 2.0, bossDamageMultiplier: 1 },
  INFERNO: { aoeRadius: 55, burnDamagePerSecond: 3, burnDurationMs: 3000, burnMaxStacks: 1 },
  FROSTBORN: { slowPercent: 0.25, slowDurationMs: 2000, freezeChance: 0, freezeDurationMs: 900 },
  STORMCALLER: { chainTargets: 2, chainFalloff: 0.5, armorPenetration: 0 },
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
 * damage/speed/range trio) can grow with level, AND that towers diverge
 * from each other rather than just getting bigger versions of the same
 * numbers. Each tower gets one real new behavior unlocked at level 10 (see
 * `MILESTONE_UNLOCKS` below for the matching UI callout), which is what
 * actually makes a build decision matter — not just "which tower has the
 * biggest number."
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
        // "Giant Slayer" — unlocks at 15, scales further at 25 (both milestone levels).
        bossDamageMultiplier: clamped >= 15 ? round2(1.25 + (clamped >= 25 ? 0.25 : 0)) : 1,
      };
    }
    case "INFERNO": {
      const base = TOWER_SPECIALS.INFERNO;
      return {
        type: "INFERNO",
        aoeRadius: round2(base.aoeRadius + (clamped - 1) * 1.4 + milestones * 4),
        burnDamagePerSecond: round2(base.burnDamagePerSecond + (clamped - 1) * 0.35),
        burnDurationMs: base.burnDurationMs + milestones * 300,
        // "Wildfire" — burn starts stacking at 10, a third stack unlocks at 20.
        burnMaxStacks: clamped >= 20 ? 3 : clamped >= 10 ? 2 : 1,
      };
    }
    case "FROSTBORN": {
      const base = TOWER_SPECIALS.FROSTBORN;
      // "Deep Freeze" — a genuine full-stop proc unlocks at 10, "Permafrost" raises its odds at 20.
      const freezeChance = clamped >= 20 ? 0.3 : clamped >= 10 ? 0.15 : 0;
      return {
        type: "FROSTBORN",
        slowPercent: round2(Math.min(0.75, base.slowPercent + (clamped - 1) * 0.01)),
        slowDurationMs: base.slowDurationMs + milestones * 250,
        freezeChance,
        freezeDurationMs: base.freezeDurationMs + (clamped >= 20 ? 400 : 0),
      };
    }
    case "STORMCALLER": {
      const base = TOWER_SPECIALS.STORMCALLER;
      // "Arcane Surge" — armor penetration unlocks at 10, "Storm Breaker" raises it further at 20.
      const armorPenetration = clamped >= 20 ? 0.55 : clamped >= 10 ? 0.3 : 0;
      return {
        type: "STORMCALLER",
        chainTargets: base.chainTargets + Math.floor(clamped / 10),
        chainFalloff: Math.min(0.85, base.chainFalloff + milestones * 0.04),
        armorPenetration,
      };
    }
  }
}

export interface TowerMilestoneUnlock {
  level: number;
  /** i18n key under towerInfo.unlocks.<key>.name / .description */
  key: TowerMilestoneUnlockKey;
}

export type TowerMilestoneUnlockKey =
  | "multiShot"
  | "giantSlayer"
  | "tripleShot"
  | "wildfire"
  | "infernoCore"
  | "deepFreeze"
  | "permafrost"
  | "arcaneSurge"
  | "stormBreaker";

/**
 * Named behavior unlocks shown in the upgrade UI ("LEVEL 10 UNLOCK:
 * MULTI-SHOT") so a milestone reads as a real event, not just a bigger
 * number — spec section 7. Purely descriptive metadata; the actual
 * mechanics live in `getTowerLevelStats`/`getTowerSpecialAtLevel` above.
 */
const MILESTONE_UNLOCKS: Record<TowerType, TowerMilestoneUnlock[]> = {
  IRONWOOD: [
    { level: 10, key: "multiShot" },
    { level: 15, key: "giantSlayer" },
    { level: 20, key: "tripleShot" },
  ],
  INFERNO: [
    { level: 10, key: "wildfire" },
    { level: 20, key: "infernoCore" },
  ],
  FROSTBORN: [
    { level: 10, key: "deepFreeze" },
    { level: 20, key: "permafrost" },
  ],
  STORMCALLER: [
    { level: 10, key: "arcaneSurge" },
    { level: 20, key: "stormBreaker" },
  ],
};

/** Returns the named unlock landing exactly at `level` for this tower type, or null if that level is a plain numeric upgrade. */
export function getMilestoneUnlockForLevel(type: TowerType, level: number): TowerMilestoneUnlock | null {
  return MILESTONE_UNLOCKS[type].find((unlock) => unlock.level === level) ?? null;
}

/**
 * Gold cost to go from `currentLevel` to `currentLevel + 1`. Returns null at
 * max level.
 *
 * ECONOMY AUDIT (Master Implementation spec section 42/43): the flat linear
 * `targetLevel * 0.75` term let a greedy always-spend player fully max ALL
 * 12 tower slots (level 30) in ~5 SIMULATED hours of Active Idle play,
 * after which gold had no sink left at all — the enemy HP wall doesn't
 * bite until ~wave 330-390, so the player was left with 40+ hours of gold
 * piling up uselessly (empirically over 1.7M gold sitting idle by the
 * 48-hour mark) before the wall gave them anything to do again. That is
 * the actual reported symptom ("wave 160 by day 2, gold feels too fast"),
 * not the wave count itself — the wave-vs-time curve near the wall is
 * within the documented ~450-460 design target.
 *
 * Fix: a convex `lateGameFactor` that stays ~1x for early levels (so a
 * fresh build still feels responsive) and grows the cost of LATE levels
 * (20-30) steeply, stretching the spending phase to better overlap with
 * when the HP wall actually starts to matter, without touching the HP/gold
 * scaling formulas in enemyStats.ts or inventing a second currency.
 */
export function getUpgradeCost(type: TowerType, currentLevel: number): number | null {
  if (currentLevel >= MAX_TOWER_LEVEL) return null;
  const def = TOWER_DEFINITIONS[type];
  const targetLevel = currentLevel + 1;
  const lateGameFactor = 1 + currentLevel * 0.35;
  return Math.round(def.upgradeCostBase * targetLevel * 0.75 * lateGameFactor);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Tower Visual Evolution (spec section 9) — how many levels each stage
 * spans. A tower's structure gains new physical parts at each boundary
 * (see rendering/EntityRenderer.ts's stage-gated draw additions), not just
 * a bigger scale. Six stages across 30 levels mirrors the spec's own
 * example brackets (1-5/6-10/11-15/16-20/21-25/26-30).
 */
const VISUAL_STAGE_LEVEL_SPAN = 5;
export const TOWER_VISUAL_STAGE_COUNT = Math.ceil(MAX_TOWER_LEVEL / VISUAL_STAGE_LEVEL_SPAN);

/** Level 1..MAX_TOWER_LEVEL -> visual stage 1..TOWER_VISUAL_STAGE_COUNT. Pure function of level, so rendering never needs anything beyond TowerInstance.level to pick a stage. */
export function getTowerVisualStage(level: number): number {
  const clamped = Math.min(Math.max(level, 1), MAX_TOWER_LEVEL);
  return Math.min(TOWER_VISUAL_STAGE_COUNT, Math.ceil(clamped / VISUAL_STAGE_LEVEL_SPAN));
}
