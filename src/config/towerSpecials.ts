import type { TowerType } from "./towerStats";

/**
 * Master Implementation spec section 26-28 — Special Attack. A second,
 * completely independent attack cadence per tower: while the normal attack
 * keeps firing on its attack-speed-driven cooldown (unchanged), each tower
 * also fires a fixed-interval "ultimate" with its own identity — never just
 * `damage * 3` on the same attack, a mechanically and visually distinct hit
 * (see entities/Tower.ts's `specialCooldownRemainingMs`,
 * engine/CombatSystem.ts's special-attack block, and
 * rendering/EntityRenderer.ts's per-type special VFX).
 *
 * The interval values below are the spec's own explicit "starting points
 * for testing, not final values" (section 26) — kept exactly as given.
 * Multipliers were tuned by simulating real combat (see
 * SpecialAttackSimulation.test.ts) so the special reads as a real spike —
 * roughly 20-40% of a tower's total DPS across a full engagement — without
 * making the normal attack feel pointless in between.
 */

export const SPECIAL_ATTACK_COOLDOWN_MS: Record<TowerType, number> = {
  IRONWOOD: 7000,
  INFERNO: 8000,
  FROSTBORN: 9000,
  STORMCALLER: 6000,
};

export function getTowerSpecialCooldownMs(type: TowerType): number {
  return SPECIAL_ATTACK_COOLDOWN_MS[type];
}

/**
 * IRONWOOD — "Piercing Shot": one devastating, guaranteed-crit hit that
 * pierces straight through armor. Identity: tension/recoil/impact, a
 * single overwhelming shot rather than more projectiles.
 */
export const IRONWOOD_SPECIAL = {
  damageMultiplier: 4.5,
  armorPenetration: 0.5,
} as const;

/**
 * INFERNO — "Firestorm": a much larger explosion that ignites every enemy
 * it touches, not just the primary target's own aoeRadius. Identity: a
 * genuine "everything nearby burns" moment, not a slightly bigger tick.
 */
export const INFERNO_SPECIAL = {
  damageMultiplier: 2.2,
  radiusMultiplier: 2.4,
} as const;

/**
 * FROSTBORN — "Absolute Zero": a freezing nova centered on the tower
 * itself, not just the current target — every enemy in range is fully
 * frozen (100% slow), not just partially slowed. Identity: area control,
 * not more single-target damage (Frostborn's normal attack is already the
 * control tower; the special leans further into that instead of copying
 * Ironwood's burst-damage identity).
 */
export const FROSTBORN_SPECIAL = {
  damageMultiplier: 1.4,
  freezeDurationMs: 2200,
} as const;

/**
 * STORMCALLER — "Chain Overload": the normal chain-lightning bolt, but
 * hitting several more targets down the chain at much higher per-hit
 * damage. Identity: the existing chain mechanic pushed to its extreme
 * rather than a different mechanic entirely.
 */
export const STORMCALLER_SPECIAL = {
  damageMultiplier: 1.8,
  extraChainTargets: 3,
} as const;
