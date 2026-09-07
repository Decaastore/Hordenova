import { TOWER_DEFINITIONS, type TowerType } from "./towerStats";

/**
 * TOWER MASTERY — the account-wide, per-TOWER-TYPE progression track that
 * exists past MAX_TOWER_LEVEL (30). Level 30 stays the last VISUAL evolution
 * and the last of the level-driven special unlocks (multiShot/giantSlayer/
 * wildfire/deepFreeze/arcaneSurge/etc, all in towerStats.ts, all untouched)
 * — Mastery is a SEPARATE, uncapped track layered on top, exactly mirroring
 * how config/specializations.ts layers an independent optional track next to
 * level.
 *
 * ============================================================================
 * INFINITE BALANCE OVERHAUL — what changed and why.
 * ============================================================================
 *
 * BEFORE: Mastery cost Gems at EVERY level, forever, and granted ZERO combat
 * effect (Respec Tokens + a cosmetic tier only). That combination is what
 * produced the documented chicken-and-egg: the only Gem Shard sources were
 * boss/mini-boss kills, the wall stopped exactly those kills, and the one
 * thing Gems could be spent on did nothing to break the wall. A permanently
 * powerless track also meant player power was structurally bounded, which is
 * half of why the wall was unavoidable at all.
 *
 * NOW, mirroring Specialization's own shape exactly (one premium unlock, then
 * a pure Gold track):
 *   1. UNLOCK — one flat, one-time MASTERY_UNLOCK_GEM_COST Gems payment per
 *      TOWER TYPE (not per placed tower — Mastery has always been account-
 *      wide-by-type, see GameEngine.towerMasteryLevels; that scope is
 *      deliberately unchanged). Paying it sets masteryLevel to 1.
 *   2. EVERY LEVEL AFTER — Gold, forever, via getMasteryUpgradeCost. No max
 *      level, no cap of any kind.
 *   3. REAL BUT DELIBERATELY NON-DPS-LED EFFECT — see getMasteryBonuses.
 *
 * IS THIS "GEMS BUY POWER"? No, in exactly the same sense Specialization
 * isn't: Gems buy ACCESS to a track (a one-time unlock a free player reaches
 * from ordinary milestone/boss Gem Shard income — see
 * config/phaseConfig.ts's endgame milestone shards), and Gold — the purely
 * earned, Season-scoped currency — buys every point of power in it. A
 * larger Gem stockpile buys the unlock earlier, never higher.
 *
 * The Respec Token and cosmetic-tier rewards below are UNCHANGED; Mastery
 * still grants them on the same intervals it always did.
 */

/**
 * One-time Gems price to unlock the Mastery track for a tower TYPE. Flat (not
 * scaled by type/level) for the same reason SPECIALIZATION_UNLOCK_GEM_COST is
 * flat: it is one clear premium decision, not a second Gold-shaped curve
 * denominated in Gems. Tuned against real Gem Shard income (boss 5 / mini-boss
 * 2 / milestone, 10 shards = 1 Gem) so a F2P player unlocks their first
 * Mastery track inside the first content phases, not after the wall.
 */
export const MASTERY_UNLOCK_GEM_COST = 6;

/** Every N mastery levels grants exactly 1 Specialization Respec Token (5 -> 1, 10 -> 2, 15 -> 3, ...). */
export const MASTERY_RESPEC_TOKEN_INTERVAL = 5;

/**
 * Pure function of `masteryLevel` — NEVER a stored/incremented counter, so
 * it can never double-grant on a reload/restart. The engine tracks only how
 * many of these have been SPENT (SaveData.towerRespecTokensSpent, same
 * per-TowerType persistence shape as towerMasteryLevels) and subtracts that
 * from this to get what's currently available (getAvailableRespecTokens).
 */
export function getMasteryRespecTokensEarned(masteryLevel: number): number {
  return Math.floor(Math.max(0, masteryLevel) / MASTERY_RESPEC_TOKEN_INTERVAL);
}

/** Tokens earned so far minus tokens already spent — never negative. */
export function getAvailableRespecTokens(masteryLevel: number, tokensSpent: number): number {
  return Math.max(0, getMasteryRespecTokensEarned(masteryLevel) - Math.max(0, tokensSpent));
}

export interface MasteryCosmeticTier {
  /** Stable id — used as a rendering key, never shown raw to the player. */
  id: string;
  /** i18n key suffix — full key is `towerInfo.masteryCosmetic.${nameKey}`. */
  nameKey: string;
  /** Mastery level this tier unlocks at (inclusive). */
  level: number;
}

/**
 * Cosmetic tiers unlocked purely by masteryLevel — ring/aura/runes reward
 * bands. Deliberately never read by CombatSystem; only EntityRenderer/
 * TowerInfoPanel ever call these.
 */
export const MASTERY_COSMETIC_TIERS: readonly MasteryCosmeticTier[] = [
  { id: "ember_ring", nameKey: "emberRing", level: 5 },
  { id: "veteran_aura", nameKey: "veteranAura", level: 15 },
  { id: "runic_sigils", nameKey: "runicSigils", level: 30 },
  { id: "ascendant_halo", nameKey: "ascendantHalo", level: 60 },
  { id: "mythic_crown", nameKey: "mythicCrown", level: 120 },
];

/** Highest cosmetic tier reached at `masteryLevel`, or null if below the first tier's threshold. */
export function getMasteryCosmeticTier(masteryLevel: number): MasteryCosmeticTier | null {
  let current: MasteryCosmeticTier | null = null;
  for (const tier of MASTERY_COSMETIC_TIERS) {
    if (masteryLevel >= tier.level) current = tier;
  }
  return current;
}

/** The next tier still ahead of `masteryLevel` (for "next reward" UI), or null once every tier is unlocked. */
export function getNextMasteryCosmeticTier(masteryLevel: number): MasteryCosmeticTier | null {
  return MASTERY_COSMETIC_TIERS.find((tier) => masteryLevel < tier.level) ?? null;
}

// ---------------------------------------------------------------------------
// Mastery effect — the diminishing-returns scale and what it buys.
// ---------------------------------------------------------------------------

/**
 * Same construction as config/specializations.ts's specializationEffectScale
 * (deliberately: one diminishing-returns technique in this codebase, not
 * two), with its own exponent so the two tracks FEEL different rather than
 * being the same curve twice.
 *
 *   scale(L) = (L0 / s) * ((1 + L / L0) ^ s - 1)
 *
 * scale(L) -> L for small L, and ~ L^s forever after. Never flat, never
 * capped, never Infinity/NaN.
 *
 * MASTERY_EFFECT_EXPONENT is set slightly below Specialization's so that
 * Specialization stays the sharper, identity-defining investment and Mastery
 * reads as the broader, slower account-wide one.
 */
export const MASTERY_EFFECT_EXPONENT = 0.45;
export const MASTERY_EFFECT_SCALE = 20;

export function masteryEffectScale(masteryLevel: number): number {
  const l = Math.max(0, masteryLevel);
  const s = MASTERY_EFFECT_EXPONENT;
  const l0 = MASTERY_EFFECT_SCALE;
  return (l0 / s) * (Math.pow(1 + l / l0, s) - 1);
}

export interface MasteryBonuses {
  /** Multiplier on tower damage. Modest by design — see this interface's doc comment. */
  damageMultiplier: number;
  /** Multiplier on attacks per second. */
  attackSpeedMultiplier: number;
  /** Multiplier on range — the headline effect: coverage, not raw numbers. */
  rangeMultiplier: number;
  /** Fraction (0..1) taken off every Gold price a tower of this type charges (level, specialization). Efficiency, not damage. */
  goldCostReduction: number;
  /** Fraction (0..1) of incoming Boss Siege damage this tower type shrugs off. Resistance, not damage. */
  siegeResistance: number;
}

/**
 * WHY THIS IS NOT "JUST MORE DPS" — the requirement was explicit, so the
 * weighting is explicit too. Per unit of `masteryEffectScale`:
 *   range           +0.60%   <- the largest per-point effect
 *   gold efficiency +0.50%   <- pure economy, zero combat math
 *   siege resistance+0.50%   <- survivability against the one boss mechanic
 *                               that attacks the BUILD instead of the base
 *   attack speed    +0.45%
 *   damage          +0.25%   <- deliberately the SMALLEST
 *
 * Range is first on purpose: this map is a single serpentine path with 12
 * fixed slots, so idealized "everything always in range" DPS is 2-4x the real
 * measured DPS. Range is therefore the stat that converts into real damage
 * MOST efficiently, and it does so by fixing coverage/positioning — the
 * actual structural weakness of the map — rather than by inflating a number.
 * Gold efficiency compounds into every other track (more Specialization
 * levels per wave farmed) without ever touching a combat formula.
 *
 * goldCostReduction and siegeResistance are bounded fractions (a >100% price
 * cut, or literal immunity, is not a meaningful game state). The three
 * multiplicative stats are unbounded and keep growing forever, so no mastery
 * level is ever a dead purchase.
 */
const MASTERY_DAMAGE_PER_POINT = 0.0025;
const MASTERY_ATTACK_SPEED_PER_POINT = 0.0045;
const MASTERY_RANGE_PER_POINT = 0.006;
const MASTERY_GOLD_DISCOUNT_PER_POINT = 0.005;
const MASTERY_GOLD_DISCOUNT_MAX = 0.5;
const MASTERY_SIEGE_RESISTANCE_PER_POINT = 0.005;
const MASTERY_SIEGE_RESISTANCE_MAX = 0.8;

export function getMasteryBonuses(masteryLevel: number): MasteryBonuses {
  const scale = masteryEffectScale(masteryLevel);
  return {
    damageMultiplier: 1 + scale * MASTERY_DAMAGE_PER_POINT,
    attackSpeedMultiplier: 1 + scale * MASTERY_ATTACK_SPEED_PER_POINT,
    rangeMultiplier: 1 + scale * MASTERY_RANGE_PER_POINT,
    goldCostReduction: Math.min(MASTERY_GOLD_DISCOUNT_MAX, scale * MASTERY_GOLD_DISCOUNT_PER_POINT),
    siegeResistance: Math.min(MASTERY_SIEGE_RESISTANCE_MAX, scale * MASTERY_SIEGE_RESISTANCE_PER_POINT),
  };
}

// ---------------------------------------------------------------------------
// Mastery cost — Gold, forever.
// ---------------------------------------------------------------------------

/**
 * Same structure as config/prestige.ts's getPrestigeUpgradeCost and
 * config/specializations.ts's getSpecializationUpgradeCost: compounding growth
 * capped at a level-index ceiling, then a purely linear tail. The ceiling is
 * what makes the curve overflow-proof (a raw Math.pow over an unbounded level
 * eventually reaches Infinity, which would turn "expensive" into "impossible"
 * — see prestige.ts's own comment); the linear tail is what keeps the curve
 * ASYMPTOTICALLY LINEAR in the level, which is the property the whole no-wall
 * proof rests on (cumulative Gold grows ~wave^2, so a linear per-level price
 * means the affordable level grows ~linearly with wave, which is exactly the
 * input masteryEffectScale needs).
 *
 * The tail slope is ln(GROWTH_FACTOR) so the curve's slope is continuous at
 * the ceiling — no price cliff.
 *
 * Mastery is per TOWER TYPE while Specialization is per placed tower, so the
 * same Gold buys 12 Specialization tracks but only 4 Mastery tracks — the
 * base multiplier below is set higher than Specialization's accordingly, so
 * neither track trivially dominates the other as a Gold destination.
 */
const MASTERY_BASE_COST_MULTIPLIER = 16;
const MASTERY_COST_GROWTH_FACTOR = 1.06;
const MASTERY_COST_COMPOUND_LEVEL_CAP = 50;
const MASTERY_COST_LINEAR_TAIL_GROWTH = Math.log(MASTERY_COST_GROWTH_FACTOR);

/**
 * GOLD cost to go from `currentMasteryLevel` to `currentMasteryLevel + 1`.
 * Only meaningful once the track is unlocked (level >= 1); level 0 -> 1 is
 * the one-time MASTERY_UNLOCK_GEM_COST Gems purchase instead. No max level —
 * always returns a real, finite, strictly increasing number.
 */
export function getMasteryUpgradeCost(type: TowerType, currentMasteryLevel: number): number {
  const def = TOWER_DEFINITIONS[type];
  const targetLevel = Math.max(1, currentMasteryLevel + 1);
  const base = def.upgradeCostBase * MASTERY_BASE_COST_MULTIPLIER;

  const cappedLevel = Math.min(targetLevel, MASTERY_COST_COMPOUND_LEVEL_CAP);
  const compound = Math.pow(MASTERY_COST_GROWTH_FACTOR, cappedLevel - 1);
  const tailLevels = Math.max(0, targetLevel - MASTERY_COST_COMPOUND_LEVEL_CAP);
  const linearTail = 1 + tailLevels * MASTERY_COST_LINEAR_TAIL_GROWTH;
  return Math.round(base * compound * linearTail) + targetLevel;
}
