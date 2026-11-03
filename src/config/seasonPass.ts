/**
 * SEASON PASS — a 30-level track that resets every Season (30 days,
 * engine/SeasonClock.ts). Pass XP comes from playing: waves cleared,
 * mini-bosses and bosses defeated, and daily missions claimed.
 *
 * Two tracks:
 *  - FREE: Gem Shards on every level, a Free Gem every 10 levels. Works now.
 *  - PREMIUM: a bigger reward on every level. Bought with real money, so it
 *    stays locked ("coming soon") until payments exist — see config/store.ts.
 *
 * Pacing: 40 XP per level, 1,200 XP for the whole track. A player who
 * clears ~25 waves and claims their missions on most days finishes it
 * within the Season.
 */

export const PASS_LEVELS = 30;
export const PASS_XP_PER_LEVEL = 40;

export const PASS_XP = {
  WAVE_CLEARED: 1,
  MINI_BOSS: 3,
  MAIN_BOSS: 20,
  MISSION_CLAIMED: 10,
} as const;
export type PassXpSource = keyof typeof PASS_XP;

export interface PassReward {
  gemShards: number;
  freeGems: number;
}

/** Free track: 3 Shards a level, 10 on every 5th, plus 1 Free Gem on levels 10/20/30. */
export function freeRewardForLevel(level: number): PassReward {
  return { gemShards: level % 5 === 0 ? 10 : 3, freeGems: level % 10 === 0 ? 1 : 0 };
}

/** Premium track (locked until payments exist): Shards on every level and Free Gems on every 5th. */
export function premiumRewardForLevel(level: number): PassReward {
  return { gemShards: level % 5 === 0 ? 25 : 8, freeGems: level % 5 === 0 ? 10 : 0 };
}

export const PREMIUM_PASS_PRICE_BRL = 19.9;

export function passLevelFromXp(xp: number): number {
  return Math.min(PASS_LEVELS, Math.floor(Math.max(0, xp) / PASS_XP_PER_LEVEL));
}

export interface SeasonPassState {
  /** Season number this progress belongs to (engine/SeasonClock.ts); a new Season starts over. */
  seasonNumber: number;
  xp: number;
  /** Free-track levels already claimed. */
  claimedFree: number[];
}

export function freshPassState(seasonNumber: number): SeasonPassState {
  return { seasonNumber, xp: 0, claimedFree: [] };
}

export function parseSeasonPassState(raw: unknown): SeasonPassState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SeasonPassState>;
  if (typeof r.seasonNumber !== "number" || typeof r.xp !== "number") return null;
  const claimedFree = Array.isArray(r.claimedFree) ? r.claimedFree.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= PASS_LEVELS) : [];
  return { seasonNumber: r.seasonNumber, xp: Math.max(0, r.xp), claimedFree: [...new Set(claimedFree)] };
}
