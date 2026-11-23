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
  /** A one-of-a-kind relic (config/itemDefinitions.ts, source RANKED): account-bound, never sold, fused or dropped. */
  relic?: string;
  /** Duel looks (config/duel.ts DUEL_SHOP, earned-only): banners, card frames, kill effects — worn in the Duel and the Eternal castle. */
  looks?: readonly string[];
  /** Duel Coins (they only buy Duel looks — no power). */
  duelCoins?: number;
}

/**
 * GEM PRIZES — sized by the purchasing-power check in rankedRewards.test.ts
 * (owner's call, Nov 2026: the first numbers were far too high). The yardstick
 * is what an active free player earns in Free Gems (ACTIVE_FREE_GEMS_PER_MONTH):
 * a monthly #1 gets about 3 months of that, the yearly Eternal #1 about a
 * year's worth — never enough to empty the Store's skin catalogue, and only a
 * small share of what the daily Forge offers could turn into power. What makes
 * a place worth chasing is what can't be bought: the exclusive collection, the
 * relics and the Duel looks.
 */
export const RANKED_PRIZES: Record<RankedBoard, readonly RankedPrizeTier[]> = {
  ETERNAL: [
    { from: 1, to: 1, freeGems: 2500, set: "FULL", relic: "immortal_hourglass", looks: ["BANNER_ETERNITY", "KILL_STARDUST"] },
    { from: 2, to: 2, freeGems: 2000, set: "FULL", relic: "eternal_sand", looks: ["BANNER_ETERNITY", "KILL_STARDUST"] },
    { from: 3, to: 3, freeGems: 1600, set: "FULL", relic: "eternal_sand", looks: ["BANNER_ETERNITY", "KILL_STARDUST"] },
    { from: 4, to: 4, freeGems: 1300, set: "FULL", looks: ["KILL_STARDUST"] },
    { from: 5, to: 5, freeGems: 1100, set: "FULL", looks: ["KILL_STARDUST"] },
    { from: 6, to: 10, freeGems: 800, set: "FULL", looks: ["KILL_STARDUST"] },
  ],
  DUEL: [
    { from: 1, to: 1, freeGems: 600, set: "FULL", looks: ["BANNER_ARENA_KING", "FRAME_ARENA_CROWN", "KILL_LAUREL"], duelCoins: 1500 },
    { from: 2, to: 2, freeGems: 480, set: "FULL", looks: ["FRAME_ARENA_CROWN", "KILL_LAUREL"], duelCoins: 1100 },
    { from: 3, to: 3, freeGems: 400, set: "FULL", looks: ["FRAME_ARENA_CROWN", "KILL_LAUREL"], duelCoins: 900 },
    { from: 4, to: 4, freeGems: 320, set: "FULL", looks: ["FRAME_ARENA_CROWN"], duelCoins: 600 },
    { from: 5, to: 5, freeGems: 280, set: "FULL", looks: ["FRAME_ARENA_CROWN"], duelCoins: 500 },
    { from: 6, to: 10, freeGems: 180, set: "FULL", looks: ["FRAME_ARENA_CROWN"], duelCoins: 300 },
  ],
  SEASON: [
    { from: 1, to: 1, freeGems: 500, set: "FULL" },
    { from: 2, to: 2, freeGems: 420, set: "FULL" },
    { from: 3, to: 3, freeGems: 350, set: "FULL" },
    { from: 4, to: 4, freeGems: 300, set: "FULL" },
    { from: 5, to: 5, freeGems: 260, set: "FULL" },
    { from: 6, to: 10, freeGems: 160, set: "CASTLE" },
    { from: 11, to: 20, freeGems: 80, set: null },
  ],
};

/**
 * What an ACTIVE free player earns in Free Gems a month, from the game's own
 * sources (each value is read from its config): the Store's daily gift, the
 * three daily missions (12 Shards ≈ 1.2 Gems), the Colossus (1 a day + 3 a
 * week), the 7-day login (2 a week), Duel wins (5 Shards a day), about ten
 * boss/mini-boss kills a day (2 Shards each) and the Season Pass free track.
 * The yardstick for every ranking Gem prize — see the test.
 */
export const ACTIVE_FREE_GEMS_PER_DAY = 1 + 1.2 + 1 + 3 / 7 + 2 / 7 + 0.5 + 2 + 29 / 30;
export const ACTIVE_FREE_GEMS_PER_MONTH = Math.round(ACTIVE_FREE_GEMS_PER_DAY * 30);

/** The title a placement earns ("Imortal", "Campeão da Arena"…), shown on the profile and next to the name. */
export type RankedTitleId = "ETERNAL_1" | "ETERNAL_TOP3" | "ETERNAL_TOP10" | "DUEL_1" | "DUEL_TOP3" | "DUEL_TOP10" | "SEASON_1" | "SEASON_TOP5" | "SEASON_TOP20";
export function rankedTitleFor(board: RankedBoard, place: number): RankedTitleId | null {
  if (place < 1 || place > lastPrizePlace(board)) return null;
  if (board === "ETERNAL") return place === 1 ? "ETERNAL_1" : place <= 3 ? "ETERNAL_TOP3" : "ETERNAL_TOP10";
  if (board === "DUEL") return place === 1 ? "DUEL_1" : place <= 3 ? "DUEL_TOP3" : "DUEL_TOP10";
  return place === 1 ? "SEASON_1" : place <= 5 ? "SEASON_TOP5" : "SEASON_TOP20";
}
const BOARD_WEIGHT: Record<RankedBoard, number> = { ETERNAL: 3, DUEL: 2, SEASON: 1 };
/** The most prestigious of a player's trophies (best place first, then Eternal > Duel > Season, then the newest). */
export function bestTrophy<T extends { board: RankedBoard; place: number; atMs: number }>(trophies: readonly T[]): T | null {
  return [...trophies].sort((a, b) => a.place - b.place || BOARD_WEIGHT[b.board] - BOARD_WEIGHT[a.board] || b.atMs - a.atMs)[0] ?? null;
}

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
