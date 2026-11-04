import { SPECIAL_ATTACK_COOLDOWN_MS } from "./towerSpecials";
import { TOWER_DEFINITIONS, type TowerType } from "./towerStats";
import { isPaidTowerSkin } from "./towerSkins";

/**
 * TOWER MANA — what charges a tower's Special Attack.
 *
 * Every normal attack that lands fills the tower's mana bar, and each kill
 * adds a little extra. When the bar is full the special fires on its own,
 * so an idle player loses nothing. A tower that keeps attacking fills its
 * bar in exactly its type's special interval (config/towerSpecials.ts),
 * whatever its attack speed — faster towers gain less per hit — so the
 * special keeps the same share of a tower's damage it always had.
 *
 * HOLD AND RELEASE. The player can hold every special ("Segurar
 * especiais"): towers keep charging past full, up to MANA_OVERCHARGE_MAX,
 * and a held special hits harder in proportion (up to +50%). "Soltar tudo"
 * lets them all go at once — a timed volley on a boss. Holding never adds
 * damage over time (a held tower fires fewer specials), it only lets the
 * player put it where it matters. Hold ends on its own when the wave or
 * boss fight ends, so a tab left alone never stays held.
 *
 * FASTER MANA. A tower TYPE's mana can be upgraded with Gold (Season-scoped,
 * like Mastery), and a paid skin adds a small bonus. Both only speed up how
 * often the special comes; costs are set so a Gold coin spent here buys
 * less raw power than a tower level, keeping the pace of the endless climb.
 */

export const MANA_MAX = 100;
export const MANA_OVERCHARGE_MAX = 150;
/** Extra mana for each enemy the tower kills (before its gain multiplier). */
export const MANA_PER_KILL = 6;

export const MANA_UPGRADE_MAX_LEVEL = 10;
/** +5% mana gain per upgrade level — +50% at the top. */
export const MANA_UPGRADE_GAIN_PER_LEVEL = 0.05;
const MANA_UPGRADE_COST_MULTIPLIER = 40;
const MANA_UPGRADE_COST_GROWTH = 1.6;

/** +10% mana gain for a tower wearing a paid (non-Prestige) skin. */
export const SKIN_MANA_GAIN_BONUS = 0.1;

/** Mana one normal attack adds, so continuous attacking fills the bar in the type's special interval. */
export function manaPerAttack(type: TowerType, attackSpeed: number): number {
  const attackIntervalMs = 1000 / Math.max(0.01, attackSpeed);
  return (MANA_MAX * attackIntervalMs) / SPECIAL_ATTACK_COOLDOWN_MS[type];
}

export function manaGainMultiplier(manaLevel: number, equippedSkinId: string | null | undefined): number {
  const level = Math.max(0, Math.min(MANA_UPGRADE_MAX_LEVEL, Math.floor(manaLevel)));
  return 1 + level * MANA_UPGRADE_GAIN_PER_LEVEL + (isPaidTowerSkin(equippedSkinId) ? SKIN_MANA_GAIN_BONUS : 0);
}

/** Gold to raise a tower type's mana from `currentLevel` to the next one, or null at the top. */
export function getManaUpgradeCost(type: TowerType, currentLevel: number): number | null {
  if (currentLevel >= MANA_UPGRADE_MAX_LEVEL) return null;
  return Math.ceil(TOWER_DEFINITIONS[type].upgradeCostBase * MANA_UPGRADE_COST_MULTIPLIER * Math.pow(MANA_UPGRADE_COST_GROWTH, Math.max(0, currentLevel)));
}

/** Damage multiplier of a special fired with `mana` stored (1 at full, up to 1.5 when overcharged). */
export function overchargeMultiplier(mana: number): number {
  return Math.min(MANA_OVERCHARGE_MAX / MANA_MAX, Math.max(1, mana / MANA_MAX));
}
