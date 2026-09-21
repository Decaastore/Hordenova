import { describe, expect, it } from "vitest";
import {
  addItemToOffer,
  canOfferItemInTrade,
  cancelTrade,
  confirmOffer,
  createTradeSession,
  executeTrade,
  removeItemFromOffer,
  setPurchasedGemsOffer,
  validateTradeExecution,
  type TradePartySnapshot,
} from "./TradeManager";
import { createItemInstance, type ItemInstance } from "@/entities/Item";

const PLAYER_A = "player-a";
const PLAYER_B = "player-b";

function ownedBy(owner: string, defId = "ancient_core"): ItemInstance {
  return createItemInstance(defId, owner, { type: "BOSS_DROP", refId: "hollow-warden" });
}

/** Builds a TradePartySnapshot with sensible defaults — a huge Gems balance (never the thing under test unless overridden) and no equipped items. */
function party(inventory: readonly ItemInstance[], overrides: Partial<TradePartySnapshot> = {}): TradePartySnapshot {
  return { inventory, purchasedGemsBalance: 1_000_000, equippedInstanceIds: new Set(), ...overrides };
}

describe("TradeManager", () => {
  it("createTradeSession starts PENDING with empty, unconfirmed offers on both sides", () => {
    const session = createTradeSession(PLAYER_A, PLAYER_B);
    expect(session.status).toBe("PENDING");
    expect(session.offerA).toEqual({ playerId: PLAYER_A, itemInstanceIds: [], purchasedGems: 0, confirmed: false });
    expect(session.offerB).toEqual({ playerId: PLAYER_B, itemInstanceIds: [], purchasedGems: 0, confirmed: false });
  });

  it("PLAYER ECONOMY UNIFICATION spec section 4: a TradeOffer has no freeGems field at all — Free Gems are structurally inexpressible in a trade, not merely hidden by the UI", () => {
    const session = createTradeSession(PLAYER_A, PLAYER_B);
    expect(Object.keys(session.offerA).sort()).toEqual(["confirmed", "itemInstanceIds", "playerId", "purchasedGems"]);
    expect("freeGems" in session.offerA).toBe(false);
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

  it("changing either offer un-confirms BOTH sides — prevents committing against a stale offer (spec section 10)", () => {
    let session = createTradeSession(PLAYER_A, PLAYER_B);
    session = confirmOffer(session, PLAYER_A);
    session = confirmOffer(session, PLAYER_B);
    expect(session.offerA.confirmed && session.offerB.confirmed).toBe(true);

    session = addItemToOffer(session, PLAYER_B, "surprise-item");
    expect(session.offerA.confirmed).toBe(false);
    expect(session.offerB.confirmed).toBe(false);
  });

  it("changing the Purchased Gems offer also un-confirms both sides (spec section 10's worked example: A confirmed, B lowers 2,000 -> 500 Gems, A loses its confirmation)", () => {
    let session = createTradeSession(PLAYER_A, PLAYER_B);
    session = setPurchasedGemsOffer(session, PLAYER_B, 2000);
    session = confirmOffer(session, PLAYER_A);
    session = confirmOffer(session, PLAYER_B);

    session = setPurchasedGemsOffer(session, PLAYER_B, 500);
    expect(session.offerA.confirmed).toBe(false);
    expect(session.offerB.confirmed).toBe(false);
  });

  it("setPurchasedGemsOffer rejects a negative amount", () => {
    let session = createTradeSession(PLAYER_A, PLAYER_B);
    session = setPurchasedGemsOffer(session, PLAYER_A, -50);
    expect(session.offerA.purchasedGems).toBe(0);
  });

  it("cancelTrade marks CANCELLED and further mutation is a no-op", () => {
    let session = createTradeSession(PLAYER_A, PLAYER_B);
    session = cancelTrade(session);
    expect(session.status).toBe("CANCELLED");
    const afterAdd = addItemToOffer(session, PLAYER_A, "item-1");
    expect(afterAdd.offerA.itemInstanceIds).toEqual([]);
  });

  describe("canOfferItemInTrade", () => {
    it("requires ownership, tradability, no existing lock, and not currently equipped", () => {
      const owned = ownedBy(PLAYER_A);
      expect(canOfferItemInTrade(owned, PLAYER_A)).toBe(true);
      expect(canOfferItemInTrade(owned, "someone-else")).toBe(false);
      expect(canOfferItemInTrade({ ...owned, tradable: false }, PLAYER_A)).toBe(false);
      expect(canOfferItemInTrade({ ...owned, pendingTrade: true }, PLAYER_A)).toBe(false);
      expect(canOfferItemInTrade({ ...owned, pendingAuction: true }, PLAYER_A)).toBe(false);
      expect(canOfferItemInTrade(owned, PLAYER_A, true)).toBe(false); // equipped
    });
  });

  describe("validateTradeExecution", () => {
    it("fails NOT_CONFIRMED when only one side confirmed", () => {
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = confirmOffer(session, PLAYER_A);
      const result = validateTradeExecution(session, party([]), party([]));
      expect(result).toEqual({ ok: false, reason: "NOT_CONFIRMED" });
    });

    it("fails ITEM_NOT_OWNED when the offered item actually belongs to someone else", () => {
      const itemOwnedByB = ownedBy(PLAYER_B);
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, itemOwnedByB.instanceId); // A tries to offer B's item
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = validateTradeExecution(session, party([itemOwnedByB]), party([]));
      expect(result).toEqual({ ok: false, reason: "ITEM_NOT_OWNED", instanceId: itemOwnedByB.instanceId });
    });

    it("fails ITEM_NOT_TRADABLE for a soulbound item", () => {
      const soulbound = ownedBy(PLAYER_A, "warden_fragment"); // soulbound by definition
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, soulbound.instanceId);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = validateTradeExecution(session, party([soulbound]), party([]));
      expect(result).toEqual({ ok: false, reason: "ITEM_NOT_TRADABLE", instanceId: soulbound.instanceId });
    });

    it("fails ITEM_NOT_FOUND when the item simply doesn't exist in the inventory", () => {
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, "ghost-item");
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = validateTradeExecution(session, party([]), party([]));
      expect(result).toEqual({ ok: false, reason: "ITEM_NOT_FOUND", instanceId: "ghost-item" });
    });

    it("PLAYER ECONOMY UNIFICATION spec section 12: fails ITEM_EQUIPPED when the offered item is currently equipped on a tower — closes the 'item listado e equipado ao mesmo tempo' race", () => {
      const equipped = ownedBy(PLAYER_A);
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, equipped.instanceId);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = validateTradeExecution(session, party([equipped], { equippedInstanceIds: new Set([equipped.instanceId]) }), party([]));
      expect(result).toEqual({ ok: false, reason: "ITEM_EQUIPPED", instanceId: equipped.instanceId });
    });

    it("spec section 24: fails INSUFFICIENT_PURCHASED_GEMS when a side offered more Gems than it actually has right now", () => {
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = setPurchasedGemsOffer(session, PLAYER_A, 2000);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      // A's real balance dropped to 500 (e.g. spent elsewhere) between
      // offering 2,000 and this commit-time re-check.
      const result = validateTradeExecution(session, party([], { purchasedGemsBalance: 500 }), party([]));
      expect(result).toEqual({ ok: false, reason: "INSUFFICIENT_PURCHASED_GEMS" });
    });
  });

  describe("executeTrade — the atomic ownership transfer", () => {
    it("transfers items both ways and moves Purchased Gems in a single call, or nothing at all", () => {
      const aItem = ownedBy(PLAYER_A, "ancient_core");
      const bItem = ownedBy(PLAYER_B, "hollow_sigil");

      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, aItem.instanceId);
      session = addItemToOffer(session, PLAYER_B, bItem.instanceId);
      session = setPurchasedGemsOffer(session, PLAYER_A, 100);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = executeTrade(session, party([aItem]), party([bItem]), 5000);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.session.status).toBe("COMPLETED");
      expect(result.updatedInventoryA).toHaveLength(1);
      expect(result.updatedInventoryA[0]!.instanceId).toBe(bItem.instanceId);
      expect(result.updatedInventoryA[0]!.ownerId).toBe(PLAYER_A);
      expect(result.updatedInventoryB).toHaveLength(1);
      expect(result.updatedInventoryB[0]!.instanceId).toBe(aItem.instanceId);
      expect(result.updatedInventoryB[0]!.ownerId).toBe(PLAYER_B);
      expect(result.purchasedGemsDeltaA).toBe(-100);
      expect(result.purchasedGemsDeltaB).toBe(100);
      expect(result.ledgerEvents).toHaveLength(3); // 2x ITEM_TRADED + 1x GEMS_TRADED
      const gemsEvent = result.ledgerEvents.find((e) => e.eventType === "GEMS_TRADED")!;
      expect(gemsEvent).toMatchObject({ fromOwner: PLAYER_A, toOwner: PLAYER_B, amount: 100, currency: "PURCHASED" });
    });

    it("spec section 3: Purchased Gems <-> Purchased Gems (no items either side) is a real, supported trade — the model never special-cased items as mandatory", () => {
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = setPurchasedGemsOffer(session, PLAYER_A, 500);
      session = setPurchasedGemsOffer(session, PLAYER_B, 800);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = executeTrade(session, party([]), party([]));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Net: B gave 800, received 500 back -> B nets -300; A nets +300.
      expect(result.purchasedGemsDeltaA).toBe(300);
      expect(result.purchasedGemsDeltaB).toBe(-300);
      expect(result.ledgerEvents).toHaveLength(1);
      expect(result.ledgerEvents[0]).toMatchObject({ eventType: "GEMS_TRADED", fromOwner: PLAYER_B, toOwner: PLAYER_A, amount: 300 });
    });

    it("a trade with equal Gems offers on both sides nets to zero and emits no GEMS_TRADED event", () => {
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = setPurchasedGemsOffer(session, PLAYER_A, 500);
      session = setPurchasedGemsOffer(session, PLAYER_B, 500);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = executeTrade(session, party([]), party([]));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.purchasedGemsDeltaA).toBe(0);
      expect(result.purchasedGemsDeltaB).toBe(0);
      expect(result.ledgerEvents).toHaveLength(0);
    });

    it("appends a TRADED history entry with the correct fromOwner/toOwner on the transferred item", () => {
      const aItem = ownedBy(PLAYER_A, "ancient_core");
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, aItem.instanceId);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = executeTrade(session, party([aItem]), party([]), 7777);
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

      const result = executeTrade(session, party([soulbound]), party([]));
      expect(result.ok).toBe(false);
    });

    it("is a no-op when an offered item is equipped on a tower — the equip-then-trade race", () => {
      const equipped = ownedBy(PLAYER_A);
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = addItemToOffer(session, PLAYER_A, equipped.instanceId);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = executeTrade(session, party([equipped], { equippedInstanceIds: new Set([equipped.instanceId]) }), party([]));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("ITEM_EQUIPPED");
    });

    it("is a no-op when a side's real Purchased Gems balance can't cover what it confirmed offering (spec section 24: saldo insuficiente)", () => {
      let session = createTradeSession(PLAYER_A, PLAYER_B);
      session = setPurchasedGemsOffer(session, PLAYER_A, 2000);
      session = confirmOffer(confirmOffer(session, PLAYER_A), PLAYER_B);

      const result = executeTrade(session, party([], { purchasedGemsBalance: 500 }), party([]));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("INSUFFICIENT_PURCHASED_GEMS");
    });

    it("prevents double-spend: a second trade session for the same already-traded item fails at execution, even though it looked valid when built (spec section 12)", () => {
      const contested = ownedBy(PLAYER_A, "ancient_core");

      // First trade: A -> B. Executes successfully.
      let sessionOne = createTradeSession(PLAYER_A, PLAYER_B);
      sessionOne = addItemToOffer(sessionOne, PLAYER_A, contested.instanceId);
      sessionOne = confirmOffer(confirmOffer(sessionOne, PLAYER_A), PLAYER_B);
      const resultOne = executeTrade(sessionOne, party([contested]), party([]));
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
      const result = executeTrade(sessionTwo, party(aRealInventoryNow), party([]));
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

      const result = validateTradeExecution(session, party([aItem]), party([]));
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
