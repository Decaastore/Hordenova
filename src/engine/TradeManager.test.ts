import { describe, expect, it } from "vitest";
import {
  addItemToOffer,
  cancelTrade,
  confirmOffer,
  createTradeSession,
  executeTrade,
  removeItemFromOffer,
  setCurrencyOffer,
  validateTradeExecution,
} from "./TradeManager";
import { createItemInstance, type ItemInstance } from "@/entities/Item";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

function ownedBy(owner: string, defId = "ancient_core"): ItemInstance {
  return createItemInstance(defId, owner, { type: "BOSS_DROP", refId: "hollow-warden" });
}

describe("TradeManager", () => {
  it("createTradeSession starts PENDING with empty, unconfirmed offers on both sides", () => {
    const session = createTradeSession(PLAYER_A, PLAYER_B);
    expect(session.status).toBe("PENDING");
    expect(session.offerA).toEqual({ playerId: PLAYER_A, itemInstanceIds: [], currency: 0, confirmed: false });
    expect(session.offerB).toEqual({ playerId: PLAYER_B, itemInstanceIds: [], currency: 0, confirmed: false });
  });

  it("addItemToOffer adds to the correct side and ignores an unknown playerId", () => {
    let session = createTradeSession(PLAYER_A, PLAYER_B);
    session = addItemToOffer(session, PLAYER_A, "item-1");
    expect(session.offerA.itemInstanceIds).toEqual(["item-1"]);
    expect(session.offerB.itemInstanceIds).toEqual([]);

    const unchanged = addItemToOffer(session, "stranger", "item-2");
    expect(unchanged).toEqual(session);
  });

  it("does not add the same instanceId twice to one offer", () => {
    let session = createTradeSession(PLAYER_A, PLAYER_B);
    session = addItemToOffer(session, PLAYER_A, "item-1");
    session = addItemToOffer(session, PLAYER_A, "item-1");
    expect(session.offerA.itemInstanceIds).toEqual(["item-1"]);
  });

  it("changing either offer un-confirms BOTH sides — prevents committing against a stale offer (spec section 16)", () => {
    let session = createTradeSession(PLAYER_A, PLAYER_B);
    session = confirmOffer(session, PLAYER_A);
    session = confirmOffer(session, PLAYER_B);
    expect(session.offerA.confirmed && session.offerB.confirmed).toBe(true);

    session = addItemToOffer(session, PLAYER_B, "surprise-item");
    expect(session.offerA.confirmed).toBe(false);
    expect(session.offerB.confirmed).toBe(false);
  });

  it("setCurrencyOffer rejects a negative amount", () => {
    let session = createTradeSession(PLAYER_A, PLAYER_B);
    session = setCurrencyOffer(session, PLAYER_A, -50);
    expect(session.offerA.currency).toBe(0);
  });

  it("cancelTrade marks CANCELLED and further mutation is a no-op", () => {
    let session = createTradeSession(PLAYER_A, PLAYER_B);
    session = cancelTrade(session);
    expect(session.status).toBe("CANCELLED");
    const afterAdd = addItemToOffer(session, PLAYER_A, "item-1");
    expect(afterAdd.offerA.itemInstanceIds).toEqual([]);
  });

  describe("validateTradeExecution", () => {
    it("fails NOT_CONFIRMED when only one side confirmed", () => {
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = confirmOffer(session, PLAYER_A);
      const result = validateTradeExecution(session, [], []);
      expect(result).toEqual({ ok: false, reason: "NOT_CONFIRMED" });
    });

    it("fails ITEM_NOT_OWNED when the offered item actually belongs to someone else", () => {
      const itemOwnedByB = ownedBy(PLAYER_B);
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, itemOwnedByB.instanceId); // A tries to offer B's item
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = validateTradeExecution(session, [itemOwnedByB], []);
      expect(result).toEqual({ ok: false, reason: "ITEM_NOT_OWNED", instanceId: itemOwnedByB.instanceId });
    });

    it("fails ITEM_NOT_TRADABLE for a soulbound item", () => {
      const soulbound = ownedBy(PLAYER_A, "warden_fragment"); // soulbound by definition
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, soulbound.instanceId);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = validateTradeExecution(session, [soulbound], []);
      expect(result).toEqual({ ok: false, reason: "ITEM_NOT_TRADABLE", instanceId: soulbound.instanceId });
    });

    it("fails ITEM_NOT_FOUND when the item simply doesn't exist in the inventory", () => {
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, "ghost-item");
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = validateTradeExecution(session, [], []);
      expect(result).toEqual({ ok: false, reason: "ITEM_NOT_FOUND", instanceId: "ghost-item" });
    });
  });

  describe("executeTrade — the atomic ownership transfer", () => {
    it("transfers items both ways and moves currency in a single call, or nothing at all", () => {
      const aItem = ownedBy(PLAYER_A, "ancient_core");
      const bItem = ownedBy(PLAYER_B, "hollow_sigil");

      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, aItem.instanceId);
      session = addItemToOffer(session, PLAYER_B, bItem.instanceId);
      session = setCurrencyOffer(session, PLAYER_A, 100);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = executeTrade(session, [aItem], [bItem], 5000);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.session.status).toBe("COMPLETED");
      expect(result.updatedInventoryA).toHaveLength(1);
      expect(result.updatedInventoryA[0]!.instanceId).toBe(bItem.instanceId);
      expect(result.updatedInventoryA[0]!.ownerId).toBe(PLAYER_A);
      expect(result.updatedInventoryB).toHaveLength(1);
      expect(result.updatedInventoryB[0]!.instanceId).toBe(aItem.instanceId);
      expect(result.updatedInventoryB[0]!.ownerId).toBe(PLAYER_B);
      expect(result.currencyDeltaA).toBe(-100);
      expect(result.currencyDeltaB).toBe(100);
      expect(result.ledgerEvents).toHaveLength(2);
    });

    it("appends a TRADED history entry with the correct fromOwner/toOwner on the transferred item", () => {
      const aItem = ownedBy(PLAYER_A, "ancient_core");
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, aItem.instanceId);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = executeTrade(session, [aItem], [], 7777);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const transferred = result.updatedInventoryB[0]!;
      expect(transferred.history[transferred.history.length - 1]).toEqual({
        timestamp: 7777,
        event: "TRADED",
        fromOwner: PLAYER_A,
        toOwner: PLAYER_B,
      });
    });

    it("is a no-op (changes nothing) when validation fails", () => {
      const soulbound = ownedBy(PLAYER_A, "warden_fragment");
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, soulbound.instanceId);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = executeTrade(session, [soulbound], []);
      expect(result.ok).toBe(false);
    });

    it("prevents double-spend: a second trade session for the same already-traded item fails at execution, even though it looked valid when built (spec section 16)", () => {
      const contested = ownedBy(PLAYER_A, "ancient_core");

      // First trade: A -> B. Executes successfully.
      let sessionOne = createTradeSession(PLAYER_A, PLAYER_B);
      sessionOne = addItemToOffer(sessionOne, PLAYER_A, contested.instanceId);
      sessionOne = confirmOffer(confirmOffer(sessionOne, PLAYER_A), PLAYER_B);
      const resultOne = executeTrade(sessionOne, [contested], []);
      expect(resultOne.ok).toBe(true);
      if (!resultOne.ok) return;

      // Second trade: A tries to offer the SAME instanceId to a third party,
      // built from a STALE inventory snapshot taken before trade one ran.
      const PLAYER_C = "player-c";
      let sessionTwo = createTradeSession(PLAYER_A, PLAYER_C);
      sessionTwo = addItemToOffer(sessionTwo, PLAYER_A, contested.instanceId);
      sessionTwo = confirmOffer(confirmOffer(sessionTwo, PLAYER_A), PLAYER_C);

      // Ground truth: A's REAL current inventory (post-trade-one) no longer has it.
      const aRealInventoryNow = resultOne.updatedInventoryA; // [] — A gave it away
      const result = executeTrade(sessionTwo, aRealInventoryNow, []);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("ITEM_NOT_FOUND");
    });

    it("rejects a duplicate item within the same single offer", () => {
      const aItem = ownedBy(PLAYER_A, "ancient_core");
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, aItem.instanceId);
      // Force a duplicate directly (addItemToOffer itself already de-dupes, so
      // this simulates a malformed/tampered session reaching validation).
      session = { ...session, offerA: { ...session.offerA, itemInstanceIds: [aItem.instanceId, aItem.instanceId] } };
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = validateTradeExecution(session, [aItem], []);
      expect(result).toEqual({ ok: false, reason: "DUPLICATE_ITEM_IN_OFFER", instanceId: aItem.instanceId });
    });

    it("removeItemFromOffer takes an item back out before confirmation", () => {
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, "item-1");
      session = removeItemFromOffer(session, PLAYER_A, "item-1");
      expect(session.offerA.itemInstanceIds).toEqual([]);
    });
  });
});
