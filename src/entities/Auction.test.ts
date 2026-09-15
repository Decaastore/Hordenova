import { describe, expect, it } from "vitest";
import { createAuctionListing, getCurrentBidAmount, getHighestBid, getLeadingBidderId } from "./Auction";

describe("entities/Auction.ts", () => {
  it("createAuctionListing sets endsAt from createdAt + durationMs", () => {
    const l = createAuctionListing("seller", "item-1", "ancient_core", 100, 10, 3600_000, 1000);
    expect(l.createdAt).toBe(1000);
    expect(l.endsAt).toBe(1000 + 3600_000);
    expect(l.status).toBe("ACTIVE");
    expect(l.settledAt).toBeNull();
  });

  it("getCurrentBidAmount falls back to minBid when there are no bids yet", () => {
    const l = createAuctionListing("seller", "item-1", "ancient_core", 250, 10, 3600_000);
    expect(getCurrentBidAmount(l)).toBe(250);
    expect(getHighestBid(l)).toBeNull();
    expect(getLeadingBidderId(l)).toBeNull();
  });

  it("getCurrentBidAmount/getLeadingBidderId read the LAST bid (highest, since bids only ever grow)", () => {
    const l = createAuctionListing("seller", "item-1", "ancient_core", 100, 10, 3600_000);
    const withBids = {
      ...l,
      bids: [
        { id: "b1", bidderId: "bidder-a", amount: 150, placedAt: 1 },
        { id: "b2", bidderId: "bidder-b", amount: 200, placedAt: 2 },
      ],
    };
    expect(getCurrentBidAmount(withBids)).toBe(200);
    expect(getLeadingBidderId(withBids)).toBe("bidder-b");
  });
});
