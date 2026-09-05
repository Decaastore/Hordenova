import type { TowerSpecial, TowerType } from "./towerStats";
import { TOWER_DEFINITIONS } from "./towerStats";

/**
 * Progression 2.0 — Specialization / Upgrade Slot architecture (spec
 * section 5/6). This is the fix for the root cause behind "reaches phase 46
 * in 20 minutes": MAX_TOWER_LEVEL=30 (config/towerStats.ts) is a FINITE
 * gold sink — once a tower is maxed there is nothing further to spend gold
 * on, so a build "finishes" fast and coasts through phases on nothing but
 * raw enemy-scaling friction.
 *
 * LEVEL (towerStats.ts) stays pure growth: damage/attack-speed/range climb
 * smoothly and automatically, exactly as before — nothing here changes that
 * curve or any level-driven milestone unlock (multiShot/giantSlayer/
 * wildfire/deepFreeze/arcaneSurge/etc. all keep working unmodified).
 *
 * SPECIALIZATION is a separate, optional, player-CHOSEN identity slot:
 * once a tower reaches SPECIALIZATION_UNLOCK_TOWER_LEVEL, the player picks
 * exactly one of that tower's paths (permanent for that tower instance —
 * a real, mutually-exclusive decision, not a toggle) and can then invest
 * gold into it independently of the tower's own level, each level buying a
 * real behavior bonus (see `applySpecializationToSpecial`). This is what
 * gives a maxed-level build genuine, ongoing decisions and a genuine,
 * ongoing gold sink past level 30.
 *
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — GOLD NEVER RUNS OUT OF A
 * SINK, BUT POWER STAYS BOUNDED: this used to hard-stop at
 * MAX_SPECIALIZATION_LEVEL=5 (getSpecializationUpgradeCost returned null),
 * which is exactly why Gold went dry once every tower was fully built —
 * Tower Level tops out at 30 (kept as-is, intentionally NOT rebuilt in this
 * pass) and Specialization was the only other Gold sink, itself capped.
 *
 * The fix is deliberately NOT "uncap the level AND let its combat effect
 * keep growing forever" — that would just trade one problem (Gold with no
 * sink) for a worse one (`Gold -> infinite Specialization Level -> infinite
 * DPS`). Instead the level (`specializationLevel`) and its COMBAT EFFECT are
 * split: the level itself is now genuinely uncapped (getSpecializationUpgradeCost
 * always returns a finite cost — see its own doc comment for the overflow-safe
 * curve, the same compound-cap-plus-linear-tail pattern already used by
 * towerMastery.ts/prestige.ts/enemyStats.ts), so Gold always has somewhere
 * to go no matter how long a Season runs. But `applySpecializationToSpecial`
 * clamps the level it actually reads to SPECIALIZATION_EFFECT_LEVEL_CAP (see
 * that constant) — so the COMBAT BONUS stops growing at exactly the same
 * point it always did (level 5, preserving all existing balance/tuning),
 * regardless of how many levels past that a player's Gold has bought.
 * "Level can keep growing forever; effective power cannot."
 *
 * Each tower ships 3 of the 4 example paths named in the spec (a
 * deliberately-scoped subset, not the full catalog) — the architecture
 * (one more entry in SPECIALIZATIONS_BY_TOWER + one more case in
 * `applySpecializationToSpecial`) supports adding a 4th, or a 5th, later
 * without touching CombatSystem.ts's call site.
 */

export type SpecializationId =
  | "IRONWOOD_EXECUTIONER"
  | "IRONWOOD_BREAKER"
  | "IRONWOOD_VANGUARD"
  | "INFERNO_WILDFIRE"
  | "INFERNO_CORE"
  | "INFERNO_DETONATOR"
  | "FROSTBORN_DEEP_FREEZE"
  | "FROSTBORN_PERMAFROST"
  | "FROSTBORN_SHATTER"
  | "STORMCALLER_CHAINBREAKER"
  | "STORMCALLER_ARCANE_SURGE"
  | "STORMCALLER_STORMLORD";

/**
 * The specializationLevel at which `applySpecializationToSpecial`'s combat
 * bonus stops growing — the SOFT CAP ON POWER (see this file's top doc
 * comment). `specializationLevel` itself has no such cap: a tower can keep
 * being leveled past this forever as a pure, always-available Gold sink,
 * it just stops making the tower any stronger once its effect reaches this
 * point. This exact value (5) is unchanged from the tuning this system
 * shipped with, so every existing balance number for a "fully specialized"
 * tower stays identical to before this correction.
 */
export const SPECIALIZATION_EFFECT_LEVEL_CAP = 5;
export const SPECIALIZATION_UNLOCK_TOWER_LEVEL = 10;

/**
 * Visual Overhaul spec section 21/22: specialization is a strategic
 * decision Gems can unlock, not a stat Gems can buy. The CHOICE of a path
 * (null -> level 1) now costs this flat Gem amount instead of Gold —
 * every LEVEL of that path after the choice (1->2, ..., 4->5) stays on
 * Gold via getSpecializationUpgradeCost below, unchanged. A flat cost
 * (not scaled by tower level/type) keeps this one clear "premium
 * decision" price rather than inventing a second gold-shaped curve in
 * Gems; tuned against the existing Gem-Shard drop rates (main boss 5,
 * mini-boss 2, milestone wave ~1-3, 10 shards/Gem) so a single
 * specialization unlock is a genuine mid-game goal, not an instant spend.
 */
export const SPECIALIZATION_UNLOCK_GEM_COST = 25;

export interface SpecializationDefinition {
  id: SpecializationId;
  towerType: TowerType;
  /** i18n key: towerInfo.specializations.<id>.name / .description */
  i18nKey: string;
}

export const SPECIALIZATIONS_BY_TOWER: Record<TowerType, readonly SpecializationDefinition[]> = {
  IRONWOOD: [
    { id: "IRONWOOD_EXECUTIONER", towerType: "IRONWOOD", i18nKey: "IRONWOOD_EXECUTIONER" },
    { id: "IRONWOOD_BREAKER", towerType: "IRONWOOD", i18nKey: "IRONWOOD_BREAKER" },
    { id: "IRONWOOD_VANGUARD", towerType: "IRONWOOD", i18nKey: "IRONWOOD_VANGUARD" },
  ],
  INFERNO: [
    { id: "INFERNO_WILDFIRE", towerType: "INFERNO", i18nKey: "INFERNO_WILDFIRE" },
    { id: "INFERNO_CORE", towerType: "INFERNO", i18nKey: "INFERNO_CORE" },
    { id: "INFERNO_DETONATOR", towerType: "INFERNO", i18nKey: "INFERNO_DETONATOR" },
  ],
  FROSTBORN: [
    { id: "FROSTBORN_DEEP_FREEZE", towerType: "FROSTBORN", i18nKey: "FROSTBORN_DEEP_FREEZE" },
    { id: "FROSTBORN_PERMAFROST", towerType: "FROSTBORN", i18nKey: "FROSTBORN_PERMAFROST" },
    { id: "FROSTBORN_SHATTER", towerType: "FROSTBORN", i18nKey: "FROSTBORN_SHATTER" },
  ],
  STORMCALLER: [
    { id: "STORMCALLER_CHAINBREAKER", towerType: "STORMCALLER", i18nKey: "STORMCALLER_CHAINBREAKER" },
    { id: "STORMCALLER_ARCANE_SURGE", towerType: "STORMCALLER", i18nKey: "STORMCALLER_ARCANE_SURGE" },
    { id: "STORMCALLER_STORMLORD", towerType: "STORMCALLER", i18nKey: "STORMCALLER_STORMLORD" },
  ],
};

const ALL_SPECIALIZATIONS: ReadonlyMap<SpecializationId, SpecializationDefinition> = new Map(
  Object.values(SPECIALIZATIONS_BY_TOWER)
    .flat()
    .map((def) => [def.id, def]),
);

export function getSpecializationsForTower(type: TowerType): readonly SpecializationDefinition[] {
  return SPECIALIZATIONS_BY_TOWER[type];
}

export function getSpecializationDefinition(id: SpecializationId): SpecializationDefinition {
  const def = ALL_SPECIALIZATIONS.get(id);
  if (!def) throw new Error(`Unknown specialization id: ${id}`);
  return def;
}

export function isSpecializationForTower(id: SpecializationId, type: TowerType): boolean {
  return getSpecializationDefinition(id).towerType === type;
}

/** Original tuned linear rate for levels up to SPECIALIZATION_EFFECT_LEVEL_CAP — UNCHANGED so every existing balance number up to a "fully specialized" tower stays identical. */
const SPECIALIZATION_LINEAR_COST_MULTIPLIER = 7;
/**
 * Beyond SPECIALIZATION_EFFECT_LEVEL_CAP, cost keeps growing forever via the
 * exact same overflow-safety pattern as towerMastery.ts/prestige.ts/
 * enemyStats.ts (compounding growth capped at a very high level index, pure
 * linear tail beyond that) — genuinely uncapped, never Infinity/NaN, at any
 * specialization level a save could ever reach. Calibrated against
 * engine/ProgressionSimulation.test.ts's real-engine bot simulation, not
 * guessed.
 */
const SPECIALIZATION_COST_GROWTH_FACTOR = 1.05;
const SPECIALIZATION_COST_COMPOUND_LEVEL_CAP = 2000;
const SPECIALIZATION_COST_LINEAR_TAIL_GROWTH = 0.5;

/**
 * Gold cost to raise a specialization from `currentSpecLevel` to
 * `currentSpecLevel + 1` (0 -> 1 is the initial "choose this path" cost).
 * Deliberately steep relative to a normal level-up (base tower level costs
 * top out around upgradeCostBase * 30 * 0.75) — this is the long-tail sink
 * meant to matter well past level 30.
 *
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — never returns null anymore:
 * this level track is now genuinely uncapped (Gold must always have
 * somewhere to go — see hasUncappedGoldSink in goldSinks.ts), it's the
 * combat EFFECT that stops growing past SPECIALIZATION_EFFECT_LEVEL_CAP,
 * not the ability to keep buying levels (see applySpecializationToSpecial
 * and this file's top doc comment). Levels within the original tuned range
 * keep the EXACT original linear formula (byte-for-byte unchanged); only
 * levels beyond it switch to the convex, overflow-safe curve.
 */
export function getSpecializationUpgradeCost(type: TowerType, currentSpecLevel: number): number {
  const def = TOWER_DEFINITIONS[type];
  const targetLevel = currentSpecLevel + 1;

  if (targetLevel <= SPECIALIZATION_EFFECT_LEVEL_CAP) {
    return Math.round(def.upgradeCostBase * SPECIALIZATION_LINEAR_COST_MULTIPLIER * targetLevel);
  }

  const costAtCap = def.upgradeCostBase * SPECIALIZATION_LINEAR_COST_MULTIPLIER * SPECIALIZATION_EFFECT_LEVEL_CAP;
  const levelsBeyondCap = targetLevel - SPECIALIZATION_EFFECT_LEVEL_CAP;
  const cappedLevels = Math.min(levelsBeyondCap, SPECIALIZATION_COST_COMPOUND_LEVEL_CAP);
  const compound = Math.pow(SPECIALIZATION_COST_GROWTH_FACTOR, cappedLevels);
  const tailLevels = Math.max(0, levelsBeyondCap - SPECIALIZATION_COST_COMPOUND_LEVEL_CAP);
  const linearTail = 1 + tailLevels * SPECIALIZATION_COST_LINEAR_TAIL_GROWTH;
  return Math.round(costAtCap * compound * linearTail);
}

/**
 * Layers a chosen specialization's bonuses on top of the level-driven
 * baseline from `getTowerSpecialAtLevel`. Returns `base` unchanged when no
 * specialization is chosen (specializationLevel 0) — every existing call
 * site's behavior is bit-for-bit identical until a player actually picks a
 * path, so nothing that already worked changes on its own.
 */
export function applySpecializationToSpecial(
  base: TowerSpecial,
  specializationId: SpecializationId | null,
  specializationLevel: number,
): TowerSpecial {
  if (!specializationId || specializationLevel <= 0) return base;
  // CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — THE soft cap on power:
  // specializationLevel itself is uncapped (see getSpecializationUpgradeCost),
  // but the level actually read by every branch below never exceeds this,
  // so no branch's combat bonus can ever grow past what level 5 always gave.
  const lvl = Math.min(specializationLevel, SPECIALIZATION_EFFECT_LEVEL_CAP);

  switch (specializationId) {
    case "IRONWOOD_EXECUTIONER": {
      const b = base as Extract<TowerSpecial, { type: "IRONWOOD" }>;
      return {
        ...b,
        critMultiplier: round2(b.critMultiplier + lvl * 0.15),
        bossDamageMultiplier: round2((b.bossDamageMultiplier || 1) + lvl * 0.1),
      };
    }
    case "IRONWOOD_BREAKER": {
      const b = base as Extract<TowerSpecial, { type: "IRONWOOD" }>;
      return { ...b, bonusArmorPenetration: round2(lvl * 0.1) };
    }
    case "IRONWOOD_VANGUARD": {
      const b = base as Extract<TowerSpecial, { type: "IRONWOOD" }>;
      return {
        ...b,
        critChance: round2(Math.min(0.75, b.critChance + lvl * 0.02)),
        bonusProjectiles: lvl >= 3 ? 1 : 0,
      };
    }
    case "INFERNO_WILDFIRE": {
      const b = base as Extract<TowerSpecial, { type: "INFERNO" }>;
      return {
        ...b,
        burnDamagePerSecond: round2(b.burnDamagePerSecond * (1 + lvl * 0.15)),
        burnMaxStacks: lvl >= 4 ? b.burnMaxStacks + 1 : b.burnMaxStacks,
      };
    }
    case "INFERNO_CORE": {
      const b = base as Extract<TowerSpecial, { type: "INFERNO" }>;
      return { ...b, aoeRadius: round2(b.aoeRadius * (1 + lvl * 0.1)) };
    }
    case "INFERNO_DETONATOR": {
      const b = base as Extract<TowerSpecial, { type: "INFERNO" }>;
      return { ...b, burningComboDamageMultiplier: round2(lvl * 0.18) };
    }
    case "FROSTBORN_DEEP_FREEZE": {
      const b = base as Extract<TowerSpecial, { type: "FROSTBORN" }>;
      return {
        ...b,
        freezeChance: round2(Math.min(0.7, b.freezeChance + lvl * 0.05)),
        freezeDurationMs: b.freezeDurationMs + lvl * 150,
      };
    }
    case "FROSTBORN_PERMAFROST": {
      const b = base as Extract<TowerSpecial, { type: "FROSTBORN" }>;
      return {
        ...b,
        slowPercent: round2(Math.min(0.85, b.slowPercent + lvl * 0.03)),
        slowDurationMs: b.slowDurationMs + lvl * 200,
      };
    }
    case "FROSTBORN_SHATTER": {
      const b = base as Extract<TowerSpecial, { type: "FROSTBORN" }>;
      return { ...b, frozenBonusDamageMultiplier: round2(lvl * 0.1) };
    }
    case "STORMCALLER_CHAINBREAKER": {
      const b = base as Extract<TowerSpecial, { type: "STORMCALLER" }>;
      return {
        ...b,
        chainTargets: lvl >= 3 ? b.chainTargets + 1 : b.chainTargets,
        chainFalloff: round2(Math.min(0.92, b.chainFalloff + lvl * 0.03)),
      };
    }
    case "STORMCALLER_ARCANE_SURGE": {
      const b = base as Extract<TowerSpecial, { type: "STORMCALLER" }>;
      return { ...b, bonusFlatDamage: round2(lvl * 2) };
    }
    case "STORMCALLER_STORMLORD": {
      const b = base as Extract<TowerSpecial, { type: "STORMCALLER" }>;
      return { ...b, armorPenetration: round2(Math.min(0.9, b.armorPenetration + lvl * 0.06)) };
    }
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
