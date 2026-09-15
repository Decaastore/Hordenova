import { generateId } from "@/utils/id";

/**
 * MARKETPLACE / LEILÃO — real item identity, mirroring entities/Item.ts's
 * own split between a definition (template) and an instance (the one real
 * copy being sold). An AuctionListing always wraps one specific
 * ItemInstance (by instanceId) — never a definition/category, since only a
 * real owned copy can ever be listed.
 */
export interface Bid {
  id: string;
  /** The bidder's stable identity — see config/marketplace.ts's DEMO_BIDDER_ID for the one local-only synthetic id this build ever uses; a real backend would put a real second account's playerId here instead. */
  bidderId: string;
  amount: number;
  placedAt: number;
}

export type AuctionStatus = "ACTIVE" | "SOLD" | "UNSOLD" | "CANCELLED";

export interface AuctionListing {
  id: string;
  sellerId: string;
  itemInstanceId: string;
  itemDefinitionId: string;
  /** The seller's chosen starting point (spec: "não necessariamente representa o valor real do item") — never a price, only the entry door. */
  minBid: number;
  listingFeePaid: number;
  createdAt: number;
  /** Wall-clock expiry, computed once at creation from the chosen duration — extended in place by anti-sniping (see AuctionManager.placeBid), read lazily against Date.now() exactly like SeasonClock's own boundaries rather than a locally-ticking countdown. */
  endsAt: number;
  status: AuctionStatus;
  /** Oldest first — the full bid history the UI shows verbatim (spec: "não inventar dados, somente mostrar dados reais"). */
  bids: Bid[];
  settledAt: number | null;
}

export function createAuctionListing(
  sellerId: string,
  itemInstanceId: string,
  itemDefinitionId: string,
  minBid: number,
  listingFeePaid: number,
  durationMs: number,
  now = Date.now(),
): AuctionListing {
  return {
    id: generateId("auction"),
    sellerId,
    itemInstanceId,
    itemDefinitionId,
    minBid,
    listingFeePaid,
    createdAt: now,
    endsAt: now + durationMs,
    status: "ACTIVE",
    bids: [],
    settledAt: null,
  };
}

export function getHighestBid(listing: AuctionListing): Bid | null {
  return listing.bids.length > 0 ? listing.bids[listing.bids.length - 1]! : null;
}

export function getCurrentBidAmount(listing: AuctionListing): number {
  return getHighestBid(listing)?.amount ?? listing.minBid;
}

export function getLeadingBidderId(listing: AuctionListing): string | null {
  return getHighestBid(listing)?.bidderId ?? null;
}
