/**
 * HORDENOVA Season/Progression v1.0 — PROFILE PRESTIGE. Permanent,
 * account-wide (never per-tower, never reset by a Season boundary), funded
 * entirely by Gems. Requires the account's all-time `bestWave` to have ever
 * reached PRESTIGE_MIN_BEST_WAVE — a monotonic record that, once crossed,
 * can never un-cross, so this is a one-time permanent gate, not a recurring
 * check.
 *
 * Grants small, PERMANENTLY BOUNDED economy bonuses (Gold income, Gem Shard
 * income) that fully saturate at PRESTIGE_FUNCTIONAL_CAP_LEVEL — well within
 * a realistic number of Prestige levels, deliberately NOT the kind of
 * open-ended diminishing-returns curve Mastery/Specialization use. Past that
 * level, Prestige keeps costing Gems and keeps climbing forever (see
 * getPrestigeUpgradeCost), but delivers zero further economic effect —
 * every level past the cap is pure status/ranking/cosmetic tier, never a
 * second infinite economic-power track competing with Mastery/Specialization.
 *
 * NEVER: damage, HP, attack speed, or any other direct combat multiplier —
 * see config/gemSinks.ts's registry doc comment for the full "never P2W"
 * contract every Gem sink must honor.
 */

/** All-time bestWave (never reset by a Season boundary) required before Prestige level 0 -> 1 becomes purchasable at all. Trivial to reach — it exists to make "atingir um requisito" a real, if easy, step, not a Gems-only gate. */
export const PRESTIGE_MIN_BEST_WAVE = 100;

export function canUnlockPrestige(bestWave: number): boolean {
  return bestWave >= PRESTIGE_MIN_BEST_WAVE;
}

const PRESTIGE_BASE_COST_GEMS = 150;
const PRESTIGE_GROWTH_FACTOR = 1.1;

/**
 * Gem cost to go from `currentLevel` to `currentLevel + 1`. No max level —
 * exact formula approved for HORDENOVA Season/Progression v1.0, no
 * compounding-cap/linear-tail safety net (unlike Mastery/Specialization's
 * cost curves): 1.10^n only approaches double-precision overflow around
 * n≈7,440, a Prestige level so far beyond any realistic Gems budget (level
 * 50 alone already costs ~193,000 Gems) that the safety net every other
 * uncapped cost curve in this codebase needs would never actually matter
 * here — adding one would be complexity with no real effect.
 */
export function getPrestigeUpgradeCost(currentLevel: number): number {
  const targetLevel = currentLevel + 1;
  return Math.round(PRESTIGE_BASE_COST_GEMS * Math.pow(PRESTIGE_GROWTH_FACTOR, targetLevel)) + targetLevel;
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

/** Cosmetic-only tier for a given prestige level — cycles the name list (with an incrementing Roman-numeral-style suffix past the first cycle) so this never runs out of a label at extreme levels, same "genuinely uncapped, never breaks" discipline as every other formula in this pass. This is what gives Prestige levels PAST the functional cap (see below) their ongoing status value. */
export function getPrestigeTier(level: number): PrestigeTier {
  const tier = Math.floor(level / PRESTIGE_TIER_INTERVAL);
  const cycle = Math.floor(tier / PRESTIGE_TIER_NAMES.length);
  const nameIndex = tier % PRESTIGE_TIER_NAMES.length;
  return { tier, nameKey: PRESTIGE_TIER_NAMES[nameIndex]!, cycle, color: PRESTIGE_TIER_COLORS[nameIndex]! };
}

// ---------------------------------------------------------------------------
// Prestige economy bonuses — small, permanently bounded, no combat power.
// ---------------------------------------------------------------------------

const PRESTIGE_GOLD_BONUS_PER_LEVEL = 0.005; // +0.5%/level
const PRESTIGE_GOLD_BONUS_CAP = 0.15; // saturates at level 30
const PRESTIGE_GEM_SHARD_BONUS_PER_LEVEL = 0.005; // +0.5%/level
const PRESTIGE_GEM_SHARD_BONUS_CAP = 0.2; // saturates at level 40

/** The level at which BOTH bonuses below are fully saturated — every level past this one costs Gems (see getPrestigeUpgradeCost) but grants no further economic effect, existing purely as status/ranking (see getPrestigeTier). */
export const PRESTIGE_FUNCTIONAL_CAP_LEVEL = PRESTIGE_GEM_SHARD_BONUS_CAP / PRESTIGE_GEM_SHARD_BONUS_PER_LEVEL;

export interface PrestigeBonuses {
  /** Multiplier on Gold earned per kill. 1 = no bonus. Caps at 1.15 (level 30). */
  goldMultiplier: number;
  /** Multiplier on Gem Shards earned per boss/mini-boss kill. 1 = no bonus. Caps at 1.20 (level 40). */
  gemShardMultiplier: number;
}

/**
 * Pure function of `prestigeLevel` — a simple linear ramp to a hard cap,
 * deliberately NOT the diminishing-returns family Mastery/Specialization
 * use, because those need to keep paying out forever (matching Gold's own
 * unbounded growth) while Prestige explicitly must NOT: it caps in a
 * reasonable, small number of levels (30/40) so it can never become a second
 * infinite economic-power track running alongside them.
 */
export function getPrestigeBonuses(prestigeLevel: number): PrestigeBonuses {
  const level = Math.max(0, prestigeLevel);
  return {
    goldMultiplier: 1 + Math.min(PRESTIGE_GOLD_BONUS_CAP, level * PRESTIGE_GOLD_BONUS_PER_LEVEL),
    gemShardMultiplier: 1 + Math.min(PRESTIGE_GEM_SHARD_BONUS_CAP, level * PRESTIGE_GEM_SHARD_BONUS_PER_LEVEL),
  };
}
