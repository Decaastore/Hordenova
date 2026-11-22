import type { Rarity } from "./rarity";
import { isVipActive, type VipState } from "./shopOffers";
import { PHASES } from "./phaseConfig";

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
 * Paid in Purchased Gems only, like every Marketplace charge (see
 * marketTierFor below).
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

/**
 * Trading between players needs the online server (another player has to be
 * there to buy). Until it exists, unlocking Trading is closed so nobody pays
 * Gems for a market with no one else in it.
 */
export const MARKETPLACE_SERVER_ONLINE = false;
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

/**
 * THE AUCTION HOUSE (leilão) is for VIP players only — a real-money
 * subscription (config/shopOffers.ts). Listing and bidding need it; when VIP
 * lapses, running auctions still finish, but nothing new can be listed or
 * bid on. Every fee is Purchased Gems only; each sale pays
 * AUCTION_SALE_TAX_PERCENT; at most AUCTION_WEEKLY_LISTING_LIMIT listings per
 * 7 days.
 */
export function hasMarketAccess(vip: VipState, nowMs: number): boolean {
  return isVipActive(vip, nowMs);
}

export const AUCTION_SALE_TAX_PERCENT = 10;
export const AUCTION_WEEKLY_LISTING_LIMIT = 10;

/**
 * DIRECT TRADES (troca entre 2 pessoas) are open to everyone (owner's call,
 * Nov 2026), so a free player can trade a good item to a paying player for
 * Purchased Gems. Only Purchased Gems move in a trade — every one of them was
 * bought with real money by somebody — and Free Gems never enter it.
 *
 * BALANCED WITH THE AUCTION HOUSE, so neither is a way around the other:
 *  - the same price floor: Gems paid for items are at least those items'
 *    auction minimum bid, and at most TRADE_MAX_OVER_FLOOR times it (no
 *    hidden Gem gifts); an item-for-item swap must be within
 *    TRADE_SWAP_MAX_RATIO of each other (no gifting a Mythic away);
 *  - the same fee: whoever sells an item for Gems pays that item's auction
 *    listing fee, out of the Gems received;
 *  - the same tax for a VIP (10%) as in the auction; 20% for everyone else;
 *  - one weekly cap shared by auction listings and Gem trades: 10 for a
 *    VIP, 3 for everyone else;
 *  - non-VIP players must have cleared phase FREE_TRADER_MIN_PHASE first
 *    (keeps throwaway farm accounts out).
 * The Gems received buy what Purchased Gems already buy (skins, offers,
 * room) and the VIP itself (config/shopOffers.ts VIP_GEM_PRICE).
 * Bundle-exclusive skins stay real-money only.
 */
export interface TradeTier {
  /** Can trade at all. */
  open: boolean;
  vip: boolean;
  /** Sales (auction listings + trades in which this player receives Gems) per rolling 7 days. */
  weeklyLimit: number;
  /** Share of the Gems received kept by the house. */
  taxPercent: number;
}

export const FREE_TRADER_TAX_PERCENT = 20;
export const FREE_TRADER_WEEKLY_SALES = 3;
/** Non-VIP players must have cleared this phase (its last wave) in any Season. */
export const FREE_TRADER_MIN_PHASE = 5;
/** Gems paid for items may be at most this many times the items' auction floor. */
export const TRADE_MAX_OVER_FLOOR = 10;
/** In an item-for-item swap the richer side may be worth at most this many times the other (by auction floor). */
export const TRADE_SWAP_MAX_RATIO = 2;

export function freeTraderMinWave(): number {
  return PHASES[FREE_TRADER_MIN_PHASE - 1]!.endWave;
}

export function tradeTierFor(player: { vip: VipState; bestWave: number }, nowMs: number): TradeTier {
  if (isVipActive(player.vip, nowMs)) return { open: true, vip: true, weeklyLimit: AUCTION_WEEKLY_LISTING_LIMIT, taxPercent: AUCTION_SALE_TAX_PERCENT };
  return { open: player.bestWave >= freeTraderMinWave(), vip: false, weeklyLimit: FREE_TRADER_WEEKLY_SALES, taxPercent: FREE_TRADER_TAX_PERCENT };
}

/** One side of a trade, valued the auction's way: the sum of its items' minimum bids, plus its Gems. */
export interface TradeSideValue {
  rarities: readonly Rarity[];
  gems: number;
}

export type TradeBalance = { ok: true } | { ok: false; reason: "BELOW_FLOOR" | "ABOVE_CEILING" | "UNEVEN_SWAP" | "EMPTY" };

function floorOf(rarities: readonly Rarity[]): number {
  return rarities.reduce((sum, r) => sum + getAuctionMinBid(r), 0);
}

/** Whether a trade is balanced the same way the auction house is (see the block comment above). */
export function checkTradeBalance(a: TradeSideValue, b: TradeSideValue): TradeBalance {
  const aItems = floorOf(a.rarities), bItems = floorOf(b.rarities);
  if (aItems === 0 && bItems === 0) return { ok: false, reason: "EMPTY" };
  // items one way, Gems (and maybe items) the other: Gems must cover the price gap within floor..ceiling
  for (const [seller, buyer] of [[a, b], [b, a]] as const) {
    const sold = floorOf(seller.rarities) - floorOf(buyer.rarities);
    if (buyer.gems > 0) {
      if (sold <= 0) return { ok: false, reason: "ABOVE_CEILING" };
      if (buyer.gems < sold) return { ok: false, reason: "BELOW_FLOOR" };
      if (buyer.gems > sold * TRADE_MAX_OVER_FLOOR) return { ok: false, reason: "ABOVE_CEILING" };
    }
  }
  if (a.gems === 0 && b.gems === 0) {
    if (aItems === 0 || bItems === 0) return { ok: false, reason: "UNEVEN_SWAP" };
    if (Math.max(aItems, bItems) > Math.min(aItems, bItems) * TRADE_SWAP_MAX_RATIO) return { ok: false, reason: "UNEVEN_SWAP" };
  }
  return { ok: true };
}

/** What a seller receives for `amount` Gems after `taxPercent` (rounded in the house's favour). */
export function auctionSellerProceeds(amount: number, taxPercent: number = AUCTION_SALE_TAX_PERCENT): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const whole = Math.floor(amount);
  return Math.max(0, whole - Math.ceil((whole * taxPercent) / 100));
}

export const AUCTION_LISTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** How many of these timestamps fall in the last 7 days. */
export function salesThisWeek(timestamps: readonly number[], nowMs: number): number {
  return timestamps.filter((t) => nowMs - t < AUCTION_LISTING_WINDOW_MS).length;
}

/** Listings this seller opened in the last 7 days (cancelled ones count too — the slot was used). */
export function listingsThisWeek(listings: readonly { sellerId: string; createdAt: number }[], sellerId: string, nowMs: number): number {
  return listings.filter((l) => l.sellerId === sellerId && nowMs - l.createdAt < AUCTION_LISTING_WINDOW_MS).length;
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
