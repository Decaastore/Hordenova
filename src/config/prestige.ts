/**
 * Master Implementation Pass spec section 7-8 — PROFILE PRESTIGE: the
 * recurring, scalable, purely-cosmetic Gem sink the spec explicitly asks
 * for alongside the existing ones (specialization unlock, see
 * config/specializations.ts's SPECIALIZATION_UNLOCK_GEM_COST; inventory
 * capacity expansion stays the architecturally-reserved-but-not-yet-a-real-
 * sink field it already was — see SaveSystem.ts's own comment on
 * inventoryCapacity). Genuinely uncapped ("a progressão pode continuar
 * indefinitely" — spec's own words for this exact feature), account-wide
 * (not per-tower), and NEVER touches damage/HP/attack-speed/drop-rate/
 * progression — see config/gemSinks.ts's registry doc comment for the
 * full "never P2W" contract this and every other Gem sink must honor.
 *
 * A tier is purely a display label/color band over the same underlying
 * `prestigeLevel` integer — nothing here ever branches gameplay on it.
 */

const PRESTIGE_BASE_COST_GEMS = 3;
const PRESTIGE_GROWTH_FACTOR = 1.15;
/**
 * Same overflow-safety technique as enemyStats.ts / towerMastery.ts —
 * compounding growth stops accelerating past this level, cost keeps
 * climbing forever via the linear tail below. Capped much lower than
 * towerMastery.ts's equivalent (2000) because this curve's growth FACTOR
 * is itself larger (1.15 vs 1.05) — compound alone at level 1000 is
 * already ~10^60, leaving well over 200 orders of magnitude of headroom
 * below Number.MAX_VALUE for the linear tail to keep multiplying safely.
 */
const PRESTIGE_COST_COMPOUND_LEVEL_CAP = 1000;
const PRESTIGE_COST_LINEAR_TAIL_GROWTH = 2;

/**
 * Gem cost to go from `currentLevel` to `currentLevel + 1`. No max level.
 * The `+ targetLevel` floor guarantees strict integer monotonicity even at
 * the very start of the curve, where `Math.round` on a still-small
 * multiplicative value would otherwise round two consecutive levels down
 * to the identical integer (e.g. level 0 and level 1 both rounding to 5
 * Gems) — a real "next level is free" bug this floor rules out entirely,
 * while being utterly negligible next to the multiplicative term at any
 * level where it actually matters.
 */
export function getPrestigeUpgradeCost(currentLevel: number): number {
  const targetLevel = currentLevel + 1;
  const cappedLevel = Math.min(targetLevel, PRESTIGE_COST_COMPOUND_LEVEL_CAP);
  const compound = Math.pow(PRESTIGE_GROWTH_FACTOR, cappedLevel);
  const tailLevels = Math.max(0, targetLevel - PRESTIGE_COST_COMPOUND_LEVEL_CAP);
  const linearTail = 1 + tailLevels * PRESTIGE_COST_LINEAR_TAIL_GROWTH;
  return Math.max(1, Math.round(PRESTIGE_BASE_COST_GEMS * compound * linearTail) + targetLevel);
}

/** Every 10 levels is a new cosmetic tier — i18n key: prestige.tiers.<name> */
const PRESTIGE_TIER_INTERVAL = 10;
const PRESTIGE_TIER_NAMES = ["INITIATE", "ADEPT", "VETERAN", "CHAMPION", "PARAGON", "LUMINARY", "ASCENDANT", "MYTHIC", "ETERNAL", "TRANSCENDENT"] as const;

export interface PrestigeTier {
  /** Ever-increasing raw tier index — 0 for level 0-9, 1 for 10-19, etc. Never wraps. */
  tier: number;
  /** i18n key: prestige.tiers.<nameKey> */
  nameKey: (typeof PRESTIGE_TIER_NAMES)[number];
  /** How many full cycles through the name list this tier represents — 0 the first time a name is used, 1 the next time it recurs, etc. A UI appends this (e.g. "MYTHIC II") so extremely high tiers still read as distinct, not a repeat. */
  cycle: number;
  /** Cosmetic display color — never read by any gameplay code. */
  color: string;
}

const PRESTIGE_TIER_COLORS = [
  "#c9963f", // INITIATE - bronze
  "#d3d3d3", // ADEPT - silver
  "#ffd257", // VETERAN - gold
  "#7fd857", // CHAMPION - emerald
  "#4ec4f0", // PARAGON - sapphire
  "#c88aff", // LUMINARY - amethyst
  "#ff6a2e", // ASCENDANT - ember
  "#e8503a", // MYTHIC - ruby
  "#fff2c9", // ETERNAL - radiant
  "#ffffff", // TRANSCENDENT - white
] as const;

/** Cosmetic-only tier for a given prestige level — cycles the name list (with an incrementing Roman-numeral-style suffix past the first cycle) so this never runs out of a label at extreme levels, same "genuinely uncapped, never breaks" discipline as every other formula in this pass. */
export function getPrestigeTier(level: number): PrestigeTier {
  const tier = Math.floor(level / PRESTIGE_TIER_INTERVAL);
  const cycle = Math.floor(tier / PRESTIGE_TIER_NAMES.length);
  const nameIndex = tier % PRESTIGE_TIER_NAMES.length;
  return { tier, nameKey: PRESTIGE_TIER_NAMES[nameIndex]!, cycle, color: PRESTIGE_TIER_COLORS[nameIndex]! };
}
