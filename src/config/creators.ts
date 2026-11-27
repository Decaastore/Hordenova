/**
 * PROGRAMA DE CRIADORES — streamers and creators who promote HORDE NOVA earn
 * a share of what their audience spends (owner's call, Nov 2026).
 *
 * How it works:
 *  - A creator applies on the Creators page (it opens a Support ticket);
 *    the owner approves it, and the creator's code is added to CREATORS
 *    below. Nobody gets a code without that approval.
 *  - A player types the code in the Store (or opens the creator's link,
 *    hordenova…/?criador=CODE) and it stays on the account until changed.
 *  - The player gets, for using a code: the Supporter Banner and Frame (Duel
 *    looks, earned only) and +CREATOR_PURCHASE_BONUS_PCT % Purchased Gems on
 *    every real-money purchase made with the code. They pay nothing extra.
 *  - The creator gets CREATOR_SHARE_TIERS' percentage of every real-money
 *    purchase made with the code, higher as their monthly sales grow.
 *
 * Real-money purchases are not open yet (config/store.ts
 * REAL_MONEY_PAYMENTS_ENABLED); the code, the looks and the checkout payload
 * already work, and every purchase with a code is recorded for the payout
 * the day payments open. The payout itself is settled by the owner from the
 * payment provider's records — never from the player's device.
 */

export type CreatorPlatform = "TWITCH" | "YOUTUBE" | "KICK" | "TIKTOK" | "INSTAGRAM" | "OTHER";

export interface Creator {
  /** What players type: 3–16 letters, digits or _ (stored upper-case). */
  code: string;
  /** The creator's public name, as shown on the Store and the Duel look. */
  name: string;
  platform: CreatorPlatform;
  /** Their channel. */
  channelUrl: string;
  /** Approval date, YYYY-MM-DD. */
  since: string;
}

/**
 * The approved creators. Empty until the owner approves the first one —
 * a code is only ever added here after that approval (never invented).
 */
export const CREATORS: readonly Creator[] = [];

let approved: readonly Creator[] = CREATORS;

/** The approved creators the game knows right now (the list above, or the server's once it's on). */
export function approvedCreators(): readonly Creator[] {
  return approved;
}

/** Replaces the approved list — the day the online server is on, with its `creators` table (status APPROVED). */
export function setApprovedCreators(list: readonly Creator[]): void {
  approved = list;
}

/** What a creator earns of each purchase made with their code, by their sales in the calendar month (BRL). */
export interface CreatorShareTier {
  id: "START" | "PARTNER" | "ELITE";
  /** Sales with the code in the month, from this amount up. */
  minMonthlySalesBrl: number;
  pct: number;
}
export const CREATOR_SHARE_TIERS: readonly CreatorShareTier[] = [
  { id: "START", minMonthlySalesBrl: 0, pct: 5 },
  { id: "PARTNER", minMonthlySalesBrl: 1000, pct: 10 },
  { id: "ELITE", minMonthlySalesBrl: 5000, pct: 15 },
];

/** Extra Purchased Gems for the player on every real-money purchase made with a creator code. */
export const CREATOR_PURCHASE_BONUS_PCT = 5;

/** Duel looks a player earns by using any creator's code (config/duel.ts, earned only). */
export const SUPPORTER_LOOKS = ["BANNER_SUPPORTER", "FRAME_SUPPORTER"] as const;

/** A creator must be an adult to receive payouts (same rule as real-money purchases). */
export const CREATOR_MIN_AGE = 18;

const CODE_RE = /^[A-Z0-9_]{3,16}$/;

/** The code as stored and compared: trimmed, upper-case, no spaces. Null if it can't be a code. */
export function normalizeCreatorCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  return CODE_RE.test(code) ? code : null;
}

/** The approved creator behind a code (any case), or null. */
export function findCreator(raw: string | null | undefined, list: readonly Creator[] = approved): Creator | null {
  if (!raw) return null;
  const code = normalizeCreatorCode(raw);
  if (!code) return null;
  return list.find((c) => c.code.toUpperCase() === code) ?? null;
}

/** The share tier for a creator's sales this month. */
export function creatorShareTier(monthlySalesBrl: number): CreatorShareTier {
  let tier = CREATOR_SHARE_TIERS[0]!;
  for (const t of CREATOR_SHARE_TIERS) if (monthlySalesBrl >= t.minMonthlySalesBrl) tier = t;
  return tier;
}

/** A creator's payout for a month, in BRL (to the cent): the month's tier applies to all of that month's sales. */
export function creatorMonthlyPayout(monthlySalesBrl: number): number {
  const sales = Math.max(0, monthlySalesBrl);
  return Math.round(sales * creatorShareTier(sales).pct) / 100;
}

/** The player's extra Purchased Gems for a purchase of `gems` made with a creator code. */
export function creatorBonusGems(gems: number): number {
  return Math.floor((gems * CREATOR_PURCHASE_BONUS_PCT) / 100);
}
