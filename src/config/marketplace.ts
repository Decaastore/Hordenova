import { dualGemPrice, type DualGemPrice } from "./gemsEconomy";
import type { Rarity } from "./rarity";

/**
 * MARKETPLACE / LEILÃO — economy grounding. Every number below was derived
 * from the REAL Gem sinks/rewards already live in this codebase, not
 * invented in isolation (spec: "analisar a economia atual antes de
 * finalizar valores definitivos"):
 *   - Real one-time Gem purchases today: SPECIALIZATION_UNLOCK_GEM_COST=500,
 *     SPECIALIZATION_CHANGE_GEM_COST=200, REPOSITION_GEM_COST=200, item slot
 *     unlocks 250/500 (towerItemSlots.ts). FASE 6: Tower Mastery moved off
 *     Gems entirely (unlock included, now Gold — see towerMastery.ts).
 *   - Real cosmetic Gem purchases: Tower/Castle Skins at 120/350/800 Gems
 *     (towerSkins.ts), Prestige starting at 5 Gems and climbing (prestige.ts).
 * A single MYTHIC drop (the rarest real item in the game, 0.1% drop weight)
 * sits near the top of that existing spending band (~1000 Gems) as its
 * auction ENTRY DOOR — never its "value". The market (bidding) decides the
 * real price; this is only the accessible minimum needed to block a
 * joke/zero-effort listing (spec sections 6/7/24).
 */
export const AUCTION_MIN_BID_BY_RARITY: Record<Rarity, number> = {
  COMMON: 20,
  UNCOMMON: 50,
  RARE: 120,
  EPIC: 250,
  LEGENDARY: 500,
  MYTHIC: 1000,
};

/**
 * Listing fee — a small currency sink / anti-spam deterrent (spec section
 * 8), never large enough to discourage using the Marketplace at all. Set at
 * roughly the same ~5-8% ratio as the user's own worked example (100 Gems
 * fee on a 2000 Gems minimum bid), scaled per rarity tier.
 *
 * This is the PURCHASED-Gems anchor only. LISTING (selling) is dual-priced
 * like every other system in the game — see `getAuctionListingFeeDualPrice`
 * below — because selling an item you own carries no Purchased-Gems
 * requirement: a pure F2P seller must be able to list using only Free Gems,
 * per the economy spec's explicit worked example (F2P unlocks Trade with
 * Free Gems, lists a Mythic item, sells it, receives Purchased Gems from
 * the buyer). Only BUYING another player's item is Purchased-Gems-only.
 */
export const AUCTION_LISTING_FEE_BY_RARITY: Record<Rarity, number> = {
  COMMON: 3,
  UNCOMMON: 5,
  RARE: 10,
  EPIC: 20,
  LEGENDARY: 40,
  MYTHIC: 75,
};

export const AUCTION_DURATION_HOURS = [12, 24, 48, 72] as const;
export type AuctionDurationHours = (typeof AUCTION_DURATION_HOURS)[number];

const HOUR_MS = 60 * 60 * 1000;

export function getAuctionDurationMs(hours: AuctionDurationHours): number {
  return hours * HOUR_MS;
}

/** Spec section 15 — a bid placed inside this window extends the auction. */
export const ANTI_SNIPE_WINDOW_MS = 2 * 60 * 1000;
/** How much extra time an anti-snipe bid grants — same 2-minute figure, configurable independently of the window itself. */
export const ANTI_SNIPE_EXTENSION_MS = 2 * 60 * 1000;

const MIN_BID_INCREMENT_PERCENT = 0.05;
const MIN_BID_INCREMENT_FLOOR_GEMS = 10;

/**
 * The smallest a NEW bid may be, given the current highest bid (or the
 * listing's own minBid if nothing has been bid yet) — spec's "próximo lance
 * mínimo" field shown on every card/detail view. Rounded up to a clean
 * multiple of 5 Gems so the UI never shows an ugly fractional number.
 */
export function getMinimumNextBid(currentBidOrMinBid: number): number {
  const step = Math.max(MIN_BID_INCREMENT_FLOOR_GEMS, Math.ceil(currentBidOrMinBid * MIN_BID_INCREMENT_PERCENT));
  const raw = currentBidOrMinBid + step;
  return Math.ceil(raw / 5) * 5;
}

export function getAuctionMinBid(rarity: Rarity): number {
  return AUCTION_MIN_BID_BY_RARITY[rarity];
}

export function getAuctionListingFee(rarity: Rarity): number {
  return AUCTION_LISTING_FEE_BY_RARITY[rarity];
}

/** Dual-priced listing fee — the seller picks either currency; see `AUCTION_LISTING_FEE_BY_RARITY`'s own comment for why selling has no Purchased-Gems requirement. */
export function getAuctionListingFeeDualPrice(rarity: Rarity): DualGemPrice {
  return dualGemPrice(getAuctionListingFee(rarity));
}

/**
 * Local-only demonstration bidder identity (see engine/AuctionManager.ts's
 * own header for the full rationale). Reserved id prefix — any bidderId
 * starting with this string is recognized everywhere as NOT a real account,
 * so settlement never moves real Gems for it. A stable, single id (rather
 * than one per click) keeps bid history readable across a whole auction.
 */
export const DEMO_BIDDER_ID = "demo-bidder";

export function isDemoBidder(bidderId: string): boolean {
  return bidderId === DEMO_BIDDER_ID;
}
