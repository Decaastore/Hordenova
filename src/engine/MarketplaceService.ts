import { loadSave, updateSave, type SaveData } from "./SaveSystem";
import { appendLedgerEvent } from "./EconomyLedger";
import { getItemDefinition } from "@/config/itemDefinitions";
import { findItem } from "./InventoryManager";
import {
  createAuctionListing,
  getCurrentBidAmount,
  getLeadingBidderId,
  type AuctionListing,
} from "@/entities/Auction";
import {
  canListItemForAuction,
  cancelAuctionListing as cancelAuctionListingPure,
  placeBid as placeBidPure,
  settleAuction as settleAuctionPure,
} from "./AuctionManager";
import {
  DEMO_BIDDER_ID,
  getAuctionDurationMs,
  getAuctionListingFee,
  getAuctionMinBid,
  getMinimumNextBid,
  isDemoBidder,
  type AuctionDurationHours,
} from "@/config/marketplace";
import { gemPriceForCurrency, TRADE_UNLOCK_PRICE, type DualGemPrice, type GemCurrency } from "@/config/gemsEconomy";

/**
 * MARKETPLACE / LEILÃO — meta-screen orchestration, mirroring
 * engine/AscensionManager.ts's own pattern (syncSeasonIfNeeded,
 * resetSeasonProgressionForTesting): this module reads/writes the ONE
 * permanent SaveData directly via loadSave/updateSave, exactly like every
 * other non-gameplay screen (Season/Ranking/Wiki/Novidades all read
 * loadSave() directly rather than needing a live GameEngine instance —
 * `new GameEngine()` only exists inside useGameEngine, which is only ever
 * mounted by GameScreen for actual combat). The Marketplace lives in the
 * same top nav as those screens, so it follows the same architecture, not
 * GameEngine's gameplay-coupled startRun()/update() lifecycle.
 *
 * engine/AuctionManager.ts stays the fully generic, real, server-ready
 * state machine (its own header explains the full rationale, including why
 * no real second-account bid path is wired anywhere in this build — every
 * listing's sellerId is always this save's own playerId, so a bid under
 * that same identity is always rejected as self-bidding). This file is
 * only the local orchestration on top of it: moving real Gems, locking the
 * real ItemInstance, and persisting through SaveSystem.
 */

function settleExpiredAuctions(save: SaveData, now = Date.now()): SaveData {
  let listings = save.auctionListings;
  let inventory = save.inventory;
  // GEMS ECONOMY v2 — a real Marketplace sale's proceeds are the
  // player-to-player trade economy's own value, so they land in
  // purchasedGems (the ONLY currency the Marketplace ever moves), never
  // freeGems — crediting freeGems here would let a gameplay-earned
  // currency re-enter the tradeable-item economy through the back door,
  // exactly what the spec's "Free Gems must never buy/become tradeable
  // value" rule forbids.
  let purchasedGems = save.purchasedGems;
  let changed = false;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]!;
    if (listing.status !== "ACTIVE") continue;
    const outcome = settleAuctionPure(listing, now);
    if (outcome.result === "NOT_YET_EXPIRED" || outcome.result === "ALREADY_SETTLED") continue;

    changed = true;
    listings = listings.map((l, idx) => (idx === i ? outcome.listing : l));
    inventory = inventory.map((item) => (item.instanceId === listing.itemInstanceId ? { ...item, pendingAuction: false } : item));

    if (outcome.result === "SOLD") {
      // No real Gems were ever debited from a demo bidder (see
      // config/marketplace.ts's DEMO_BIDDER_ID doc comment) — crediting the
      // seller here for a demo win would be creating currency from
      // nothing, exactly what spec section 22 forbids.
      if (!isDemoBidder(outcome.winnerId)) purchasedGems += outcome.amount;
      appendLedgerEvent(outcome.ledgerEvent);
    } else {
      appendLedgerEvent(outcome.ledgerEvent);
    }
  }

  if (!changed) return save;
  return updateSave({ auctionListings: listings, inventory, purchasedGems });
}

/** Lazy settlement — see SaveData.auctionListings's own doc comment. Call before reading listings from any Marketplace screen (mirrors AscensionManager.syncSeasonIfNeeded's wall-clock-boundary pattern). */
export function refreshMarketplace(): SaveData {
  return settleExpiredAuctions(loadSave());
}

export function getActiveAuctionListings(): AuctionListing[] {
  return loadSave().auctionListings.filter((l) => l.status === "ACTIVE");
}

/** Every auction this account has ever listed — permanent history for "My Market" (spec section 18), newest first. */
export function getMyAuctionListings(): AuctionListing[] {
  return [...loadSave().auctionListings].sort((a, b) => b.createdAt - a.createdAt);
}

export interface PriceHistoryEntry {
  amount: number;
  settledAt: number;
  /** True when the winning bidder was the local DEMO_BIDDER_ID (see config/marketplace.ts) — no real Gems changed hands for this sale. Always shown honestly labeled in the UI, never hidden or blended into a "real" figure (spec: "não inventar dados"). */
  isDemo: boolean;
}

export interface PriceHistory {
  sales: PriceHistoryEntry[];
  averageAmount: number | null;
  medianAmount: number | null;
  lowestAmount: number | null;
  highestAmount: number | null;
}

/** Real, existing SOLD auctions for `itemDefinitionId`, newest first — never invented/estimated. Empty until this save has actually closed a real sale of that item. */
export function getPriceHistoryForItemDefinition(itemDefinitionId: string): PriceHistory {
  const sales: PriceHistoryEntry[] = loadSave()
    .auctionListings.filter((l) => l.itemDefinitionId === itemDefinitionId && l.status === "SOLD")
    .map((l) => {
      const winningBid = l.bids[l.bids.length - 1]!;
      return { amount: winningBid.amount, settledAt: l.settledAt ?? l.createdAt, isDemo: isDemoBidder(winningBid.bidderId) };
    })
    .sort((a, b) => b.settledAt - a.settledAt);

  if (sales.length === 0) {
    return { sales, averageAmount: null, medianAmount: null, lowestAmount: null, highestAmount: null };
  }
  const amounts = sales.map((s) => s.amount).sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const medianAmount = amounts.length % 2 === 0 ? (amounts[mid - 1]! + amounts[mid]!) / 2 : amounts[mid]!;
  return {
    sales,
    averageAmount: amounts.reduce((sum, a) => sum + a, 0) / amounts.length,
    medianAmount,
    lowestAmount: amounts[0]!,
    highestAmount: amounts[amounts.length - 1]!,
  };
}

export function getAuctionListing(auctionId: string): AuctionListing | null {
  return loadSave().auctionListings.find((l) => l.id === auctionId) ?? null;
}

/** The real, rarity-grounded entry-door minimum for `instanceId` (config/marketplace.ts) — never a "true value", only the floor a listing's own chosen minBid must clear. */
export function getAuctionMinimumBidForItem(instanceId: string): number | null {
  const item = findItem(loadSave().inventory, instanceId);
  const def = item ? getItemDefinition(item.itemDefinitionId) : null;
  return def ? getAuctionMinBid(def.rarity) : null;
}

export function getAuctionListingFeeForItem(instanceId: string): number | null {
  const item = findItem(loadSave().inventory, instanceId);
  const def = item ? getItemDefinition(item.itemDefinitionId) : null;
  return def ? getAuctionListingFee(def.rarity) : null;
}

export function canListItemInMarketplace(instanceId: string): boolean {
  const save = loadSave();
  if (!save.tradeUnlocked) return false;
  const item = findItem(save.inventory, instanceId);
  return !!item && canListItemForAuction(item, save.playerId);
}

export function getMinimumNextBidForAuction(auctionId: string): number | null {
  const listing = getAuctionListing(auctionId);
  return listing ? getMinimumNextBid(getCurrentBidAmount(listing)) : null;
}

export function getLeadingBidderForAuction(auctionId: string): string | null {
  const listing = getAuctionListing(auctionId);
  return listing ? getLeadingBidderId(listing) : null;
}

export type CreateListingResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "NOT_ELIGIBLE" | "BELOW_MINIMUM" | "TRADE_LOCKED" | "INSUFFICIENT_PURCHASED_GEMS" };

/**
 * Atomic create: re-validates ownership/tradability/lock state and the
 * chosen minBid against the real rarity floor (never trusting an earlier
 * UI read — spec section 22), requires Trade to be unlocked, debits the
 * real listing fee, and only then locks the item and appends the listing —
 * one single updateSave, never a partial state.
 *
 * GEMS ECONOMY v2 — the listing fee is Purchased-Gems-ONLY, exactly like
 * every other Marketplace currency movement (see this file's own header
 * and config/gemsEconomy.ts): the entire Marketplace apparatus draws only
 * from the player-to-player trade currency, never from gameplay-earned
 * Free Gems.
 */
export function createAuctionListingForItem(instanceId: string, minBid: number, durationHours: AuctionDurationHours): CreateListingResult {
  const save = loadSave();
  if (!save.tradeUnlocked) return { ok: false, reason: "TRADE_LOCKED" };
  const item = findItem(save.inventory, instanceId);
  if (!item || !canListItemForAuction(item, save.playerId)) return { ok: false, reason: "NOT_ELIGIBLE" };
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def) return { ok: false, reason: "NOT_FOUND" };
  const floor = getAuctionMinBid(def.rarity);
  if (!Number.isFinite(minBid) || minBid < floor) return { ok: false, reason: "BELOW_MINIMUM" };
  const fee = getAuctionListingFee(def.rarity);
  if (save.purchasedGems < fee) return { ok: false, reason: "INSUFFICIENT_PURCHASED_GEMS" };

  const listing = createAuctionListing(save.playerId, item.instanceId, item.itemDefinitionId, minBid, fee, getAuctionDurationMs(durationHours));
  const inventory = save.inventory.map((i) => (i.instanceId === instanceId ? { ...i, pendingAuction: true } : i));

  appendLedgerEvent({
    eventType: "GEMS_SPENT",
    fromOwner: save.playerId,
    toOwner: null,
    source: `auction_listing_fee:${item.itemDefinitionId}`,
    amount: fee,
    currency: "PURCHASED",
  });
  appendLedgerEvent({
    eventType: "AUCTION_LISTED",
    itemInstanceId: item.instanceId,
    itemDefinitionId: item.itemDefinitionId,
    fromOwner: save.playerId,
    toOwner: null,
    source: `auction:${listing.id}`,
    amount: fee,
  });
  updateSave({ purchasedGems: save.purchasedGems - fee, inventory, auctionListings: [...save.auctionListings, listing] });
  return { ok: true };
}

// ---------------------------------------------------------------------
// GEMS ECONOMY v2 — TRADE UNLOCK. The gate before ANY Marketplace action
// (listing or bidding) is allowed at all. Spends either Free OR Purchased
// Gems (config/gemsEconomy.ts's TRADE_UNLOCK_PRICE, 500/500) — unlike the
// listing fee above, unlocking Trading itself is not restricted to
// Purchased Gems, so an F2P player who only ever earns Free Gems can still
// reach the Marketplace door; only what they can BUY once inside is
// restricted (see createAuctionListingForItem above).
// ---------------------------------------------------------------------

export function isTradeUnlocked(): boolean {
  return loadSave().tradeUnlocked;
}

export function getTradeUnlockPrice(): DualGemPrice {
  return TRADE_UNLOCK_PRICE;
}

export type TradeUnlockResult = { ok: true } | { ok: false; reason: "ALREADY_UNLOCKED" | "INSUFFICIENT_FREE_GEMS" | "INSUFFICIENT_PURCHASED_GEMS" };

/** Spends the chosen currency's Trade Unlock price IN FULL from that ONE bucket — never blends Free+Purchased, never converts currency (only flips the permanent gate). */
export function unlockTrade(currency: GemCurrency): TradeUnlockResult {
  const save = loadSave();
  if (save.tradeUnlocked) return { ok: false, reason: "ALREADY_UNLOCKED" };
  const cost = gemPriceForCurrency(TRADE_UNLOCK_PRICE, currency);

  if (currency === "FREE") {
    if (save.freeGems < cost) return { ok: false, reason: "INSUFFICIENT_FREE_GEMS" };
    appendLedgerEvent({ eventType: "GEMS_SPENT", fromOwner: save.playerId, toOwner: null, source: "trade_unlock", amount: cost, currency: "FREE" });
    updateSave({ freeGems: save.freeGems - cost, tradeUnlocked: true });
  } else {
    if (save.purchasedGems < cost) return { ok: false, reason: "INSUFFICIENT_PURCHASED_GEMS" };
    appendLedgerEvent({ eventType: "GEMS_SPENT", fromOwner: save.playerId, toOwner: null, source: "trade_unlock", amount: cost, currency: "PURCHASED" });
    updateSave({ purchasedGems: save.purchasedGems - cost, tradeUnlocked: true });
  }
  return { ok: true };
}

/** Only legal before any bid exists (see AuctionManager.cancelAuctionListing's own doc comment for why) — the listing fee is never refunded, matching the same rule as a natural zero-bid expiry. */
export function cancelMyAuctionListing(auctionId: string): boolean {
  const save = loadSave();
  const index = save.auctionListings.findIndex((l) => l.id === auctionId);
  if (index === -1) return false;
  const outcome = cancelAuctionListingPure(save.auctionListings[index]!, save.playerId);
  if (!outcome.ok) return false;

  const listings = save.auctionListings.map((l, i) => (i === index ? outcome.listing : l));
  const inventory = save.inventory.map((item) => (item.instanceId === outcome.listing.itemInstanceId ? { ...item, pendingAuction: false } : item));

  appendLedgerEvent({
    eventType: "AUCTION_CANCELLED",
    itemInstanceId: outcome.listing.itemInstanceId,
    itemDefinitionId: outcome.listing.itemDefinitionId,
    fromOwner: save.playerId,
    toOwner: save.playerId,
    source: `auction:${outcome.listing.id}`,
  });
  updateSave({ auctionListings: listings, inventory });
  return true;
}

/**
 * The one bid path this local build actually exposes — see this file's own
 * header. Always under DEMO_BIDDER_ID, never this save's own playerId
 * (self-bidding is a real, permanently-enforced rule, not relaxed for the
 * demo). No real Gems move for it either way — see settleExpiredAuctions.
 */
export function placeDemoBid(auctionId: string, amount: number): boolean {
  const save = loadSave();
  if (!save.tradeUnlocked) return false;
  const index = save.auctionListings.findIndex((l) => l.id === auctionId);
  if (index === -1) return false;
  const outcome = placeBidPure(save.auctionListings[index]!, DEMO_BIDDER_ID, amount);
  if (!outcome.ok) return false;

  const listings = save.auctionListings.map((l, i) => (i === index ? outcome.listing : l));
  appendLedgerEvent({
    eventType: "AUCTION_BID_PLACED",
    itemInstanceId: outcome.listing.itemInstanceId,
    itemDefinitionId: outcome.listing.itemDefinitionId,
    fromOwner: null,
    toOwner: DEMO_BIDDER_ID,
    source: `auction:${outcome.listing.id}`,
    amount,
  });
  updateSave({ auctionListings: listings });
  return true;
}
