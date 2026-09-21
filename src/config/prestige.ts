import { dualGemPrice, type DualGemPrice } from "./gemsEconomy";

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

/**
 * FASE 6 (Currency division: "Gold compra/evolui poder. Gems compram
 * acesso/decisões específicas e Prestige permanente.") — retuned cost curve,
 * same compound-cap + linear-tail architecture Mastery/Specialization
 * already use, so Prestige gets the same overflow-proof shape instead of a
 * bare, ever-steeper exponential. Approved via real-engine Gem Shard income
 * simulation (Cenário D: 2 Gem Shards per boss/mini-boss kill + milestone
 * bonuses extended to wave 500, see config/phaseConfig.ts) against an
 * explicit pacing target (P1 = days, P10 = weeks-months, P25 = months,
 * P50 = 1-2 years, P75 = 2-3 years, P100 = 3-5 years of real dedicated
 * play) — replaces the earlier flat 150 * 1.10^n curve, which produced
 * P75/P100 timelines of decades and was explicitly rejected.
 *
 * The player only ever pays THIS function's return value (the cost of the
 * single next level) — never a cumulative sum. See getPrestigeUpgradeCost's
 * own callers (GameEngine.upgradePrestige, ui/EconomyStatsPanel.tsx).
 */
const PRESTIGE_BASE_COST_GEMS = 5;
const PRESTIGE_COST_GROWTH_FACTOR = 1.07;
const PRESTIGE_COST_COMPOUND_LEVEL_CAP = 50;
const PRESTIGE_COST_LINEAR_TAIL_GROWTH = Math.log(PRESTIGE_COST_GROWTH_FACTOR);

/**
 * Gem cost to go from `currentLevel` to `currentLevel + 1`. No max level —
 * compounds up to PRESTIGE_COST_COMPOUND_LEVEL_CAP, then continues as a
 * purely linear tail (continuous slope at the cap, no price cliff, no
 * Math.pow overflow at extreme levels) — the exact same shape as
 * config/towerMastery.ts's getMasteryUpgradeCost and
 * config/specializations.ts's getSpecializationUpgradeCost.
 */
export function getPrestigeUpgradeCost(currentLevel: number): number {
  const targetLevel = currentLevel + 1;
  const cappedLevel = Math.min(targetLevel, PRESTIGE_COST_COMPOUND_LEVEL_CAP);
  const compound = Math.pow(PRESTIGE_COST_GROWTH_FACTOR, cappedLevel);
  const tailLevels = Math.max(0, targetLevel - PRESTIGE_COST_COMPOUND_LEVEL_CAP);
  const linearTail = 1 + tailLevels * PRESTIGE_COST_LINEAR_TAIL_GROWTH;
  return Math.round(PRESTIGE_BASE_COST_GEMS * compound * linearTail) + targetLevel;
}

/** GEMS ECONOMY v2 — dual price to go from `currentLevel` to `currentLevel + 1`, derived from getPrestigeUpgradeCost (config/gemsEconomy.ts's own methodology). */
export function getPrestigeUpgradeDualPrice(currentLevel: number): DualGemPrice {
  return dualGemPrice(getPrestigeUpgradeCost(currentLevel));
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

// ---------------------------------------------------------------------------
// Prestige milestone rewards — FASE 6. A small, deliberately sparse set of
// cosmetic/status rewards ("poucas recompensas cosméticas realmente
// especiais para preservar o valor das skins pagas" — never a mass grant).
// PROFILE_FRAME/TITLE are purely derived from prestigeLevel (no separate
// grant/state needed — Prestige never decreases, so "prestigeLevel >= 30"
// is itself a permanent, idempotent unlock check). TOWER_SKIN/CASTLE_SKIN
// reuse the existing ownedTowerSkinIds/unlockedCastleSkinIds architecture —
// see config/towerSkins.ts's PRESTIGE_TOWER_SKINS, config/castleSkins.ts's
// PRESTIGE_CASTLE_SKIN_ID, and GameEngine.grantPrestigeMilestoneRewards.
// ---------------------------------------------------------------------------

export type PrestigeRewardType = "PROFILE_FRAME" | "TITLE" | "TOWER_SKIN" | "CASTLE_SKIN";

export interface PrestigeMilestoneReward {
  level: number;
  type: PrestigeRewardType;
  /** i18n key suffix — full key is `prestige.rewards.<id>.name` / `.description`. */
  id: string;
}

export const PRESTIGE_MILESTONE_REWARDS: readonly PrestigeMilestoneReward[] = [
  { level: 10, type: "PROFILE_FRAME", id: "bronzeFrame" },
  { level: 20, type: "PROFILE_FRAME", id: "silverFrame" },
  { level: 30, type: "TITLE", id: "ascendantTitle" },
  { level: 50, type: "TOWER_SKIN", id: "prestigeTowerSkin" },
  { level: 75, type: "PROFILE_FRAME", id: "radiantEffect" },
  { level: 100, type: "CASTLE_SKIN", id: "prestigeCastleSkin" },
];

/** The milestone reward defined for exactly this level, or null if this level grants no reward. */
export function getPrestigeMilestoneReward(level: number): PrestigeMilestoneReward | null {
  return PRESTIGE_MILESTONE_REWARDS.find((r) => r.level === level) ?? null;
}

/** Every milestone reward already earned (permanently) at `prestigeLevel` — used to render frame/title/skin status in UI. */
export function getEarnedPrestigeMilestoneRewards(prestigeLevel: number): readonly PrestigeMilestoneReward[] {
  return PRESTIGE_MILESTONE_REWARDS.filter((r) => r.level <= prestigeLevel);
}

/** The next not-yet-reached milestone reward past `prestigeLevel`, or null once every reward is earned. */
export function getNextPrestigeMilestoneReward(prestigeLevel: number): PrestigeMilestoneReward | null {
  return PRESTIGE_MILESTONE_REWARDS.find((r) => r.level > prestigeLevel) ?? null;
}
