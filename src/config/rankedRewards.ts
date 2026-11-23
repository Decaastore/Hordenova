import type { RewardPart } from "./seasonPass";
import type { TowerType } from "./towerStats";
import { SEASON_DURATION_MS, SEASON_EPOCH_MS } from "@/engine/SeasonClock";

/**
 * RANKING PRIZES (owner's call, Nov 2026) — what the top of each ranking
 * wins at the end of its period:
 *
 *  - SEASON: every Season (30 days), places 1-20; the richest prizes go to
 *    the top 5, who also win the full "Estandarte Real" set (castle + the
 *    four towers). Places 6-10 win the castle; 11-20 win Gems.
 *  - DUEL: every calendar month, places 1-10; the top 10 win the full
 *    "Coroa da Arena" set.
 *  - ETERNAL: once a year (calendar year), places 1-10; the top 10 win the
 *    full "Eternidade" set. The biggest Gem prizes in the game.
 *
 * The skins exist ONLY here (config/towerSkins.ts RANKED_TOWER_SKINS,
 * config/castleSkins.ts source RANKED): never sold, never in a bundle.
 *
 * Gems are FREE Gems, never Purchased Gems: Purchased Gems are only ever
 * bought with money (they're what the Marketplace and trades run on), so no
 * prize can create them.
 *
 * A placement is only ever real: prizes are granted from the online
 * ranking's final standings (engine/RankedRewardsService.ts). Offline there
 * is no placement, so no placement prize — never a "you are #1" by default.
 */
export type RankedBoard = "SEASON" | "DUEL" | "ETERNAL";

export interface RankedSet {
  castle: string;
  towers: Record<TowerType, string>;
}

export const RANKED_SETS: Record<RankedBoard, RankedSet> = {
  ETERNAL: {
    castle: "ETERNITY_CITADEL",
    towers: { IRONWOOD: "IRONWOOD_ETERNAL_RANK", INFERNO: "INFERNO_ETERNAL_RANK", FROSTBORN: "FROSTBORN_ETERNAL_RANK", STORMCALLER: "STORMCALLER_ETERNAL_RANK" },
  },
  DUEL: {
    castle: "ARENA_COLOSSEUM",
    towers: { IRONWOOD: "IRONWOOD_ARENA_RANK", INFERNO: "INFERNO_ARENA_RANK", FROSTBORN: "FROSTBORN_ARENA_RANK", STORMCALLER: "STORMCALLER_ARENA_RANK" },
  },
  SEASON: {
    castle: "ROYAL_STANDARD_KEEP",
    towers: { IRONWOOD: "IRONWOOD_SEASON_RANK", INFERNO: "INFERNO_SEASON_RANK", FROSTBORN: "FROSTBORN_SEASON_RANK", STORMCALLER: "STORMCALLER_SEASON_RANK" },
  },
};

export interface RankedPrizeTier {
  /** First and last place this tier covers (inclusive). */
  from: number;
  to: number;
  freeGems: number;
  /** FULL = castle + the four tower skins; CASTLE = the set's castle only. */
  set: "FULL" | "CASTLE" | null;
}

export const RANKED_PRIZES: Record<RankedBoard, readonly RankedPrizeTier[]> = {
  ETERNAL: [
    { from: 1, to: 1, freeGems: 20000, set: "FULL" },
    { from: 2, to: 2, freeGems: 15000, set: "FULL" },
    { from: 3, to: 3, freeGems: 12000, set: "FULL" },
    { from: 4, to: 4, freeGems: 9000, set: "FULL" },
    { from: 5, to: 5, freeGems: 7000, set: "FULL" },
    { from: 6, to: 10, freeGems: 4000, set: "FULL" },
  ],
  DUEL: [
    { from: 1, to: 1, freeGems: 5000, set: "FULL" },
    { from: 2, to: 2, freeGems: 3500, set: "FULL" },
    { from: 3, to: 3, freeGems: 2500, set: "FULL" },
    { from: 4, to: 4, freeGems: 1800, set: "FULL" },
    { from: 5, to: 5, freeGems: 1400, set: "FULL" },
    { from: 6, to: 10, freeGems: 800, set: "FULL" },
  ],
  SEASON: [
    { from: 1, to: 1, freeGems: 4000, set: "FULL" },
    { from: 2, to: 2, freeGems: 3000, set: "FULL" },
    { from: 3, to: 3, freeGems: 2200, set: "FULL" },
    { from: 4, to: 4, freeGems: 1600, set: "FULL" },
    { from: 5, to: 5, freeGems: 1200, set: "FULL" },
    { from: 6, to: 10, freeGems: 600, set: "CASTLE" },
    { from: 11, to: 20, freeGems: 300, set: null },
  ],
};

/** The last place that wins anything on this board. */
export function lastPrizePlace(board: RankedBoard): number {
  const tiers = RANKED_PRIZES[board];
  return tiers[tiers.length - 1]!.to;
}

export function rankedPrizeTier(board: RankedBoard, place: number): RankedPrizeTier | null {
  if (!Number.isInteger(place) || place < 1) return null;
  return RANKED_PRIZES[board].find((t) => place >= t.from && place <= t.to) ?? null;
}

/** Everything a place wins, as reward parts (Free Gems + skins). */
export function rankedPrizeParts(board: RankedBoard, place: number): RewardPart[] | null {
  const tier = rankedPrizeTier(board, place);
  if (!tier) return null;
  const set = RANKED_SETS[board];
  const parts: RewardPart[] = [{ kind: "GEMS", amount: tier.freeGems }];
  if (tier.set) parts.push({ kind: "CASTLE_SKIN", skinId: set.castle });
  if (tier.set === "FULL") for (const id of Object.values(set.towers)) parts.push({ kind: "SKIN", skinId: id });
  return parts;
}

/** Which board a ranking-prize skin (tower or castle) belongs to. */
export function rankedBoardForSkin(skinId: string): RankedBoard | null {
  for (const board of Object.keys(RANKED_SETS) as RankedBoard[]) {
    const set = RANKED_SETS[board];
    if (set.castle === skinId || Object.values(set.towers).includes(skinId)) return board;
  }
  return null;
}

export interface RankedPeriod {
  /** Stable id of the period ("2026", "2026-11", "season-23"), used to grant each period once. */
  key: string;
  endsAtMs: number;
}

/**
 * The period a board is in at `nowMs`. ETERNAL runs by calendar year and DUEL
 * by calendar month, both in Brasília time (UTC-3); SEASON follows the Season
 * clock (30 days).
 */
export function rankedPeriod(board: RankedBoard, nowMs: number): RankedPeriod {
  const BRT = 3 * 60 * 60 * 1000;
  const local = new Date(nowMs - BRT);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  if (board === "ETERNAL") return { key: `${y}`, endsAtMs: Date.UTC(y + 1, 0, 1) + BRT };
  if (board === "DUEL") return { key: `${y}-${String(m + 1).padStart(2, "0")}`, endsAtMs: Date.UTC(y, m + 1, 1) + BRT };
  const n = Math.floor((nowMs - SEASON_EPOCH_MS) / SEASON_DURATION_MS) + 1;
  return { key: `season-${n}`, endsAtMs: SEASON_EPOCH_MS + n * SEASON_DURATION_MS };
}
