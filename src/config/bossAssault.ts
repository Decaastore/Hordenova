import type { TowerType } from "./towerStats";

/**
 * BOSS SIEGE ("Cerco do Chefe") — how a main boss is fought.
 *
 * A main boss still has to be defeated to leave its map (competitive: the
 * best wave always means "beat everything before it"), but no attempt is
 * wasted and no player is ever stuck:
 *
 *  - WOUNDS STAY. A boss that isn't killed retreats with the damage it
 *    took and only recovers BOSS_RETREAT_RECOVERY of its max HP before the
 *    next assault. Every assault brings it closer to death. A boss that
 *    comes back below its enrage threshold is exhausted and doesn't enrage.
 *  - THE GAME DOESN'T STOP. After a retreat the map is "under siege": the
 *    last SIEGE_WAVES regular waves before the boss are played again (they
 *    pay Gold, missions and Pass XP as usual), then the boss attacks again.
 *  - BEING THERE PAYS. During an assault, runes light up beside the road;
 *    clicking one strikes the boss for RUNE_STRIKE_FRACTION of its max HP.
 *    An idle player still wins over a few assaults; an attentive one wins
 *    sooner.
 *  - STRATEGY PAYS. Every boss has a weakness: one tower type hits it
 *    harder and ignores its ability shield (shown when the boss arrives).
 *  - COMPETITIVE. Killing a boss on its first assault pays a bonus; the
 *    number of assaults each boss took is recorded for the Season.
 */

export const BOSS_RETREAT_RECOVERY = 0.1;
export const SIEGE_WAVES = 3;

export const RUNE_INTERVAL_MS = 9000;
export const RUNE_LIFETIME_MS = 3500;
export const RUNE_STRIKE_FRACTION = 0.03;
/** Click radius around a rune, in world units. */
export const RUNE_HIT_RADIUS = 26;

/**
 * Main-boss HP follows the regular waves instead of its own curve: it is
 * MAIN_BOSS_HP_VS_PREVIOUS_WAVE times the total HP of the wave right before
 * it. Whatever the difficulty curve does, a build that clears the waves
 * leading up to a boss brings it down in about 3 assaults (measured with a
 * greedy-bot simulation that never clicks runes) — so bosses are milestones
 * on the curve, never walls above it. BOSS_HP_TWEAK corrects bosses whose
 * ability measured clearly tougher than the rest.
 */
export const MAIN_BOSS_HP_VS_PREVIOUS_WAVE = 0.85;
export const BOSS_HP_TWEAK: Record<string, number> = {
  "abyssal-maw": 0.7,
  "iron-burrower-sovereign": 0.75,
};

export function mainBossHp(bossId: string, previousWaveTotalHp: number): number {
  return Math.max(1, Math.round(previousWaveTotalHp * MAIN_BOSS_HP_VS_PREVIOUS_WAVE * (BOSS_HP_TWEAK[bossId] ?? 1)));
}

/** Damage multiplier of the boss's weakness tower, which also ignores the boss's SHIELD ability. */
export const WEAKNESS_DAMAGE_MULTIPLIER = 1.3;

export const FIRST_ASSAULT_GOLD_MULTIPLIER = 1.5;
export const FIRST_ASSAULT_BONUS_SHARDS = 3;

/** Which tower each main boss is weak to — chosen to read naturally (fire melts ice, frost cools magma, lightning chains through summons...). */
export const BOSS_WEAKNESS: Record<string, TowerType> = {
  "hollow-warden": "INFERNO",
  "molten-colossus": "FROSTBORN",
  "glacial-sovereign": "INFERNO",
  "sand-devourer": "STORMCALLER",
  "grave-tyrant": "IRONWOOD",
  "abyssal-maw": "STORMCALLER",
  "iron-burrower-sovereign": "STORMCALLER",
  "ancestral-colossus": "IRONWOOD",
  "aether-drake-elder": "IRONWOOD",
  "raithar-ascendant": "INFERNO",
  "crystal-behemoth-prime": "IRONWOOD",
  "abyssal-warden-eternal": "FROSTBORN",
  "ashen-colossus-forsaken": "FROSTBORN",
  "moonroot-matriarch-elder": "INFERNO",
  "cathedral-abomination-apex": "STORMCALLER",
  "leviathan-elder": "STORMCALLER",
};

export function bossWeakness(bossId: string): TowerType | null {
  return BOSS_WEAKNESS[bossId] ?? null;
}

/** Saved while a main boss is alive and has been fought at least once. */
export interface BossSiegeState {
  /** The boss wave this siege belongs to. */
  wave: number;
  /** Boss HP left, as a fraction of max (0..1), at the start of the next assault. */
  hpFraction: number;
  /** Assaults already fought (0 before the first one ends). */
  assaults: number;
}

export function parseBossSiegeState(raw: unknown): BossSiegeState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<BossSiegeState>;
  if (typeof r.wave !== "number" || typeof r.hpFraction !== "number" || typeof r.assaults !== "number") return null;
  return { wave: r.wave, hpFraction: Math.min(1, Math.max(0.01, r.hpFraction)), assaults: Math.max(0, Math.floor(r.assaults)) };
}

/** Per Season: assaults each main boss took to fall (keyed by boss wave). */
export interface BossRecords {
  seasonNumber: number;
  assaultsByWave: Record<string, number>;
}

export function parseBossRecords(raw: unknown): BossRecords | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<BossRecords>;
  if (typeof r.seasonNumber !== "number" || !r.assaultsByWave || typeof r.assaultsByWave !== "object") return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.assaultsByWave)) if (typeof v === "number" && v >= 1) out[k] = Math.floor(v);
  return { seasonNumber: r.seasonNumber, assaultsByWave: out };
}
