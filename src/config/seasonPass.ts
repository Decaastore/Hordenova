import type { Rarity } from "./rarity";
import type { TowerType } from "./towerStats";
import { TOWER_SKINS } from "./towerSkins";
/**
 * SEASON PASS — a 30-level track that resets every Season (30 days,
 * engine/SeasonClock.ts). Pass XP comes from playing: waves cleared,
 * mini-bosses and bosses defeated, and daily missions claimed.
 *
 * Two tracks:
 *  - FREE: Shards, Gold, items and a few Free Gems (see freeRewardForLevel). Works now.
 *  - PREMIUM: different, richer rewards — Season-exclusive tower skins,
 *    Epic/Legendary items, inventory slots (see premiumRewardForLevel).
 *    Bought with real money, so it stays locked ("coming soon") until
 *    payments exist — see config/store.ts.
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

/**
 * One piece of a reward. Levels mix different kinds so the track keeps
 * offering something new: Gold, Gem Shards, Free Gems, equipment items,
 * extra inventory slots and (premium) tower skins. Items granted by the
 * pass or the Store are account-bound — they can't be sold on the
 * Marketplace, so paid rewards never flood the player-to-player economy.
 */
export type RewardPart =
  | { kind: "SHARDS"; amount: number }
  /** Free Gems. */
  | { kind: "GEMS"; amount: number }
  /** Purchased Gems — only ever part of something paid for (the Store's starter pack). */
  | { kind: "PURCHASED_GEMS"; amount: number }
  /** Gold worth `kills` basic enemies at the player's current wave (so it stays useful at any point of the game). */
  | { kind: "GOLD"; kills: number }
  | { kind: "ITEM"; rarity: Rarity }
  | { kind: "INVENTORY_SLOTS"; amount: number }
  | { kind: "SKIN"; skinId: string };

export type PassReward = readonly RewardPart[];

/**
 * Free track: Shards every level, with something bigger mixed in —
 * Gold every 5 levels (2, 7, 12...), an item on 5/15/25, a Free Gem on
 * 10/20/30 and an Epic item at the end.
 */
export function freeRewardForLevel(level: number): PassReward {
  if (level === 30) return [{ kind: "GEMS", amount: 1 }, { kind: "ITEM", rarity: "EPIC" }];
  if (level % 10 === 0) return [{ kind: "GEMS", amount: 1 }, { kind: "SHARDS", amount: 5 }];
  if (level === 5) return [{ kind: "ITEM", rarity: "UNCOMMON" }];
  if (level === 15 || level === 25) return [{ kind: "ITEM", rarity: "RARE" }];
  if (level % 5 === 2) return [{ kind: "GOLD", kills: 40 }];
  return [{ kind: "SHARDS", amount: 3 }];
}

/** The starter pack's skin (config/store.ts) — kept out of the pass so the two never offer the same skin. */
export const STARTER_PACK_SKIN_ID = "STORMCALLER_THUNDER";

/** The two premium skins of a Season: different towers and different skins every Season (never the starter pack's). */
export function premiumSkinsForSeason(seasonNumber: number): [string, string] {
  const types: TowerType[] = ["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"];
  const pick = (type: TowerType, offset: number) => {
    const list = TOWER_SKINS.filter((sk) => sk.towerType === type && sk.id !== STARTER_PACK_SKIN_ID);
    return list[(Math.floor(seasonNumber / 4) + offset) % list.length]!.id;
  };
  return [pick(types[seasonNumber % 4]!, 0), pick(types[(seasonNumber + 2) % 4]!, 1)];
}

/**
 * Premium track (locked until payments exist): richer and different —
 * two tower skins that change every Season (levels 15 and 30), Epic and
 * Legendary items, extra inventory slots, Gems and Gold. On every level it
 * offers a different kind of reward than the free track does.
 */
export function premiumRewardForLevel(level: number, seasonNumber: number): PassReward {
  const [skinA, skinB] = premiumSkinsForSeason(seasonNumber);
  if (level === 30) return [{ kind: "SKIN", skinId: skinB }, { kind: "GEMS", amount: 10 }];
  if (level === 15) return [{ kind: "SKIN", skinId: skinA }];
  if (level === 20) return [{ kind: "ITEM", rarity: "LEGENDARY" }];
  if (level === 10) return [{ kind: "ITEM", rarity: "EPIC" }];
  if (level === 5 || level === 25) return [{ kind: "INVENTORY_SLOTS", amount: 5 }];
  // never the same kind of thing as the free track on the same level
  if (level % 5 === 2) return [{ kind: "SHARDS", amount: 10 }];
  if (level % 2 === 0) return [{ kind: "GEMS", amount: 2 }];
  return [{ kind: "GOLD", kills: 60 }];
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
