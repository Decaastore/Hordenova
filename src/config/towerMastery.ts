import { TOWER_DEFINITIONS, type TowerType } from "./towerStats";

/**
 * Master Implementation Pass spec sections 3-6 — TOWER MASTERY: the sink
 * that exists past MAX_TOWER_LEVEL (30). Level 30 stays the last
 * VISUAL evolution and the last step of the existing level-driven special
 * unlocks (multiShot/giantSlayer/wildfire/deepFreeze/arcaneSurge/etc, all
 * in towerStats.ts, all untouched) — Mastery is a SEPARATE, uncapped track
 * layered on top, exactly mirroring how config/specializations.ts already
 * layers an independent, optional gold-sink track next to level (same
 * "LEVEL stays pure growth, a second track buys real bonuses" shape), just
 * without that track's MAX_SPECIALIZATION_LEVEL cap.
 *
 * DESIGN DECISION — what Mastery actually buys: spec section 4 lists many
 * POSSIBLE small bonuses (damage/attack-speed/survival/ability/range/
 * efficiency) and explicitly warns against turning Mastery into "absurd
 * DPS" or a universal solution. Rather than threading a mastery bonus
 * through each tower's own special-ability formula (10+ separate call
 * sites across CombatSystem.ts, each risking quietly eroding that tower's
 * identity), Mastery applies ONE small, uniform, tower-agnostic power
 * multiplier (damage/attack-speed/range) through the exact same choke
 * point every combat call site already reads tower stats from
 * (entities/Tower.ts's getTowerStats) — see that file's own comment. Every
 * tower's IDENTITY still comes entirely from its level-scaled special
 * (crit/boss-damage, burn/AoE, slow/freeze, chain/armor-pen), which Mastery
 * never touches — a maxed Ironwood with 200 mastery levels is still
 * unambiguously the crit/boss-damage tower, just incrementally stronger
 * everywhere, exactly as the spec asks for ("incremental e controlado").
 *
 * SAFETY: cost curve is convex (spec section 5: "não permitir comprar
 * milhares instantaneamente") but uses the exact same overflow-safety
 * pattern as enemyStats.ts's HP scaling (compounding capped at a very high
 * level index, linear tail beyond it) — genuinely uncapped, never
 * Infinity/NaN, at any mastery level a save could ever reach. Calibrated
 * via engine/ProgressionSimulation.test.ts's real-engine bot simulation,
 * not guessed (spec section 5's own instruction).
 *
 * CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE) — CURRENCY CHANGED, CURVE
 * RE-CALIBRATED: Mastery moved from Gold to Gems (see gemSinks.ts), and
 * MASTERY_BASE_COST_MULTIPLIER was rescaled down from its old Gold-shaped
 * value (240) to a Gems-appropriate one — Gems and Gold are wildly
 * different orders of magnitude in this economy (a Specialization unlock
 * is a flat 25 Gems; Profile Prestige starts at 3 Gems), and Gem Shards
 * only trickle in from boss/mini-boss kills (5/2 shards, 10 shards = 1 Gem
 * — see GameEngine's addGemShards call sites). Reusing the old Gold-scaled
 * multiplier verbatim (as a naive "just swap the currency" change would)
 * made even Mastery's FIRST level cost ~10,000 Gems — realistically
 * unreachable, which engine/ProgressionSimulation.test.ts's real 48-simulated-
 * hour bot run caught directly (avgMasteryLevel stayed exactly 0). This
 * value was re-tuned against that same test until Mastery became a
 * genuinely reachable-but-meaningful Gems sink again — first level costs
 * on the order of a Specialization unlock, growing from there.
 */

/** Bonus multiplier growth per mastery level — small and linear, so DPS growth stays "controlado" and its real pacing comes from the cost curve below, not a bonus-side diminishing-returns curve. */
const MASTERY_DAMAGE_PER_LEVEL = 0.004; // +0.4% damage per level
const MASTERY_ATTACK_SPEED_PER_LEVEL = 0.002; // +0.2% attack speed per level
const MASTERY_RANGE_PER_LEVEL = 0.001; // +0.1% range per level

export interface MasteryBonusMultipliers {
  damage: number;
  attackSpeed: number;
  range: number;
}

/** Pure multipliers (1.0 = no change) for a given mastery level — entities/Tower.ts's getTowerStats applies these on top of the level-based TowerLevelStats. */
export function getMasteryBonusMultipliers(masteryLevel: number): MasteryBonusMultipliers {
  return {
    damage: 1 + masteryLevel * MASTERY_DAMAGE_PER_LEVEL,
    attackSpeed: 1 + masteryLevel * MASTERY_ATTACK_SPEED_PER_LEVEL,
    range: 1 + masteryLevel * MASTERY_RANGE_PER_LEVEL,
  };
}

const MASTERY_BASE_COST_MULTIPLIER = 0.5;
const MASTERY_COST_GROWTH_FACTOR = 1.05;
/** Numerical safety (same technique as enemyStats.ts HP\_COMPOUND_WAVE_INDEX_CAP): compounding growth stops accelerating beyond this mastery level, but cost keeps climbing forever via the linear tail below — never Infinity/NaN at any mastery level, "SEM CAP REAL" on progression while staying finite. */
const MASTERY_COST_COMPOUND_LEVEL_CAP = 2000;
/** Cost growth rate applied per level once past the compounding cap — purely linear, so it can never overflow no matter how many levels a save accumulates. */
const MASTERY_COST_LINEAR_TAIL_GROWTH = 0.5;

/**
 * Gems cost to go from `currentMasteryLevel` to `currentMasteryLevel + 1`.
 * No max level — always returns a real (finite) number. `currentMasteryLevel`
 * is expected to be >= 0.
 */
export function getMasteryUpgradeCost(type: TowerType, currentMasteryLevel: number): number {
  const def = TOWER_DEFINITIONS[type];
  const targetLevel = currentMasteryLevel + 1;
  const cappedLevel = Math.min(targetLevel, MASTERY_COST_COMPOUND_LEVEL_CAP);
  const compound = Math.pow(MASTERY_COST_GROWTH_FACTOR, cappedLevel);
  const tailLevels = Math.max(0, targetLevel - MASTERY_COST_COMPOUND_LEVEL_CAP);
  const linearTail = 1 + tailLevels * MASTERY_COST_LINEAR_TAIL_GROWTH;
  return Math.round(def.upgradeCostBase * MASTERY_BASE_COST_MULTIPLIER * compound * linearTail);
}
