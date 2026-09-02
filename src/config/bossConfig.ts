import { isBossMilestone } from "./waveConfig";

/**
 * Boss/mini-boss data table — Core Gameplay spec sections 6/7. Only ONE
 * main boss and ONE mini-boss are defined for this phase (per the "first
 * boss can be simple" guidance), but nothing here is boss-count-specific:
 * both are plain BossDefinition entries, so future bosses per biome/phase
 * are just more entries plus a lookup keyed by wave number instead of a
 * single constant.
 */

export type BossAbilityId = "SUMMON" | "SHIELD" | "NONE";

export interface BossDefinition {
  id: string;
  name: string;
  isMainBoss: boolean;
  /** Multiplier applied to a same-wave Brute's scaled HP — the boss's HP baseline. */
  hpMultiplierVsBrute: number;
  damageToBase: number;
  speed: number;
  goldReward: number;
  ability: BossAbilityId;
  abilityIntervalMs: number;
}

/**
 * Main boss — gets the full ceremony (BOSS_INTRO -> BOSS_BATTLE -> VICTORY,
 * see GameEngine). Ability: SUMMON — periodically calls in reinforcements,
 * forcing the player's build to handle the boss AND adds at once rather
 * than just tank-and-spank a big HP bar.
 */
export const MAIN_BOSS: BossDefinition = {
  id: "hollow-warden",
  name: "The Hollow Warden",
  isMainBoss: true,
  hpMultiplierVsBrute: 18,
  damageToBase: 40,
  speed: 26,
  goldReward: 220,
  ability: "SUMMON",
  abilityIntervalMs: 8000,
};

/**
 * Mini-boss — spawns as one extra enemy mixed into a regular wave (no
 * cinematic interruption; see GameEngine.maybeSpawnMiniBoss). Ability:
 * SHIELD — periodic near-invulnerability window, reusing EnemyInstance's
 * existing `damageReduction` field so no new combat-resolution code is
 * needed to support it.
 */
export const MINI_BOSS: BossDefinition = {
  id: "ashfen-warlord",
  name: "Ashfen Warlord",
  isMainBoss: false,
  hpMultiplierVsBrute: 4,
  damageToBase: 20,
  speed: 34,
  goldReward: 60,
  ability: "SHIELD",
  abilityIntervalMs: 6000,
};

/**
 * Example cadence (spec section 6): mini-bosses recur every N waves,
 * skipping any wave that's already a main-boss milestone. Frequency is a
 * single constant today; a future phase can make this vary per biome/phase
 * without touching the calling code, since callers only ever ask
 * `isMiniBossWave(waveNumber)`.
 */
export const MINI_BOSS_INTERVAL_WAVES = 7;

export function isMiniBossWave(waveNumber: number): boolean {
  return waveNumber >= MINI_BOSS_INTERVAL_WAVES && waveNumber % MINI_BOSS_INTERVAL_WAVES === 0 && !isBossMilestone(waveNumber);
}
