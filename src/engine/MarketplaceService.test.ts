import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSave, updateSave } from "./SaveSystem";
import { createItemInstance } from "@/entities/Item";
import { createTowerInstance, canEquipItem } from "@/entities/Tower";
import {
  cancelMyAuctionListing,
  createAuctionListingForItem,
  getActiveAuctionListings,
  getAuctionListing,
  getMyAuctionListings,
  getPriceHistoryForItemDefinition,
  placeDemoBid,
  refreshMarketplace,
} from "./MarketplaceService";
import { DEMO_BIDDER_ID, getAuctionListingFee, getAuctionMinBid, getMinimumNextBid } from "@/config/marketplace";
import { checkFusionEligibility } from "./ItemFusion";

const PLAYER = "player-1";
const HOUR = 60 * 60 * 1000;
const DAY0 = 1_700_000_000_000;
/** The real first-legal bid on a fresh UNCOMMON listing (its floor is getAuctionMinBid("UNCOMMON")) — spec's own worked example shows the first bid landing ABOVE the minimum, never exactly at it. */
const FIRST_BID = getMinimumNextBid(getAuctionMinBid("UNCOMMON"));

/** mosswood_charm: real UNCOMMON, tradable item (see config/itemDefinitions.ts). */
function seedTradableItem() {
  const item = createItemInstance("mosswood_charm", PLAYER, { type: "BOSS_DROP", refId: "hollow-warden" });
  updateSave({ playerId: PLAYER, inventory: [item], gems: 1000 });
  return item;
}

describe("engine/MarketplaceService.ts — MARKETPLACE / LEILÃO integration (spec section 23's real-flow scenarios)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(DAY0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scenario 1/2: creating an auction pays the real listing fee and locks the item", () => {
    const item = seedTradableItem();
    const fee = getAuctionListingFee("UNCOMMON");
    const floor = getAuctionMinBid("UNCOMMON");

    const result = createAuctionListingForItem(item.instanceId, floor, 24);
    expect(result.ok).toBe(true);

    const save = loadSave();
    expect(save.gems).toBe(1000 - fee);
    expect(save.inventory[0]!.pendingAuction).toBe(true);
    expect(save.auctionListings).toHaveLength(1);
    expect(save.auctionListings[0]!.minBid).toBe(floor);
    expect(save.auctionListings[0]!.listingFeePaid).toBe(fee);
  });

  it("rejects a minBid below the real rarity floor — never trusts an arbitrary UI value", () => {
    const item = seedTradableItem();
    const floor = getAuctionMinBid("UNCOMMON");
    const result = createAuctionListingForItem(item.instanceId, floor - 1, 24);
    expect(result.ok).toBe(false);
    expect(loadSave().auctionListings).toHaveLength(0);
  });

  it("rejects listing without enough Gems for the fee, and never charges a partial fee", () => {
    const item = seedTradableItem();
    updateSave({ gems: 0 });
    const result = createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    expect(result.ok).toBe(false);
    const save = loadSave();
    expect(save.gems).toBe(0);
    expect(save.auctionListings).toHaveLength(0);
  });

  it("scenario 12: an item locked in an auction cannot be equipped on a tower", () => {
    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    const lockedItem = loadSave().inventory[0]!;
    expect(lockedItem.pendingAuction).toBe(true);

    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 });
    expect(canEquipItem(tower, 0, lockedItem, false)).toBe(false);
  });

  it("scenario 12: an item locked in an auction cannot be selected for Item Fusion", () => {
    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    const lockedItem = loadSave().inventory[0]!;
    const eligibility = checkFusionEligibility([lockedItem], [lockedItem.instanceId], PLAYER);
    expect(eligibility.ok).toBe(false);
  });

  it("scenario 3: a demo bid is recorded on the listing without spending real Gems", () => {
    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    const listingId = loadSave().auctionListings[0]!.id;
    const gemsBefore = loadSave().gems;

    const ok = placeDemoBid(listingId, FIRST_BID);
    expect(ok).toBe(true);
    const listing = getAuctionListing(listingId)!;
    expect(listing.bids).toHaveLength(1);
    expect(listing.bids[0]!.bidderId).toBe(DEMO_BIDDER_ID);
    expect(loadSave().gems).toBe(gemsBefore); // demo bids never touch real Gems
  });

  it("scenario 10: a bid below the real minimum is rejected", () => {
    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    const listingId = loadSave().auctionListings[0]!.id;
    const ok = placeDemoBid(listingId, 1);
    expect(ok).toBe(false);
    expect(getAuctionListing(listingId)!.bids).toHaveLength(0);
  });

  it("scenario 6: settling an expired auction with a bid marks it SOLD, unlocks the item, never duplicates it, and grants no phantom Gems", () => {
    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 12);
    const listingId = loadSave().auctionListings[0]!.id;
    placeDemoBid(listingId, FIRST_BID);
    const gemsAfterBid = loadSave().gems;

    vi.setSystemTime(DAY0 + 13 * HOUR);
    refreshMarketplace();

    const save = loadSave();
    expect(save.auctionListings[0]!.status).toBe("SOLD");
    expect(save.inventory).toHaveLength(1); // no duplication
    expect(save.inventory[0]!.pendingAuction).toBe(false);
    expect(save.gems).toBe(gemsAfterBid); // demo win never credits real Gems (no real Gems ever paid for it)
  });

  it("scenario 7: settling an expired auction with zero bids returns the item unlocked, fee stays forfeited", () => {
    const item = seedTradableItem();
    const fee = getAuctionListingFee("UNCOMMON");
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 12);
    const gemsAfterListing = loadSave().gems;
    expect(gemsAfterListing).toBe(1000 - fee);

    vi.setSystemTime(DAY0 + 13 * HOUR);
    refreshMarketplace();

    const save = loadSave();
    expect(save.auctionListings[0]!.status).toBe("UNSOLD");
    expect(save.inventory[0]!.pendingAuction).toBe(false);
    expect(save.gems).toBe(gemsAfterListing); // fee never refunded
  });

  it("scenario 12 (anti-sniping) real-flow: a bid inside the last window extends the persisted endsAt", () => {
    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 12);
    const listing = loadSave().auctionListings[0]!;
    const nearEnd = listing.endsAt - 60_000; // 1 minute before close, inside the 2-minute anti-snipe window
    vi.setSystemTime(nearEnd);

    placeDemoBid(listing.id, FIRST_BID);
    const extended = getAuctionListing(listing.id)!;
    expect(extended.endsAt).toBeGreaterThan(listing.endsAt);
  });

  it("cancelling an active listing with zero bids unlocks the item and marks it CANCELLED", () => {
    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    const listingId = loadSave().auctionListings[0]!.id;

    const ok = cancelMyAuctionListing(listingId);
    expect(ok).toBe(true);
    const save = loadSave();
    expect(save.auctionListings[0]!.status).toBe("CANCELLED");
    expect(save.inventory[0]!.pendingAuction).toBe(false);
  });

  it("cannot cancel once a real bid exists — protects the reserved slot for the current leader", () => {
    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    const listingId = loadSave().auctionListings[0]!.id;
    placeDemoBid(listingId, FIRST_BID);

    const ok = cancelMyAuctionListing(listingId);
    expect(ok).toBe(false);
    expect(loadSave().auctionListings[0]!.status).toBe("ACTIVE");
  });

  it("getActiveAuctionListings only returns ACTIVE listings; getMyAuctionListings returns full permanent history", () => {
    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 12);
    const listingId = loadSave().auctionListings[0]!.id;

    expect(getActiveAuctionListings()).toHaveLength(1);
    cancelMyAuctionListing(listingId);
    expect(getActiveAuctionListings()).toHaveLength(0);
    expect(getMyAuctionListings()).toHaveLength(1); // cancelled auctions are never deleted
  });

  it("getPriceHistoryForItemDefinition is empty for an item with no real SOLD auctions, and reflects a real one honestly tagged once it exists", () => {
    expect(getPriceHistoryForItemDefinition("mosswood_charm").sales).toEqual([]);

    const item = seedTradableItem();
    createAuctionListingForItem(item.instanceId, getAuctionMinBid("UNCOMMON"), 12);
    const listingId = loadSave().auctionListings[0]!.id;
    placeDemoBid(listingId, FIRST_BID);
    vi.setSystemTime(DAY0 + 13 * HOUR);
    refreshMarketplace();

    const history = getPriceHistoryForItemDefinition("mosswood_charm");
    expect(history.sales).toHaveLength(1);
    expect(history.sales[0]!.isDemo).toBe(true);
    expect(history.averageAmount).toBe(FIRST_BID);
  });
});
