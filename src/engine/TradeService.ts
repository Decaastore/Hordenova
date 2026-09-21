import { loadSave, updateSave, type SaveData } from "./SaveSystem";
import { appendLedgerEvent } from "./EconomyLedger";
import { isItemEquippedAnywhere } from "./InventoryManager";
import type { ItemInstance } from "@/entities/Item";
import {
  addItemToOffer,
  canOfferItemInTrade,
  cancelTrade,
  confirmOffer,
  executeTrade,
  removeItemFromOffer,
  setPurchasedGemsOffer,
  type TradeExecutionOutcome,
  type TradePartySnapshot,
  type TradeSession,
} from "./TradeManager";

/**
 * PLAYER ECONOMY UNIFICATION — meta-screen orchestration for Direct
 * Inventory Trade, mirroring MarketplaceService.ts's exact pattern: this
 * module reads/writes the ONE permanent SaveData directly via loadSave/
 * updateSave, same as every other non-gameplay screen. Trade shares the
 * SAME single unlock gate as the Marketplace (MarketplaceService.ts's
 * isTradeUnlocked/unlockTrade) — this file never re-implements or
 * duplicates that check; a future session-creation entry point (see below)
 * is the one place that must call it, exactly like createAuctionListingForItem
 * already does for listing.
 *
 * HONESTY NOTE (matches ui/TradeScreen.tsx's and engine/TradeManager.ts's
 * own headers): there is no real second player/matchmaking backend in this
 * build. Every function below operates on `save.activeTradeSession`, which
 * only a future matchmaking layer will ever populate by calling
 * TradeManager.createTradeSession(myPlayerId, realPartnerId) and persisting
 * it here — so in practice `activeTradeSession` is null today and these
 * functions are unreachable from the live UI, by design, rather than wired
 * to a fabricated counterpart. `executeActiveTradeWithCounterpart` makes
 * that seam explicit: it takes the counterpart's inventory/Gems/equipped
 * set as real parameters a future backend integration supplies, and never
 * invents them locally.
 */

function myOfferKey(save: SaveData, session: TradeSession): "offerA" | "offerB" | null {
  if (session.playerAId === save.playerId) return "offerA";
  if (session.playerBId === save.playerId) return "offerB";
  return null;
}

export function getActiveTradeSession(): TradeSession | null {
  return loadSave().activeTradeSession;
}

/** This save's own side of the active session, or null if there is none / this save isn't a party to it. */
export function getMyTradeOffer(): TradeSession["offerA"] | null {
  const save = loadSave();
  const session = save.activeTradeSession;
  if (!session) return null;
  const key = myOfferKey(save, session);
  return key ? session[key] : null;
}

/** Every item this save could legally place into a trade offer right now — tradable, not already locked elsewhere, and not currently equipped on a tower (spec section 12/14). */
export function getEligibleTradeItems(): ItemInstance[] {
  const save = loadSave();
  return save.inventory.filter((item) =>
    canOfferItemInTrade(item, save.playerId, isItemEquippedAnywhere(save.towerLoadout, item.instanceId)),
  );
}

function updateActiveSession(mutate: (session: TradeSession, save: SaveData) => TradeSession): TradeSession | null {
  const save = loadSave();
  if (!save.activeTradeSession) return null;
  const updated = mutate(save.activeTradeSession, save);
  updateSave({ activeTradeSession: updated });
  return updated;
}

export function addItemToMyTradeOffer(instanceId: string): TradeSession | null {
  return updateActiveSession((session, save) => addItemToOffer(session, save.playerId, instanceId));
}

export function removeItemFromMyTradeOffer(instanceId: string): TradeSession | null {
  return updateActiveSession((session, save) => removeItemFromOffer(session, save.playerId, instanceId));
}

/** Sets this save's 💎 Purchased Gems offer. There is deliberately no Free Gems equivalent — see engine/TradeManager.ts's own header. */
export function setMyTradePurchasedGemsOffer(amount: number): TradeSession | null {
  return updateActiveSession((session, save) => setPurchasedGemsOffer(session, save.playerId, amount));
}

export function confirmMyTradeOffer(): TradeSession | null {
  return updateActiveSession((session, save) => confirmOffer(session, save.playerId));
}

/** Either party can cancel a still-PENDING session — mirrors cancelMyAuctionListing's zero-bids-only spirit: nothing has moved yet, so there's nothing to protect against. */
export function cancelActiveTrade(): boolean {
  const save = loadSave();
  if (!save.activeTradeSession) return false;
  updateSave({ activeTradeSession: cancelTrade(save.activeTradeSession) });
  return true;
}

/**
 * The one function that actually moves items/Gems — and the one honest
 * seam in this file. It takes the COUNTERPART's real inventory, Purchased
 * Gems balance, and equipped-instance-id set as explicit parameters,
 * exactly like TradeManager.executeTrade itself, rather than sourcing them
 * from anywhere local (there is nowhere local to source a second real
 * player's data from — see this file's own header). This save's own side
 * (inventory, purchasedGems, activeTradeSession) is the only state this
 * function ever persists; delivering the transfer back to the counterpart's
 * own real save is a future backend's job, not this function's.
 */
export function executeActiveTradeWithCounterpart(
  counterpartInventory: readonly ItemInstance[],
  counterpartPurchasedGems: number,
  counterpartEquippedInstanceIds: ReadonlySet<string> = new Set(),
): TradeExecutionOutcome {
  const save = loadSave();
  const session = save.activeTradeSession;
  if (!session) return { ok: false, reason: "NOT_PENDING" };

  const iAmPlayerA = session.playerAId === save.playerId;
  const myEquipped = new Set(save.towerLoadout.flatMap((t) => (t.equippedItemInstanceIds ?? []).filter((id): id is string => !!id)));
  const myParty: TradePartySnapshot = { inventory: save.inventory, purchasedGemsBalance: save.purchasedGems, equippedInstanceIds: myEquipped };
  const counterpartParty: TradePartySnapshot = {
    inventory: counterpartInventory,
    purchasedGemsBalance: counterpartPurchasedGems,
    equippedInstanceIds: counterpartEquippedInstanceIds,
  };

  const outcome = iAmPlayerA ? executeTrade(session, myParty, counterpartParty) : executeTrade(session, counterpartParty, myParty);
  if (!outcome.ok) return outcome;

  const myUpdatedInventory = iAmPlayerA ? outcome.updatedInventoryA : outcome.updatedInventoryB;
  const myPurchasedGemsDelta = iAmPlayerA ? outcome.purchasedGemsDeltaA : outcome.purchasedGemsDeltaB;

  for (const event of outcome.ledgerEvents) appendLedgerEvent(event);
  updateSave({
    inventory: myUpdatedInventory,
    purchasedGems: save.purchasedGems + myPurchasedGemsDelta,
    activeTradeSession: outcome.session,
  });
  return outcome;
}
