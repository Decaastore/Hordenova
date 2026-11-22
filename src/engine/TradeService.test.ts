import { checkTradeBalance, getAuctionListingFee, getAuctionMinBid } from "@/config/marketplace";
import { beforeEach, describe, expect, it } from "vitest";
import { loadSave, updateSave } from "./SaveSystem";
import { createItemInstance } from "@/entities/Item";
import { createTradeSession } from "./TradeManager";
import {
  addItemToMyTradeOffer,
  cancelActiveTrade,
  confirmMyTradeOffer,
  executeActiveTradeWithCounterpart,
  getActiveTradeSession,
  getEligibleTradeItems,
  getMyTradeOffer,
  removeItemFromMyTradeOffer,
  setMyTradePurchasedGemsOffer,
} from "./TradeService";

const ME = "player-me";
const PARTNER = "player-partner";

describe("engine/TradeService.ts — PLAYER ECONOMY UNIFICATION Direct Trade orchestration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    updateSave({ playerId: ME, vip: { until: Date.now() + 30 * 24 * 60 * 60 * 1000, lastGiftDay: -1 } });
  });

  it("getActiveTradeSession/getMyTradeOffer are null when nothing is being negotiated — the honest default in this no-matchmaking build", () => {
    expect(getActiveTradeSession()).toBeNull();
    expect(getMyTradeOffer()).toBeNull();
  });

  it("getEligibleTradeItems excludes not-owned/soulbound/already-locked/equipped items exactly like the Marketplace does", () => {
    const tradable = createItemInstance("mosswood_charm", ME, { type: "BOSS_DROP", refId: "hollow-warden" });
    const soulbound = createItemInstance("warden_fragment", ME, { type: "BOSS_DROP", refId: "hollow-warden" });
    const equipped = createItemInstance("ancient_core", ME, { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({
      inventory: [tradable, soulbound, equipped],
      towerLoadout: [
        {
          slotId: "slot-1",
          type: "IRONWOOD",
          level: 1,
          equippedItemInstanceIds: [equipped.instanceId, null, null],
        },
      ],
    });

    const eligible = getEligibleTradeItems().map((i) => i.instanceId);
    expect(eligible).toEqual([tradable.instanceId]);
  });

  it("a fresh session created by a (future) matchmaking layer is fully manipulable through this file's mutators", () => {
    const session = createTradeSession(ME, PARTNER);
    updateSave({ activeTradeSession: session });

    const item = createItemInstance("mosswood_charm", ME, { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ inventory: [item] });

    addItemToMyTradeOffer(item.instanceId);
    expect(getMyTradeOffer()!.itemInstanceIds).toEqual([item.instanceId]);

    setMyTradePurchasedGemsOffer(250);
    expect(getMyTradeOffer()!.purchasedGems).toBe(250);

    removeItemFromMyTradeOffer(item.instanceId);
    expect(getMyTradeOffer()!.itemInstanceIds).toEqual([]);

    confirmMyTradeOffer();
    expect(getMyTradeOffer()!.confirmed).toBe(true);
  });

  it("cancelActiveTrade clears the session and further mutation is a no-op", () => {
    updateSave({ activeTradeSession: createTradeSession(ME, PARTNER) });
    expect(cancelActiveTrade()).toBe(true);
    expect(getActiveTradeSession()!.status).toBe("CANCELLED");
    expect(cancelActiveTrade()).toBe(true); // cancelling an already-cancelled session is a harmless no-op, not a crash
    expect(addItemToMyTradeOffer("anything")).not.toBeNull(); // TradeManager itself no-ops mutation on a non-PENDING session
    expect(getMyTradeOffer()!.itemInstanceIds).toEqual([]);
  });

  it("executeActiveTradeWithCounterpart: full item<->Purchased Gems trade — mine transfers for real, counterpart data is supplied, never invented locally", () => {
    const myItem = createItemInstance("mosswood_charm", ME, { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ inventory: [myItem], purchasedGems: 0 });

    let session = createTradeSession(ME, PARTNER);
    updateSave({ activeTradeSession: session });
    addItemToMyTradeOffer(myItem.instanceId);
    confirmMyTradeOffer();

    // The counterpart's confirmed offer (2,000 Purchased Gems for my item) —
    // in a real deployment this would arrive from that account's own real
    // save via a backend; here it's supplied explicitly as the function's
    // own contract requires, never fabricated as if it were mine.
    session = getActiveTradeSession()!;
    session = { ...session, offerB: { ...session.offerB, purchasedGems: 300, confirmed: true } };
    updateSave({ activeTradeSession: session });

    const outcome = executeActiveTradeWithCounterpart([], 300, new Set(), true);
    expect(outcome.ok).toBe(true);

    const save = loadSave();
    // VIP: 10% tax (30) and the Uncommon item's auction listing fee come out of the 300 received
    expect(save.purchasedGems).toBe(300 - 30 - getAuctionListingFee("UNCOMMON"));
    expect(save.inventory).toHaveLength(0); // gave the item away
    expect(save.activeTradeSession!.status).toBe("COMPLETED");
  });

  it("executeActiveTradeWithCounterpart fails honestly (no partial state) when the counterpart's real Gems balance can't cover what they confirmed", () => {
    const myItem = createItemInstance("mosswood_charm", ME, { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ inventory: [myItem], purchasedGems: 0 });

    let session = createTradeSession(ME, PARTNER);
    updateSave({ activeTradeSession: session });
    addItemToMyTradeOffer(myItem.instanceId);
    confirmMyTradeOffer();

    session = getActiveTradeSession()!;
    session = { ...session, offerB: { ...session.offerB, purchasedGems: 2000, confirmed: true } };
    updateSave({ activeTradeSession: session });

    // The counterpart confirmed 2,000 but their real balance (supplied here) is only 500.
    const outcome = executeActiveTradeWithCounterpart([], 500, new Set(), true);
    expect(outcome.ok).toBe(false);

    const save = loadSave();
    expect(save.inventory).toHaveLength(1); // untouched — nothing moved
    expect(save.purchasedGems).toBe(0);
  });

  function sellCharmFor(gems: number) {
    const myItem = createItemInstance("mosswood_charm", ME, { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({ inventory: [myItem], purchasedGems: 0 });
    let session = createTradeSession(ME, PARTNER);
    updateSave({ activeTradeSession: session });
    addItemToMyTradeOffer(myItem.instanceId);
    confirmMyTradeOffer();
    session = getActiveTradeSession()!;
    session = { ...session, offerB: { ...session.offerB, purchasedGems: gems, confirmed: true } };
    updateSave({ activeTradeSession: session });
  }

  it("trades are open to a non-VIP player once they've cleared phase 5, with a 20% tax; locked before that, and when the other side is locked", () => {
    updateSave({ vip: { until: 0, lastGiftDay: -1 }, bestWave: 10 });
    sellCharmFor(300);
    expect(executeActiveTradeWithCounterpart([], 300, new Set(), true)).toEqual({ ok: false, reason: "TRADE_LOCKED" });
    updateSave({ bestWave: 200 });
    expect(executeActiveTradeWithCounterpart([], 300, new Set(), false)).toEqual({ ok: false, reason: "TRADE_LOCKED" });
    expect(executeActiveTradeWithCounterpart([], 300, new Set(), true).ok).toBe(true);
    expect(loadSave().purchasedGems).toBe(300 - 60 - getAuctionListingFee("UNCOMMON"));
  });

  it("a trade must be balanced like the auction: Gems at least the item's minimum bid and at most 10x it", () => {
    sellCharmFor(getAuctionMinBid("UNCOMMON") - 5);
    expect(executeActiveTradeWithCounterpart([], 9999, new Set(), true)).toEqual({ ok: false, reason: "UNBALANCED" });
    sellCharmFor(getAuctionMinBid("UNCOMMON") * 10 + 5);
    expect(executeActiveTradeWithCounterpart([], 9999, new Set(), true)).toEqual({ ok: false, reason: "UNBALANCED" });
    expect(loadSave().inventory).toHaveLength(1);
  });

  it("checkTradeBalance: no gifting — Gems for nothing, an item for nothing, or a lopsided swap are refused", () => {
    expect(checkTradeBalance({ rarities: [], gems: 500 }, { rarities: [], gems: 0 }).ok).toBe(false);
    expect(checkTradeBalance({ rarities: ["MYTHIC"], gems: 0 }, { rarities: [], gems: 0 }).ok).toBe(false);
    expect(checkTradeBalance({ rarities: ["MYTHIC"], gems: 0 }, { rarities: ["COMMON"], gems: 0 }).ok).toBe(false);
    expect(checkTradeBalance({ rarities: ["RARE"], gems: 0 }, { rarities: ["RARE"], gems: 0 }).ok).toBe(true);
    expect(checkTradeBalance({ rarities: ["EPIC"], gems: 0 }, { rarities: ["RARE"], gems: 130 }).ok).toBe(true);
  });

  it("non-VIP players get 3 Gem sales a week (shared with the auction house cap)", () => {
    updateSave({ vip: { until: 0, lastGiftDay: -1 }, bestWave: 200 });
    for (let i = 0; i < 3; i++) {
      sellCharmFor(100);
      expect(executeActiveTradeWithCounterpart([], 100, new Set(), true).ok).toBe(true);
    }
    sellCharmFor(100);
    expect(executeActiveTradeWithCounterpart([], 100, new Set(), true)).toEqual({ ok: false, reason: "WEEKLY_LIMIT" });
  });
});
