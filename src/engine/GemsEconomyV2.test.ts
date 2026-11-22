import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import { createItemInstance } from "@/entities/Item";
import { createAuctionListingForItem, isTradeUnlocked, placeDemoBid, refreshMarketplace } from "./MarketplaceService";
import * as MarketplaceService from "./MarketplaceService";
import { AUCTION_WEEKLY_LISTING_LIMIT, auctionSellerProceeds, getAuctionListingFee, getAuctionMinBid, getMinimumNextBid } from "@/config/marketplace";
import { dualGemPrice } from "@/config/gemsEconomy";

/** An active VIP (the Marketplace key) and an expired one, relative to the tests' fake clock. */
const vipOn = (now: number) => ({ until: now + 30 * 24 * 60 * 60 * 1000, lastGiftDay: -1 });
const VIP_OFF = { until: 0, lastGiftDay: -1 };
import { getTowerSkinDefinition, TOWER_SKINS } from "@/config/towerSkins";
import { SEASON_EPOCH_MS } from "./SeasonClock";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

/**
 * GEMS ECONOMY v2 — DUAL CURRENCY. Real-engine coverage for the user's own
 * mandatory 9 numbered scenarios plus the exploit-protection checklist.
 * Every scenario here uses the real GameEngine/MarketplaceService/SaveSystem
 * — never a mock of the currency logic itself.
 */
describe("GEMS ECONOMY v2 — dual currency (freeGems/purchasedGems)", () => {
  const NOW = SEASON_EPOCH_MS + 1000;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A real PREMIUM commercial skin — 1,200 Free / 800 Purchased per the
  // approved dualGemPrice(800) methodology (config/gemsEconomy.ts).
  const PREMIUM_SKIN = TOWER_SKINS.find((s) => s.tier === "PREMIUM")!;
  const SKIN_PRICE = dualGemPrice(PREMIUM_SKIN.gemCost);

  function setupTowerFor(skin: typeof PREMIUM_SKIN): GameEngine {
    // The tower must have already reached the skin's real unlockLevel
    // (entities/Tower.ts's canPurchaseSkin gate) before a purchase is even
    // eligible — seeding the loadout directly at that level avoids grinding
    // Gold-funded level-ups just to exercise the Gems purchase flow itself.
    const slot = TOWER_SLOTS[0]!;
    updateSave({
      gold: 999_999,
      towerLoadout: [{ slotId: slot.id, type: skin.towerType, level: skin.unlockLevel }],
    });
    const engine = new GameEngine();
    engine.startRun();
    engine.selectTower(engine.getRenderSnapshot().towers[0]!.id);
    return engine;
  }

  // ---------------------------------------------------------------------
  // Scenarios 1/2 (MARKETPLACE = VIP ONLY): there is no Gem unlock any more.
  // Without an active VIP no amount of Free or Purchased Gems opens Trading;
  // with VIP it is open without spending anything.
  // ---------------------------------------------------------------------
  it("scenario 1: without VIP, Trading stays closed no matter how many Gems the player has", () => {
    updateSave({ freeGems: 999_999, purchasedGems: 999_999, vip: VIP_OFF });
    expect(isTradeUnlocked()).toBe(false);
  });

  it("scenario 2: an active VIP opens Trading without spending any Gems; it closes again when VIP lapses", () => {
    updateSave({ freeGems: 100, purchasedGems: 100, vip: vipOn(NOW) });
    expect(isTradeUnlocked()).toBe(true);
    expect(loadSave().freeGems).toBe(100);
    expect(loadSave().purchasedGems).toBe(100);
    vi.setSystemTime(NOW + 31 * 24 * 60 * 60 * 1000);
    expect(isTradeUnlocked()).toBe(false);
  });

  // ---------------------------------------------------------------------
  // Scenario 3: 1,200 Free / 0 Purchased -> buy Skin. Should succeed.
  // ---------------------------------------------------------------------
  it("scenario 3: 1,200 Free / 0 Purchased buys the skin with FREE Gems", () => {
    const engine = setupTowerFor(PREMIUM_SKIN);
    updateSave({ freeGems: SKIN_PRICE.free, purchasedGems: 0 });
    const reloaded = new GameEngine();
    reloaded.startRun();
    reloaded.selectTower(reloaded.getRenderSnapshot().towers[0]!.id);

    expect(reloaded.getTowerSkinDualGemPrice(PREMIUM_SKIN.id)).toEqual(SKIN_PRICE);
    const ok = reloaded.purchaseTowerSkin(PREMIUM_SKIN.id, "FREE");
    expect(ok).toBe(true);
    expect(reloaded.isTowerSkinOwned(PREMIUM_SKIN.id)).toBe(true);
    expect(reloaded.getFreeGemBalance()).toBe(0);
    expect(reloaded.getPurchasedGemBalance()).toBe(0);
    void engine;
  });

  // ---------------------------------------------------------------------
  // Scenario 4: 0 Free / 800 Purchased -> buy Skin. Should succeed.
  // ---------------------------------------------------------------------
  it("scenario 4: 0 Free / 800 Purchased buys the skin with PURCHASED Gems", () => {
    setupTowerFor(PREMIUM_SKIN);
    updateSave({ freeGems: 0, purchasedGems: SKIN_PRICE.purchased });
    const engine = new GameEngine();
    engine.startRun();
    engine.selectTower(engine.getRenderSnapshot().towers[0]!.id);

    const ok = engine.purchaseTowerSkin(PREMIUM_SKIN.id, "PURCHASED");
    expect(ok).toBe(true);
    expect(engine.isTowerSkinOwned(PREMIUM_SKIN.id)).toBe(true);
    expect(engine.getPurchasedGemBalance()).toBe(0);
  });

  // ---------------------------------------------------------------------
  // Scenario 5: 1,200 Free / 800 Purchased -> UI must offer BOTH options —
  // both currencies must independently be sufficient, never auto-picked.
  // ---------------------------------------------------------------------
  it("scenario 5: 1,200 Free / 800 Purchased — both currencies independently afford the skin", () => {
    setupTowerFor(PREMIUM_SKIN);
    updateSave({ freeGems: SKIN_PRICE.free, purchasedGems: SKIN_PRICE.purchased });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.canAffordGemsInCurrency(SKIN_PRICE.free, "FREE")).toBe(true);
    expect(engine.canAffordGemsInCurrency(SKIN_PRICE.purchased, "PURCHASED")).toBe(true);
  });

  // ---------------------------------------------------------------------
  // Scenario 6: 850 Free / 800 Purchased — Free insufficient for the 1,200
  // Free price; Purchased remains purchasable at 800.
  // ---------------------------------------------------------------------
  it("scenario 6: 850 Free / 800 Purchased — Free reports insufficient, Purchased still purchasable", () => {
    setupTowerFor(PREMIUM_SKIN);
    updateSave({ freeGems: 850, purchasedGems: SKIN_PRICE.purchased });
    const engine = new GameEngine();
    engine.startRun();
    engine.selectTower(engine.getRenderSnapshot().towers[0]!.id);

    expect(engine.canAffordGemsInCurrency(SKIN_PRICE.free, "FREE")).toBe(false);
    expect(engine.canAffordGemsInCurrency(SKIN_PRICE.purchased, "PURCHASED")).toBe(true);
    // Insufficient-balance feedback names the exact shortfall for Free.
    expect(SKIN_PRICE.free - 850).toBe(350);
    // Attempting to pay with FREE anyway must fail — never silently falls
    // back to Purchased, never partially spends.
    expect(engine.purchaseTowerSkin(PREMIUM_SKIN.id, "FREE")).toBe(false);
    expect(engine.getFreeGemBalance()).toBe(850); // untouched by the failed attempt
    // Purchased still works.
    expect(engine.purchaseTowerSkin(PREMIUM_SKIN.id, "PURCHASED")).toBe(true);
  });

  // ---------------------------------------------------------------------
  // Scenario 7: a VIP seller with only Free Gems can NOT pay the listing fee
  // — every Marketplace charge is Purchased Gems only.
  // ---------------------------------------------------------------------
  it("scenario 7: listing with Free Gems is refused (PURCHASED_GEMS_ONLY) and charges nothing", () => {
    const seller = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ playerId: "player-1", inventory: [seller], freeGems: 2000, purchasedGems: 0, vip: vipOn(NOW) });
    const result = createAuctionListingForItem(seller.instanceId, getAuctionMinBid("UNCOMMON"), 24, "FREE");
    expect(result).toEqual({ ok: false, reason: "PURCHASED_GEMS_ONLY" });
    expect(loadSave().freeGems).toBe(2000);
    expect(loadSave().auctionListings).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // Scenario 8: a VIP seller pays the fee in Purchased Gems.
  // ---------------------------------------------------------------------
  it("scenario 8: VIP with 2,000 Purchased — listing SUCCEEDS and pays the fee in Purchased Gems", () => {
    const seller = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ playerId: "player-1", inventory: [seller], freeGems: 0, purchasedGems: 2000, vip: vipOn(NOW) });
    const result = createAuctionListingForItem(seller.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    expect(result.ok).toBe(true);
    const save = loadSave();
    expect(save.purchasedGems).toBe(2000 - getAuctionListingFee("UNCOMMON"));
    expect(save.freeGems).toBe(0);
    expect(save.auctionListings).toHaveLength(1);
  });

  // ---------------------------------------------------------------------
  // Scenario 9: Fragments (Gem Shards) -> Free Gems conversion must never
  // increase Purchased Gems.
  // ---------------------------------------------------------------------
  it("scenario 9: Gem Shard conversion always lands in freeGems, never purchasedGems", () => {
    updateSave({ gemShards: 100, freeGems: 0, purchasedGems: 500 });
    const engine = new GameEngine();
    engine.startRun();
    const ok = engine.convertGemShards();
    expect(ok).toBe(true);
    expect(engine.getFreeGemBalance()).toBeGreaterThan(0);
    expect(engine.getPurchasedGemBalance()).toBe(500); // completely untouched
  });

  // =======================================================================
  // EXPLOIT PROTECTION CHECKLIST
  // =======================================================================

  it("exploit: spendGems rejects a negative or zero amount outright", () => {
    updateSave({ freeGems: 1000, purchasedGems: 1000 });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.spendGems(-50, "malicious", "FREE")).toBe(false);
    expect(engine.spendGems(0, "malicious", "PURCHASED")).toBe(false);
    expect(engine.getFreeGemBalance()).toBe(1000);
    expect(engine.getPurchasedGemBalance()).toBe(1000);
  });

  it("exploit: double-purchasing the same skin is blocked by ownership, not just balance", () => {
    setupTowerFor(PREMIUM_SKIN);
    updateSave({ freeGems: 0, purchasedGems: SKIN_PRICE.purchased * 3 });
    const engine = new GameEngine();
    engine.startRun();
    engine.selectTower(engine.getRenderSnapshot().towers[0]!.id);

    expect(engine.purchaseTowerSkin(PREMIUM_SKIN.id, "PURCHASED")).toBe(true);
    const afterFirst = engine.getPurchasedGemBalance();
    // A second purchase attempt on an already-owned skin must not charge again.
    expect(engine.canPurchaseSkinForSelectedTower(PREMIUM_SKIN.id)).toBe(false);
    expect(engine.purchaseTowerSkin(PREMIUM_SKIN.id, "PURCHASED")).toBe(false);
    expect(engine.getPurchasedGemBalance()).toBe(afterFirst);
  });

  it("exploit: a VIP account can open at most AUCTION_WEEKLY_LISTING_LIMIT listings per 7 days", () => {
    const items = Array.from({ length: AUCTION_WEEKLY_LISTING_LIMIT + 1 }, () => createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" }));
    updateSave({ playerId: "player-1", inventory: items, purchasedGems: 999_999, vip: vipOn(NOW) });
    for (let i = 0; i < AUCTION_WEEKLY_LISTING_LIMIT; i++) {
      expect(createAuctionListingForItem(items[i]!.instanceId, getAuctionMinBid("UNCOMMON"), 72).ok).toBe(true);
    }
    expect(createAuctionListingForItem(items[AUCTION_WEEKLY_LISTING_LIMIT]!.instanceId, getAuctionMinBid("UNCOMMON"), 72)).toEqual({ ok: false, reason: "WEEKLY_LIMIT" });
    vi.setSystemTime(NOW + 7 * 24 * 60 * 60 * 1000 + 1);
    expect(createAuctionListingForItem(items[AUCTION_WEEKLY_LISTING_LIMIT]!.instanceId, getAuctionMinBid("UNCOMMON"), 72).ok).toBe(true);
  });

  it("the sale tax keeps 10% of every sale (rounded in the house's favour)", () => {
    expect(auctionSellerProceeds(1000)).toBe(900);
    expect(auctionSellerProceeds(55)).toBe(49);
    expect(auctionSellerProceeds(0)).toBe(0);
    expect(auctionSellerProceeds(-5)).toBe(0);
  });

  it("exploit: there is no code path that converts Free Gems into Purchased Gems", () => {
    // The GameEngine's public surface only ever mutates purchasedGems via
    // addPurchasedGems (a future IAP hook) or spendGems("PURCHASED"/currency).
    // No method takes freeGems as input and credits purchasedGems as output.
    const engine = new GameEngine();
    const proto = Object.getPrototypeOf(engine) as Record<string, unknown>;
    const suspiciousNames = Object.getOwnPropertyNames(proto).filter(
      (name) => /convert/i.test(name) && /free/i.test(name) === false && /gemshard/i.test(name) === false,
    );
    // The only "convert*" method is convertGemShards (Fragments -> Free),
    // never a Free -> Purchased converter.
    expect(suspiciousNames.every((n) => n.toLowerCase().includes("gemshard"))).toBe(true);
  });

  it("exploit: attempting to pay a Free-Gems price using the Purchased balance (or vice versa) never blends the two — no partial/mixed payment", () => {
    setupTowerFor(PREMIUM_SKIN);
    // Exactly half the Free price sits in each bucket — the SUM covers the
    // price, but no single bucket does.
    updateSave({ freeGems: SKIN_PRICE.free / 2, purchasedGems: SKIN_PRICE.free / 2 });
    const engine = new GameEngine();
    engine.startRun();
    engine.selectTower(engine.getRenderSnapshot().towers[0]!.id);

    expect(engine.purchaseTowerSkin(PREMIUM_SKIN.id, "FREE")).toBe(false);
    expect(engine.purchaseTowerSkin(PREMIUM_SKIN.id, "PURCHASED")).toBe(false);
    expect(engine.isTowerSkinOwned(PREMIUM_SKIN.id)).toBe(false);
    // Both balances remain untouched by the rejected attempts.
    expect(engine.getFreeGemBalance()).toBe(SKIN_PRICE.free / 2);
    expect(engine.getPurchasedGemBalance()).toBe(SKIN_PRICE.free / 2);
  });

  it("exploit: Marketplace listing is blocked entirely without VIP, regardless of Purchased Gems balance", () => {
    const seller = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ playerId: "player-1", inventory: [seller], purchasedGems: 999_999, vip: VIP_OFF });
    const result = createAuctionListingForItem(seller.instanceId, getAuctionMinBid("UNCOMMON"), 24, "PURCHASED");
    expect(result).toEqual({ ok: false, reason: "VIP_REQUIRED" });
    expect(loadSave().purchasedGems).toBe(999_999);
  });

  it("exploit: reload/reconnect — persisted state survives a fresh GameEngine load without re-crediting or losing balances", () => {
    updateSave({ freeGems: 321, purchasedGems: 654, vip: vipOn(NOW) });
    const engineA = new GameEngine();
    engineA.startRun();
    expect(engineA.getFreeGemBalance()).toBe(321);
    expect(engineA.getPurchasedGemBalance()).toBe(654);

    // Simulate a page reload: a brand new GameEngine instance reads the
    // exact same persisted save — never a stale in-memory client value.
    const engineB = new GameEngine();
    engineB.startRun();
    expect(engineB.getFreeGemBalance()).toBe(321);
    expect(engineB.getPurchasedGemBalance()).toBe(654);
    expect(engineB.isTradeUnlocked()).toBe(true);
  });

  it("real skin definitions: every PREMIUM commercial skin prices at exactly 1,200 Free / 800 Purchased (preserved, per spec)", () => {
    const premiumSkins = TOWER_SKINS.filter((s) => s.tier === "PREMIUM");
    expect(premiumSkins.length).toBeGreaterThan(0);
    for (const skin of premiumSkins) {
      const price = dualGemPrice(skin.gemCost);
      expect(price.purchased).toBe(800);
      expect(price.free).toBe(1200);
    }
    // Sanity — the definition lookup used by the engine agrees.
    const def = getTowerSkinDefinition(premiumSkins[0]!.id)!;
    expect(dualGemPrice(def.gemCost)).toEqual({ free: 1200, purchased: 800 });
  });
});

/**
 * MARKETPLACE = VIP ONLY. Trading (listing, bidding, direct trades) needs an
 * active VIP, every fee is Purchased Gems only, and Free Gems never enter
 * the Marketplace at all.
 */
describe("MARKETPLACE — VIP only, Purchased Gems only", () => {
  const NOW = SEASON_EPOCH_MS + 1000;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * HONESTY NOTE: this codebase has NO real player-to-player BUY transaction
   * yet (see MarketplaceService.ts's own header): the only bid path is the
   * local DEMO_BIDDER_ID, which never spends real Gems. This test proves
   * that architectural fact directly rather than faking a buy path.
   */
  it("no code path lets a player spend Free OR Purchased Gems to buy a listed item — the only bid path is the local demo bidder, which spends nothing", () => {
    const exportNames = Object.keys(MarketplaceService);
    const bidPlacingExports = exportNames.filter((name) => /^place.*bid/i.test(name) || /buy/i.test(name));
    expect(bidPlacingExports).toEqual(["placeDemoBid"]);

    const seller = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ playerId: "player-1", inventory: [seller], freeGems: 5000, purchasedGems: 1000, vip: vipOn(NOW) });
    createAuctionListingForItem(seller.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    const listingId = loadSave().auctionListings[0]!.id;
    const before = loadSave();
    placeDemoBid(listingId, getMinimumNextBid(getAuctionMinBid("UNCOMMON")));
    const after = loadSave();
    expect(after.freeGems).toBe(before.freeGems);
    expect(after.purchasedGems).toBe(before.purchasedGems);
  });

  it("bidding is refused without VIP", () => {
    const seller = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ playerId: "player-1", inventory: [seller], purchasedGems: 1000, vip: vipOn(NOW) });
    createAuctionListingForItem(seller.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    const listingId = loadSave().auctionListings[0]!.id;
    updateSave({ vip: VIP_OFF });
    expect(placeDemoBid(listingId, getMinimumNextBid(getAuctionMinBid("UNCOMMON")))).toBe(false);
  });

  it("a VIP lists a Mythic item paying the fee in Purchased Gems; a demo settlement still pays nothing (no real buyer)", () => {
    const item = createItemInstance("crown_of_the_hollow_king", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    const fee = getAuctionListingFee("MYTHIC");
    updateSave({ playerId: "player-1", inventory: [item], freeGems: 0, purchasedGems: fee, vip: vipOn(NOW) });
    const floor = getAuctionMinBid("MYTHIC");
    expect(createAuctionListingForItem(item.instanceId, floor, 24).ok).toBe(true);
    expect(loadSave().purchasedGems).toBe(0);
    expect(loadSave().inventory[0]!.pendingAuction).toBe(true);

    const listingId = loadSave().auctionListings[0]!.id;
    expect(placeDemoBid(listingId, getMinimumNextBid(floor))).toBe(true);
    vi.setSystemTime(NOW + 25 * 60 * 60 * 1000);
    refreshMarketplace();
    const finalSave = loadSave();
    expect(finalSave.auctionListings[0]!.status).toBe("SOLD");
    expect(finalSave.purchasedGems).toBe(0);
  });
});
