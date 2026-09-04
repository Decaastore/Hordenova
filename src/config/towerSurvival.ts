import type { TowerType } from "./towerStats";

/**
 * Master Implementation Pass spec section 12 — TOWER SURVIVAL. Every tower
 * gets a real, DIFFERENT defensive identity — not a universal HP/Armor pair
 * copy-pasted four times — mirroring how their offensive identities already
 * diverge (config/towerStats.ts). This is what makes the Boss Siege Attack
 * (config/bossSiege.ts, entities/Tower.ts's applySiegeDamage) matter: which
 * tower a boss picks to hit has a genuinely different outcome depending on
 * its defensive kit, not just a shared HP bar.
 *
 *  IRONWOOD    — Bruiser: highest HP + real Armor (flat damage reduction).
 *                Built to just stand there and eat hits.
 *  INFERNO     — Glass cannon, but the fire "self-mends": lowest Armor,
 *                middling HP, the fastest raw HP Recovery of the four —
 *                punished hard by a hit, but shrugs it off between fights.
 *  FROSTBORN   — Ice Shield: a regenerating absorb pool that has to be
 *                broken through before HP is even touched — control tower
 *                doubling as its own front line.
 *  STORMCALLER — Lowest HP and no shield at all (a ranged glass cannon by
 *                design), but the single highest Recovery rate — "arcane
 *                resilience", fragile in the moment, quick to bounce back.
 */
export interface TowerSurvivalDefinition {
  maxHp: number;
  /** Flat fraction (0..1) of incoming siege damage ignored — applied AFTER shield, BEFORE HP. */
  armor: number;
  /** 0 = this tower type has no shield identity at all. */
  maxShield: number;
  /** Flat shield HP regenerated per second while below maxShield. */
  shieldRegenPerSecond: number;
  /** Flat HP regenerated per second while below maxHp (Recovery). */
  hpRegenPerSecond: number;
}

export const TOWER_SURVIVAL: Record<TowerType, TowerSurvivalDefinition> = {
  IRONWOOD: { maxHp: 420, armor: 0.35, maxShield: 0, shieldRegenPerSecond: 0, hpRegenPerSecond: 2 },
  INFERNO: { maxHp: 220, armor: 0.05, maxShield: 0, shieldRegenPerSecond: 0, hpRegenPerSecond: 6 },
  FROSTBORN: { maxHp: 240, armor: 0.1, maxShield: 140, shieldRegenPerSecond: 9, hpRegenPerSecond: 1.5 },
  STORMCALLER: { maxHp: 170, armor: 0, maxShield: 0, shieldRegenPerSecond: 0, hpRegenPerSecond: 9 },
};

export function getTowerSurvivalDefinition(type: TowerType): TowerSurvivalDefinition {
  return TOWER_SURVIVAL[type];
}
