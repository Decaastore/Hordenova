import { describe, expect, it } from "vitest";
import { createAuctionListing } from "@/entities/Auction";
import {
  cancelAuctionListing,
  canListItemForAuction,
  isAuctionExpired,
  placeBid,
  settleAuction,
} from "./AuctionManager";
import { ANTI_SNIPE_EXTENSION_MS, ANTI_SNIPE_WINDOW_MS, DEMO_BIDDER_ID, getMinimumNextBid } from "@/config/marketplace";
import { createItemInstance } from "@/entities/Item";

const SELLER = "player-seller";
const BIDDER = DEMO_BIDDER_ID;
const NOW = 1_000_000;
const HOUR = 60 * 60 * 1000;
const MIN_BID = 100;
/** The real first-legal bid on a listing whose minBid is MIN_BID — spec's own worked example shows the first bid landing ABOVE the minimum (2000 minBid -> first real bid 2250), never exactly at it. */
const FIRST_BID = getMinimumNextBid(MIN_BID);

function listing() {
  return createAuctionListing(SELLER, "item-1", "ancient_core", MIN_BID, 10, 24 * HOUR, NOW);
}

describe("engine/AuctionManager.ts — the auction state machine (MARKETPLACE / LEILÃO spec)", () => {
  it("createAuctionListing starts ACTIVE with the chosen minBid and no bids", () => {
    const l = listing();
    expect(l.status).toBe("ACTIVE");
    expect(l.minBid).toBe(MIN_BID);
    expect(l.bids).toEqual([]);
    expect(l.endsAt).toBe(NOW + 24 * HOUR);
  });

  it("canListItemForAuction requires ownership, tradability, and no existing lock", () => {
    const owned = createItemInstance("ancient_core", SELLER, { type: "BOSS_DROP", refId: "hollow-warden" });
    expect(canListItemForAuction(owned, SELLER)).toBe(true);
    expect(canListItemForAuction(owned, "someone-else")).toBe(false);
    expect(canListItemForAuction({ ...owned, tradable: false }, SELLER)).toBe(false);
    expect(canListItemForAuction({ ...owned, pendingTrade: true }, SELLER)).toBe(false);
    expect(canListItemForAuction({ ...owned, pendingAuction: true }, SELLER)).toBe(false);
  });

  it("PLAYER ECONOMY UNIFICATION: canListItemForAuction rejects an item currently equipped on a tower — it can no longer be sold out from under the tower using it", () => {
    const owned = createItemInstance("ancient_core", SELLER, { type: "BOSS_DROP", refId: "hollow-warden" });
    expect(canListItemForAuction(owned, SELLER, false)).toBe(true);
    expect(canListItemForAuction(owned, SELLER, true)).toBe(false);
  });

  it("scenario 3/9: a valid bid is recorded, updates the leader, and is reflected in getMinimumNextBid", () => {
    const l = listing();
    const outcome = placeBid(l, BIDDER, FIRST_BID, NOW + 1000);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.listing.bids).toHaveLength(1);
    expect(outcome.listing.bids[0]!.amount).toBe(FIRST_BID);
    expect(outcome.previousLeaderId).toBeNull();
  });

  it("scenario 10: a bid below the real minimum is rejected", () => {
    const l = listing();
    const outcome = placeBid(l, BIDDER, MIN_BID, NOW + 1000); // exactly at minBid — below the real required first bid
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("BELOW_MINIMUM");
  });

  it("never allows the seller to bid on their own listing (shill-bid guard)", () => {
    const l = listing();
    const outcome = placeBid(l, SELLER, 500, NOW + 1000);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("SELF_BID_FORBIDDEN");
  });

  it("scenario 4: an outbid returns the previous leader's id/amount for the caller to refund", () => {
    let l = listing();
    const first = placeBid(l, BIDDER, FIRST_BID, NOW + 1000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    l = first.listing;

    const second = placeBid(l, "another-demo-bidder", getMinimumNextBid(FIRST_BID), NOW + 2000);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.previousLeaderId).toBe(BIDDER);
    expect(second.previousLeaderAmount).toBe(FIRST_BID);
  });

  it("scenario 11/16: two bidders competing for the same auction — each bid must clear the real current minimum, never a stale one", () => {
    let l = listing();
    const bid1 = placeBid(l, "bidder-1", FIRST_BID, NOW + 1000);
    expect(bid1.ok).toBe(true);
    if (!bid1.ok) return;
    l = bid1.listing;

    // Trying to re-bid the same amount again must fail — the real minimum has moved.
    const stale = placeBid(l, "bidder-2", FIRST_BID, NOW + 1500);
    expect(stale.ok).toBe(false);

    const bid2 = placeBid(l, "bidder-2", getMinimumNextBid(FIRST_BID), NOW + 2000);
    expect(bid2.ok).toBe(true);
  });

  it("scenario 12: anti-sniping — a bid inside the last window extends the deadline", () => {
    const l = listing();
    const nearEnd = l.endsAt - ANTI_SNIPE_WINDOW_MS / 2;
    const outcome = placeBid(l, BIDDER, FIRST_BID, nearEnd);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.listing.endsAt).toBe(nearEnd + ANTI_SNIPE_EXTENSION_MS);
    expect(outcome.listing.endsAt).toBeGreaterThan(l.endsAt);
  });

  it("a bid placed well before the anti-snipe window never extends the deadline", () => {
    const l = listing();
    const early = l.endsAt - ANTI_SNIPE_WINDOW_MS - 60_000;
    const outcome = placeBid(l, BIDDER, FIRST_BID, early);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.listing.endsAt).toBe(l.endsAt);
  });

  it("a bid after the auction has expired is rejected", () => {
    const l = listing();
    const outcome = placeBid(l, BIDDER, FIRST_BID, l.endsAt + 1);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("EXPIRED");
  });

  it("isAuctionExpired is false before endsAt and true at/after it", () => {
    const l = listing();
    expect(isAuctionExpired(l, l.endsAt - 1)).toBe(false);
    expect(isAuctionExpired(l, l.endsAt)).toBe(true);
    expect(isAuctionExpired(l, l.endsAt + 1)).toBe(true);
  });

  it("scenario 6: settling an expired auction with a bid transfers to the highest bidder", () => {
    let l = listing();
    const bid = placeBid(l, BIDDER, FIRST_BID, NOW + 1000);
    expect(bid.ok).toBe(true);
    if (!bid.ok) return;
    l = bid.listing;

    const settled = settleAuction(l, l.endsAt + 1);
    expect(settled.result).toBe("SOLD");
    if (settled.result !== "SOLD") return;
    expect(settled.winnerId).toBe(BIDDER);
    expect(settled.amount).toBe(FIRST_BID);
    expect(settled.listing.status).toBe("SOLD");
  });

  it("scenario 7: settling an expired auction with zero bids returns it to the seller as UNSOLD", () => {
    const l = listing();
    const settled = settleAuction(l, l.endsAt + 1);
    expect(settled.result).toBe("UNSOLD");
    if (settled.result !== "UNSOLD") return;
    expect(settled.listing.status).toBe("UNSOLD");
    expect(settled.ledgerEvent.fromOwner).toBe(SELLER);
    expect(settled.ledgerEvent.toOwner).toBe(SELLER);
  });

  it("settling an auction that hasn't expired yet is a no-op", () => {
    const l = listing();
    const settled = settleAuction(l, l.endsAt - 1);
    expect(settled.result).toBe("NOT_YET_EXPIRED");
  });

  it("settling an already-settled auction is a no-op — never double-settles (no duplication)", () => {
    const l = listing();
    const firstSettle = settleAuction(l, l.endsAt + 1);
    expect(firstSettle.result).toBe("UNSOLD");
    if (firstSettle.result !== "UNSOLD") return;
    const secondSettle = settleAuction(firstSettle.listing, l.endsAt + 5000);
    expect(secondSettle.result).toBe("ALREADY_SETTLED");
  });

  it("scenario: cancelling a listing with zero bids succeeds and returns the item", () => {
    const l = listing();
    const outcome = cancelAuctionListing(l, SELLER, NOW + 500);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.listing.status).toBe("CANCELLED");
  });

  it("scenario: cancelling a listing once a real bid exists is blocked — protects the bidder's reserved Gems", () => {
    let l = listing();
    const bid = placeBid(l, BIDDER, FIRST_BID, NOW + 1000);
    expect(bid.ok).toBe(true);
    if (!bid.ok) return;
    l = bid.listing;

    const outcome = cancelAuctionListing(l, SELLER, NOW + 2000);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("HAS_BIDS");
  });

  it("only the real seller may cancel their own listing", () => {
    const l = listing();
    const outcome = cancelAuctionListing(l, "not-the-seller", NOW + 500);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("NOT_SELLER");
  });

  it("getMinimumNextBid is always strictly greater than the current bid — bidding your own current leading amount again is never valid", () => {
    for (const current of [20, 100, 1000, 8500]) {
      expect(getMinimumNextBid(current)).toBeGreaterThan(current);
    }
  });
});
