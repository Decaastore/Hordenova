import { getTowerStats, type TowerInstance } from "@/entities/Tower";
import { getTowerLevelStats } from "@/config/towerStats";
import { specializationEffectScale } from "@/config/specializations";
import { getReferenceCombatPower } from "@/config/difficultyScaling";

/**
 * DIFICULDADE INDIVIDUAL POR JOGADOR — spec section 1. Combat Power is an
 * INTERNAL-ONLY comparison metric (never shown to the player as a
 * combat stat, never fed back into damage/HP/rewards/currency) used
 * exclusively to calibrate the bounded difficulty adjustment in
 * config/difficultyScaling.ts. Built entirely from REAL, already-existing
 * functions — never an arbitrary formula like "towerLevel × 100":
 *
 *  - Tower Level + Mastery: entities/Tower.ts's getTowerStats(tower), the
 *    exact same real damage/attackSpeed the tower actually fires with.
 *  - Specialization: config/specializations.ts's specializationEffectScale,
 *    the exact real diminishing-returns curve every specialization path's
 *    own combat bonus is already built from — counted ONLY when the tower
 *    has an active specializationId with specializationLevel > 0 (an
 *    unlocked-but-unused or never-unlocked path contributes nothing).
 *  - Equipment: NOT counted. entities/Item.ts's item effects are not wired
 *    into combat anywhere in this codebase yet (see itemDefinitions.ts's
 *    own header note) — getTowerStats already correctly ignores equipped
 *    items, so an item sitting only in the inventory (or even equipped)
 *    structurally cannot inflate this number, satisfying "item apenas no
 *    inventário não deve aumentar o Combat Power" without inventing a
 *    parallel equipment-power system that doesn't exist in real combat.
 *  - Loadout: only towers actually present in the engine's live `towers`
 *    array (the real active loadout) are summed — a tower not placed
 *    contributes nothing, and the distribution across towers matters
 *    (8 towers at level 20 sum to a very different total than 1 tower at
 *    level 25 plus 7 at level 3), never just "highest level in the account".
 */

/**
 * SPECIALIZATION_POWER_COEFFICIENT reuses the exact real per-scale-unit
 * coefficient IRONWOOD_EXECUTIONER/IRONWOOD_BREAKER's own critMultiplier
 * bonus already applies (config/specializations.ts: `lvl * 0.04`) as a
 * generic, representative "how much a specialization scale-unit is worth"
 * figure — not a new number invented for this metric.
 */
const SPECIALIZATION_POWER_COEFFICIENT = 0.04;

/** Real per-tower Combat Power: base DPS (damage × attack speed, already including Level + Mastery via getTowerStats) times a Specialization multiplier that is exactly 1 (no bonus at all) unless a path is both chosen AND leveled. */
export function getTowerCombatPower(tower: TowerInstance): number {
  const stats = getTowerStats(tower);
  const baseDps = stats.damage * stats.attackSpeed;

  const hasActiveSpecialization = tower.specializationId !== null && tower.specializationLevel > 0;
  const specializationMultiplier = hasActiveSpecialization
    ? 1 + specializationEffectScale(tower.specializationLevel) * SPECIALIZATION_POWER_COEFFICIENT
    : 1;

  return baseDps * specializationMultiplier;
}

/** Real account Combat Power: the sum of every tower ACTUALLY PLACED in the live loadout right now — never the account's single highest tower level, and never a tower sitting unbuilt. */
export function getAccountCombatPower(towers: readonly TowerInstance[]): number {
  return towers.reduce((sum, tower) => sum + getTowerCombatPower(tower), 0);
}

/** A brand-new account's very first tower (IRONWOOD, level 1, no Mastery, no Specialization) — the real, concrete baseline the difficulty reference curve grows from. Not arbitrary: it's the exact real stats getTowerLevelStats already produces for level 1. */
export function getBaselineCombatPowerAtWaveOne(): number {
  const level1 = getTowerLevelStats("IRONWOOD", 1);
  return level1.damage * level1.attackSpeed;
}

/** Convenience: the real, current difficulty-reference Combat Power for `globalWave`, derived from the real level-1 baseline above — see config/difficultyScaling.ts for how this is turned into a bounded multiplier. */
export function getReferenceCombatPowerForWave(globalWave: number): number {
  return getReferenceCombatPower(getBaselineCombatPowerAtWaveOne(), globalWave);
}
