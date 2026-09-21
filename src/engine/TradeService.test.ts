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
    updateSave({ playerId: ME, tradeUnlocked: true });
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
    session = { ...session, offerB: { ...session.offerB, purchasedGems: 2000, confirmed: true } };
    updateSave({ activeTradeSession: session });

    const outcome = executeActiveTradeWithCounterpart([], 2000, new Set());
    expect(outcome.ok).toBe(true);

    const save = loadSave();
    expect(save.purchasedGems).toBe(2000);
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
    const outcome = executeActiveTradeWithCounterpart([], 500, new Set());
    expect(outcome.ok).toBe(false);

    const save = loadSave();
    expect(save.inventory).toHaveLength(1); // untouched — nothing moved
    expect(save.purchasedGems).toBe(0);
  });
});
