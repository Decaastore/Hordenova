import { TOWER_DEFINITIONS, type TowerType } from "./towerStats";

/**
 * TOWER MASTERY — the account-wide, per-TOWER-TYPE progression track that
 * exists past MAX_TOWER_LEVEL. Level 30 stays the last VISUAL evolution and
 * the last of the level-driven special unlocks (multiShot/giantSlayer/
 * wildfire/deepFreeze/arcaneSurge/etc, all in towerStats.ts, all untouched)
 * — Mastery is a SEPARATE, uncapped track layered on top, exactly mirroring
 * how config/specializations.ts layers an independent optional track next
 * to level.
 *
 * ============================================================================
 * HORDENOVA Season/Progression v1.0 — Ownership vs. Level split.
 * ============================================================================
 *
 * Mastery is now explicitly two SEPARATE things, never conflated:
 *
 *   OWNERSHIP (`masteryUnlocked`, SaveData/GameEngine, permanent, keyed by
 *   TOWER TYPE) — a one-time MASTERY_UNLOCK_GEM_COST Gems purchase that
 *   NEVER resets at a Season boundary and is NEVER charged again once paid.
 *
 *   PROGRESSION (`masteryLevel`, SEASON-scoped) — starts at 0 at the
 *   beginning of every Season, regardless of ownership, and is raised
 *   entirely with Gold via getMasteryUpgradeCost below. Owning the track
 *   only gates WHETHER a tower type can spend Gold on it at all — it does
 *   NOT pre-fill any levels for free at a new Season's start.
 *
 * This mirrors Specialization's own ownership/level split
 * (config/specializations.ts's `unlockedSpecializationIds` vs.
 * `specializationLevel`) exactly, and is why `getMasteryUpgradeCost` below
 * is called starting from currentMasteryLevel=0 every single Season, not
 * just the first time a type is ever unlocked.
 *
 * IS THIS "GEMS BUY POWER"? No, in exactly the same sense Specialization
 * isn't: Gems buy ACCESS to a track (a one-time unlock a free player reaches
 * from ordinary Gem Shard income), and Gold — the purely earned,
 * Season-scoped currency — buys every point of power in it, every single
 * Season. A larger Gem stockpile buys the unlock earlier, never higher.
 *
 * The Specialization Respec Token system that used to live in this file has
 * been removed entirely — switching specializations is now the flat,
 * unconditional "Trocar Especialização" purchase (200 Gems, see
 * config/specializations.ts's SPECIALIZATION_CHANGE_GEM_COST), not something
 * earned by leveling Mastery.
 */

/**
 * One-time Gems price to unlock the Mastery track for a tower TYPE,
 * permanently — never charged again for that type, on this account, in any
 * future Season. Flat (not scaled by type/level) for the same reason
 * SPECIALIZATION_UNLOCK_GEM_COST is flat: it is one clear premium decision,
 * not a second Gold-shaped curve denominated in Gems.
 */
export const MASTERY_UNLOCK_GEM_COST = 400;

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
 * TowerInfoPanel ever call these. Since masteryLevel is Season-scoped, these
 * tiers are a per-Season display (recomputed fresh from level 0 each time),
 * not a permanent unlock.
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
 * FROZEN — part of the v1.0 Infinite Progression Mathematical Specification.
 * DO NOT alter this exponent or the shape of masteryEffectScale; only the
 * ownership/level split and the Gold cost curve below are in scope for the
 * Season/Prestige update.
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
// Mastery cost — Gold, forever, reset to level 0 every Season.
// ---------------------------------------------------------------------------

/**
 * HORDENOVA Season/Progression v1.0 — retuned constants (multiplier 16->55,
 * growth factor 1.06->1.07, compound cap 50->40), validated by a real
 * GameEngine Season simulation across F2P/payer profiles. Same structure as
 * before: compounding growth capped at a level-index ceiling, then a purely
 * linear tail — the ceiling keeps the curve overflow-proof, the linear tail
 * keeps it asymptotically linear in the level (this part of the curve is
 * NOT part of the frozen Infinite Progression spec — only
 * MASTERY_EFFECT_EXPONENT above is — so retuning it for the new Season
 * cadence does not reopen any frozen contract).
 *
 * Mastery is per TOWER TYPE while Specialization is per placed tower, so the
 * same Gold buys 12 Specialization tracks but only 4 Mastery tracks — the
 * base multiplier below is set higher than Specialization's accordingly, so
 * neither track trivially dominates the other as a Gold destination.
 */
const MASTERY_BASE_COST_MULTIPLIER = 55;
const MASTERY_COST_GROWTH_FACTOR = 1.07;
const MASTERY_COST_COMPOUND_LEVEL_CAP = 40;
const MASTERY_COST_LINEAR_TAIL_GROWTH = Math.log(MASTERY_COST_GROWTH_FACTOR);

/**
 * GOLD cost to go from `currentMasteryLevel` to `currentMasteryLevel + 1`.
 * Called starting from 0 at the beginning of every Season, for any tower
 * type whose Mastery ownership has ever been purchased — ownership only
 * gates ACCESS to this curve, it never pre-pays any of it. No max level —
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
