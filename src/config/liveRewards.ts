import type { RewardPart } from "./seasonPass";

/**
 * RECOMPENSAS DA LIVE — viewers who watch an approved creator play HORDE
 * NOVA live earn Live Points on their game account and trade them on the
 * site for exclusive looks and materials (owner's call, Nov 2026).
 *
 * How it works (supabase/migrations/0003_creators_and_live.sql and
 * supabase/functions/live-watch):
 *  1. The viewer links their Twitch account to their HORDE NOVA account
 *     (Supabase's Twitch sign-in, linked to the same account).
 *  2. Every WATCH_TICK_MINUTES, the server function asks Twitch which
 *     approved creators are live in the HORDE NOVA category and who is in
 *     their chat, and credits WATCH_TICK_POINTS to every linked viewer there
 *     (at most DAILY_WATCH_POINTS_CAP a day).
 *  3. The viewer redeems points here; the server checks the balance and
 *     records the redemption before the reward reaches the save.
 *
 * Points are kept on the server only — never on the player's device, or
 * anyone could give themselves points. That's why all of this stays off
 * (LIVE_REWARDS_ENABLED = false, and the site shows none of it) until the
 * online server and the Twitch app are set up.
 */
export const LIVE_REWARDS_ENABLED = false;

export const WATCH_TICK_MINUTES = 5;
export const WATCH_TICK_POINTS = 10;
/** About 2½ hours of watching a day. */
export const DAILY_WATCH_POINTS_CAP = 300;

export interface LiveReward {
  id: string;
  cost: number;
  /** What the account gets (applied with engine/RewardGrant.ts, or a Duel look). */
  parts?: readonly RewardPart[];
  duelLook?: string;
  /** Can be redeemed only once per account. */
  once?: boolean;
}

/**
 * The catalogue. Looks are exclusive to the live (never sold); materials are
 * modest — no Gems and nothing that gives a paid edge, no surprise boxes.
 */
export const LIVE_REWARDS: readonly LiveReward[] = [
  { id: "LIVE_BANNER", cost: 600, duelLook: "BANNER_LIVE", once: true },
  { id: "LIVE_FRAME", cost: 1200, duelLook: "FRAME_LIVE", once: true },
  { id: "LIVE_KILL_FX", cost: 2400, duelLook: "KILL_LIVE", once: true },
  { id: "LIVE_SHARDS", cost: 150, parts: [{ kind: "SHARDS", amount: 10 }] },
  { id: "LIVE_ITEM", cost: 400, parts: [{ kind: "ITEM", rarity: "UNCOMMON" }] },
];

export function getLiveReward(id: string): LiveReward | null {
  return LIVE_REWARDS.find((r) => r.id === id) ?? null;
}

/** Points a viewer earns for `minutes` of watching today, given what they already earned today. */
export function watchPoints(minutes: number, earnedToday: number): number {
  const ticks = Math.floor(Math.max(0, minutes) / WATCH_TICK_MINUTES);
  return Math.max(0, Math.min(ticks * WATCH_TICK_POINTS, DAILY_WATCH_POINTS_CAP - Math.max(0, earnedToday)));
}
