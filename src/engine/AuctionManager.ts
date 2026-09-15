import {
  createAuctionListing,
  getCurrentBidAmount,
  getLeadingBidderId,
  type AuctionListing,
  type Bid,
} from "@/entities/Auction";
import { ANTI_SNIPE_EXTENSION_MS, ANTI_SNIPE_WINDOW_MS, getMinimumNextBid } from "@/config/marketplace";
import { generateId } from "@/utils/id";
import type { ItemInstance } from "@/entities/Item";
import type { LedgerEvent } from "./EconomyLedger";

/**
 * MARKETPLACE / LEILÃO spec sections 4-6/13-16/22/31 — a real auction state
 * machine, built exactly like engine/TradeManager.ts (its own header
 * explains the pattern in full): every function here is PURE, no
 * localStorage, no ledger writes, so the exact same functions could run
 * inside a future real server process untouched. GameEngine is the only
 * thing that persists results, moves Gems, and appends ledger events.
 *
 * THE "NO FAKE PLAYERS" LIMITATION (spec sections 23/31/36, and this exact
 * precedent already set once by TradeManager.ts): there is no real second
 * player in this local-only, no-backend build. Section 25's resolved
 * direction ("motor real + UI premium, sem players falsos") means this
 * module stays 100% generic/correct — it has no idea whether a bidderId is
 * "real" — while GameEngine's own integration layer is honest about what
 * that identity actually is:
 *
 *   - Every AuctionListing's sellerId is always this save's own playerId
 *     (there's only one real account), so a bid placed under that SAME id
 *     would be shill/self-bidding — validateBid below rejects it exactly
 *     like a real backend must (spec section 8's implicit fraud rule).
 *   - Because of that, the ONLY identity that can ever legally place a bid
 *     here today is config/marketplace.ts's DEMO_BIDDER_ID — a single,
 *     clearly-labeled, local-only synthetic identity GameEngine uses to let
 *     the player exercise the full bid/outbid/anti-snipe/settle flow live,
 *     without pretending it's a real second player (see GameEngine.placeDemoBid
 *     and MyMarketPanel's own "Demonstração local" labeling). No real Gems
 *     are ever debited for it, and a demo win never pays the seller real
 *     Gems either — see GameEngine.settleExpiredAuctions for exactly why
 *     (crediting Gems that were never actually spent by anyone would be
 *     currency duplication, the one thing spec section 22 explicitly
 *     forbids).
 */

export type BidFailureReason =
  | "NOT_ACTIVE"
  | "EXPIRED"
  | "SELF_BID_FORBIDDEN"
  | "BELOW_MINIMUM";

export type BidOutcome =
  | { ok: true; listing: AuctionListing; previousLeaderId: string | null; previousLeaderAmount: number | null }
  | { ok: false; reason: BidFailureReason; minimumRequired?: number };

export function isAuctionExpired(listing: AuctionListing, now = Date.now()): boolean {
  return now >= listing.endsAt;
}

/**
 * Re-checks ground truth at commit time (spec section 22: "não confiar no
 * cliente... para lance") — status, expiry, self-bid, and the real current
 * minimum, rather than trusting whatever the UI showed when the bid button
 * was clicked. Anti-sniping (spec section 15) is applied here, in the same
 * atomic step: a bid landing inside the last ANTI_SNIPE_WINDOW_MS pushes
 * endsAt out by ANTI_SNIPE_EXTENSION_MS from now (never shortened — a bid
 * placed comfortably early never reduces the remaining time).
 */
export function placeBid(listing: AuctionListing, bidderId: string, amount: number, now = Date.now()): BidOutcome {
  if (listing.status !== "ACTIVE") return { ok: false, reason: "NOT_ACTIVE" };
  if (isAuctionExpired(listing, now)) return { ok: false, reason: "EXPIRED" };
  if (bidderId === listing.sellerId) return { ok: false, reason: "SELF_BID_FORBIDDEN" };

  const minimumRequired = getMinimumNextBid(getCurrentBidAmount(listing));
  if (amount < minimumRequired) return { ok: false, reason: "BELOW_MINIMUM", minimumRequired };

  const previousLeaderId = getLeadingBidderId(listing);
  const previousLeaderAmount = previousLeaderId ? getCurrentBidAmount(listing) : null;

  const newBid: Bid = { id: generateId("bid"), bidderId, amount, placedAt: now };
  const withinSnipeWindow = listing.endsAt - now <= ANTI_SNIPE_WINDOW_MS;
  const endsAt = withinSnipeWindow ? Math.max(listing.endsAt, now + ANTI_SNIPE_EXTENSION_MS) : listing.endsAt;

  return {
    ok: true,
    listing: { ...listing, bids: [...listing.bids, newBid], endsAt },
    previousLeaderId,
    previousLeaderAmount,
  };
}

export type SettleResult =
  | { result: "NOT_YET_EXPIRED" }
  | { result: "ALREADY_SETTLED" }
  | {
      result: "SOLD";
      listing: AuctionListing;
      winnerId: string;
      amount: number;
      ledgerEvent: Omit<LedgerEvent, "eventId" | "timestamp">;
    }
  | { result: "UNSOLD"; listing: AuctionListing; ledgerEvent: Omit<LedgerEvent, "eventId" | "timestamp"> };

/**
 * Atomically closes ONE expired auction: highest bid wins if any exist,
 * otherwise the item returns to the seller — never a partial or ambiguous
 * outcome (spec section 5's closing rules). Never mutates anything if the
 * listing isn't actually expired yet or was already settled, so calling
 * this repeatedly (GameEngine does, lazily, exactly like SeasonClock's own
 * wall-clock-boundary pattern) is always safe.
 */
export function settleAuction(listing: AuctionListing, now = Date.now()): SettleResult {
  if (listing.status !== "ACTIVE") return { result: "ALREADY_SETTLED" };
  if (!isAuctionExpired(listing, now)) return { result: "NOT_YET_EXPIRED" };

  const winningBid = listing.bids.length > 0 ? listing.bids[listing.bids.length - 1]! : null;

  if (!winningBid) {
    return {
      result: "UNSOLD",
      listing: { ...listing, status: "UNSOLD", settledAt: now },
      ledgerEvent: {
        eventType: "AUCTION_SETTLED_UNSOLD",
        itemInstanceId: listing.itemInstanceId,
        itemDefinitionId: listing.itemDefinitionId,
        fromOwner: listing.sellerId,
        toOwner: listing.sellerId,
        source: `auction:${listing.id}`,
      },
    };
  }

  return {
    result: "SOLD",
    listing: { ...listing, status: "SOLD", settledAt: now },
    winnerId: winningBid.bidderId,
    amount: winningBid.amount,
    ledgerEvent: {
      eventType: "AUCTION_SETTLED_SOLD",
      itemInstanceId: listing.itemInstanceId,
      itemDefinitionId: listing.itemDefinitionId,
      fromOwner: listing.sellerId,
      toOwner: winningBid.bidderId,
      source: `auction:${listing.id}`,
      amount: winningBid.amount,
    },
  };
}

export type CancelFailureReason = "NOT_ACTIVE" | "NOT_SELLER" | "HAS_BIDS";
export type CancelOutcome = { ok: true; listing: AuctionListing } | { ok: false; reason: CancelFailureReason };

/**
 * Spec's own worked flow only describes cancelling BEFORE any bid exists
 * (a seller changing their mind on a listing nobody has committed Gems to
 * yet). Once a real bid exists, a bidder's Gems are already reserved
 * against winning it — letting the seller cancel out from under them would
 * be exactly the kind of "cancelamento indevido" spec section 22 lists as
 * an exploit to protect against, so this is intentionally blocked.
 */
export function cancelAuctionListing(listing: AuctionListing, requesterId: string, now = Date.now()): CancelOutcome {
  if (listing.status !== "ACTIVE") return { ok: false, reason: "NOT_ACTIVE" };
  if (requesterId !== listing.sellerId) return { ok: false, reason: "NOT_SELLER" };
  if (listing.bids.length > 0) return { ok: false, reason: "HAS_BIDS" };
  return { ok: true, listing: { ...listing, status: "CANCELLED", settledAt: now } };
}

/** A real, owned, tradable, not-already-locked item is the only thing that can ever be listed (spec section 17's soulbound rule, reused verbatim — the exact same rule that already blocks a soulbound item from TradeManager). */
export function canListItemForAuction(item: Pick<ItemInstance, "ownerId" | "tradable" | "pendingTrade" | "pendingAuction">, ownerId: string): boolean {
  return item.ownerId === ownerId && item.tradable && !item.pendingTrade && !item.pendingAuction;
}

export { createAuctionListing, getCurrentBidAmount, getLeadingBidderId };
