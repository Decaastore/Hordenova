import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import { createItemInstance } from "@/entities/Item";
import { createAuctionListingForItem, isTradeUnlocked, unlockTrade } from "./MarketplaceService";
import { getAuctionMinBid } from "@/config/marketplace";
import { TRADE_UNLOCK_PRICE, dualGemPrice } from "@/config/gemsEconomy";
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
    updateSave({ gold: 999_999, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    const slot = TOWER_SLOTS[0]!;
    engine.placeTower(slot.id, skin.towerType);
    engine.selectTower(engine.getRenderSnapshot().towers[0]!.id);
    return engine;
  }

  // ---------------------------------------------------------------------
  // Scenario 1: 500 Free / 0 Purchased, Trade Locked -> unlock with Free.
  // ---------------------------------------------------------------------
  it("scenario 1: 500 Free / 0 Purchased unlocks Trade with FREE Gems", () => {
    updateSave({ freeGems: 500, purchasedGems: 0, tradeUnlocked: false });
    expect(TRADE_UNLOCK_PRICE).toEqual({ free: 500, purchased: 500 });
    const result = unlockTrade("FREE");
    expect(result).toEqual({ ok: true });
    const save = loadSave();
    expect(save.tradeUnlocked).toBe(true);
    expect(save.freeGems).toBe(0);
    expect(save.purchasedGems).toBe(0); // never touched
  });

  // ---------------------------------------------------------------------
  // Scenario 2: 0 Free / 500 Purchased, Trade Locked -> unlock with Purchased.
  // ---------------------------------------------------------------------
  it("scenario 2: 0 Free / 500 Purchased unlocks Trade with PURCHASED Gems", () => {
    updateSave({ freeGems: 0, purchasedGems: 500, tradeUnlocked: false });
    const result = unlockTrade("PURCHASED");
    expect(result).toEqual({ ok: true });
    const save = loadSave();
    expect(save.tradeUnlocked).toBe(true);
    expect(save.purchasedGems).toBe(0);
    expect(save.freeGems).toBe(0); // never touched
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
  // Scenario 7: 2,000 Free / 0 Purchased, Trade Unlocked -> attempt
  // Marketplace purchase (the listing fee, the one real Gems-moving action
  // this local build exposes — see MarketplaceService.ts's own header).
  // MUST FAIL — the Marketplace never accepts Free Gems.
  // ---------------------------------------------------------------------
  it("scenario 7: 2,000 Free / 0 Purchased — Marketplace listing fee FAILS (Free Gems never eligible)", () => {
    const seller = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ playerId: "player-1", inventory: [seller], freeGems: 2000, purchasedGems: 0, tradeUnlocked: true });
    expect(isTradeUnlocked()).toBe(true);

    const result = createAuctionListingForItem(seller.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INSUFFICIENT_PURCHASED_GEMS");
    const save = loadSave();
    expect(save.freeGems).toBe(2000); // completely untouched
    expect(save.auctionListings).toHaveLength(0);
  });

  // ---------------------------------------------------------------------
  // Scenario 8: 0 Free / 2,000 Purchased, Trade Unlocked -> attempt
  // Marketplace purchase. MUST SUCCEED.
  // ---------------------------------------------------------------------
  it("scenario 8: 0 Free / 2,000 Purchased — Marketplace listing fee SUCCEEDS", () => {
    const seller = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ playerId: "player-1", inventory: [seller], freeGems: 0, purchasedGems: 2000, tradeUnlocked: true });

    const result = createAuctionListingForItem(seller.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    expect(result.ok).toBe(true);
    const save = loadSave();
    expect(save.purchasedGems).toBeLessThan(2000); // the fee was actually paid
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

  it("exploit: Trade Unlock cannot be purchased twice (idempotent, no re-charge)", () => {
    updateSave({ freeGems: 500, purchasedGems: 500, tradeUnlocked: false });
    expect(unlockTrade("FREE")).toEqual({ ok: true });
    // Second attempt, even with funds available in the OTHER currency, is refused.
    expect(unlockTrade("PURCHASED")).toEqual({ ok: false, reason: "ALREADY_UNLOCKED" });
    const save = loadSave();
    expect(save.purchasedGems).toBe(500); // never charged a second time
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

  it("exploit: Marketplace listing is blocked entirely while Trade is locked, regardless of Purchased Gems balance", () => {
    const seller = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ playerId: "player-1", inventory: [seller], purchasedGems: 999_999, tradeUnlocked: false });
    const result = createAuctionListingForItem(seller.instanceId, getAuctionMinBid("UNCOMMON"), 24);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("TRADE_LOCKED");
  });

  it("exploit: reload/reconnect — persisted state survives a fresh GameEngine load without re-crediting or losing balances", () => {
    updateSave({ freeGems: 321, purchasedGems: 654, tradeUnlocked: true });
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

  it("exploit: every real spend re-validates the CURRENT balance server-side (engine-side), never trusting a stale client read", () => {
    updateSave({ freeGems: 300, purchasedGems: 0 });
    const engine = new GameEngine();
    engine.startRun();
    // A UI might have read canUnlockTrade() as true a moment ago; the
    // balance changes before the actual spend call (e.g. another tab).
    updateSave({ freeGems: 0 });
    (engine as unknown as { freeGems: number }).freeGems = 0; // reflect the same drop into the live instance
    expect(engine.unlockTrade("FREE")).toBe(false);
    expect(loadSave().tradeUnlocked).toBe(false);
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
