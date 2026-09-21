import { generateId } from "@/utils/id";
import type { ItemInstance } from "@/entities/Item";
import type { LedgerEvent } from "./EconomyLedger";

/**
 * PLAYER ECONOMY UNIFICATION — Direct Inventory Trade, gated behind the
 * exact SAME single unlock as the Marketplace (MarketplaceService.ts's
 * isTradeUnlocked/unlockTrade — never a second charge; see that file's own
 * header). Every function here is PURE — no localStorage, no ledger writes
 * — so the exact same functions can run inside a future server process
 * untouched; a caller (GameEngine or a server handler, later) is the only
 * thing that persists results and appends ledger events.
 *
 * ONLY 💎 PURCHASED GEMS MAY EVER MOVE THROUGH A TRADE (spec section 4):
 * `TradeOffer.purchasedGems` is the ONLY currency field this module knows
 * about — there is no `freeGems` field anywhere in this shape, by
 * construction, so a Free Gems trade isn't merely disallowed, it's
 * inexpressible. Free Gems remain a pure single-player progression
 * currency (gameplay-earned, never transferable) exactly like config/
 * gemsEconomy.ts's own header already establishes for the Marketplace.
 *
 * There is currently no real second player to trade with (no multiplayer
 * backend). This module is still fully built and tested against synthetic
 * two-owner scenarios, ready for a future matchmaking layer to call
 * createTradeSession(myPlayerId, realPartnerId) and persist the result —
 * see engine/TradeService.ts and ui/TradeScreen.tsx for how the rest of the
 * app is wired to that same "engine-ready, no fake counterpart" stance.
 */
export interface TradeOffer {
  playerId: string;
  itemInstanceIds: string[];
  /** 💎 Purchased Gems only — see this file's own header for why Free Gems cannot appear here. */
  purchasedGems: number;
  confirmed: boolean;
}

export type TradeStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export interface TradeSession {
  id: string;
  createdAt: number;
  playerAId: string;
  playerBId: string;
  offerA: TradeOffer;
  offerB: TradeOffer;
  status: TradeStatus;
  completedAt: number | null;
}

function emptyOffer(playerId: string): TradeOffer {
  return { playerId, itemInstanceIds: [], purchasedGems: 0, confirmed: false };
}

export function createTradeSession(playerAId: string, playerBId: string, now = Date.now()): TradeSession {
  return {
    id: generateId("trade"),
    createdAt: now,
    playerAId,
    playerBId,
    offerA: emptyOffer(playerAId),
    offerB: emptyOffer(playerBId),
    status: "PENDING",
    completedAt: null,
  };
}

function offerKeyFor(session: TradeSession, playerId: string): "offerA" | "offerB" | null {
  if (playerId === session.playerAId) return "offerA";
  if (playerId === session.playerBId) return "offerB";
  return null;
}

/** Any change to either offer un-confirms BOTH sides — spec section 10's "se qualquer jogador modificar... a confirmação anterior deve ser invalidada" is prevented structurally: you cannot be in a confirmed state next to a stale offer. */
function withOfferChange(session: TradeSession, key: "offerA" | "offerB", offer: TradeOffer): TradeSession {
  return {
    ...session,
    offerA: { ...session.offerA, confirmed: false },
    offerB: { ...session.offerB, confirmed: false },
    [key]: { ...offer, confirmed: false },
  };
}

export function addItemToOffer(session: TradeSession, playerId: string, instanceId: string): TradeSession {
  const key = offerKeyFor(session, playerId);
  if (!key || session.status !== "PENDING") return session;
  const offer = session[key];
  if (offer.itemInstanceIds.includes(instanceId)) return session;
  return withOfferChange(session, key, { ...offer, itemInstanceIds: [...offer.itemInstanceIds, instanceId] });
}

export function removeItemFromOffer(session: TradeSession, playerId: string, instanceId: string): TradeSession {
  const key = offerKeyFor(session, playerId);
  if (!key || session.status !== "PENDING") return session;
  const offer = session[key];
  return withOfferChange(session, key, { ...offer, itemInstanceIds: offer.itemInstanceIds.filter((id) => id !== instanceId) });
}

/** Sets this side's 💎 Purchased Gems offer. There is deliberately no equivalent for Free Gems anywhere in this module — see this file's own header. */
export function setPurchasedGemsOffer(session: TradeSession, playerId: string, amount: number): TradeSession {
  const key = offerKeyFor(session, playerId);
  if (!key || session.status !== "PENDING" || amount < 0) return session;
  return withOfferChange(session, key, { ...session[key], purchasedGems: amount });
}

export function confirmOffer(session: TradeSession, playerId: string): TradeSession {
  const key = offerKeyFor(session, playerId);
  if (!key || session.status !== "PENDING") return session;
  return { ...session, [key]: { ...session[key], confirmed: true } };
}

export function cancelTrade(session: TradeSession, now = Date.now()): TradeSession {
  if (session.status !== "PENDING") return session;
  return { ...session, status: "CANCELLED", completedAt: now };
}

export type TradeFailureReason =
  | "NOT_PENDING"
  | "NOT_CONFIRMED"
  | "ITEM_NOT_FOUND"
  | "ITEM_NOT_OWNED"
  | "ITEM_NOT_TRADABLE"
  | "ITEM_ALREADY_PENDING_ELSEWHERE"
  | "ITEM_EQUIPPED"
  | "DUPLICATE_ITEM_IN_OFFER"
  | "INSUFFICIENT_PURCHASED_GEMS";

/**
 * Everything validateTradeExecution/executeTrade need to know about ONE
 * side of a trade, bundled so the two functions can't drift on argument
 * order as more checks (like the Gems-balance one below) get added over
 * time. `equippedInstanceIds` defaults to empty (nothing equipped).
 */
export interface TradePartySnapshot {
  inventory: readonly ItemInstance[];
  /** 💎 Purchased Gems this side actually has right now — re-checked at commit time exactly like ownership/tradability, so an offer built when affordable can't silently execute after the balance dropped (spec section 24's "saldo insuficiente"). */
  purchasedGemsBalance: number;
  equippedInstanceIds?: ReadonlySet<string>;
}

export type TradeValidationResult = { ok: true } | { ok: false; reason: TradeFailureReason; instanceId?: string };

/**
 * The one place the UI (and validateTradeExecution below) both ask "can
 * this exact item go into a trade offer right now" — mirrors
 * engine/AuctionManager.ts's canListItemForAuction shape exactly, so the
 * two systems can never drift into disagreeing about what's tradeable.
 * `isEquipped` closes the same "item listado e equipado ao mesmo tempo"
 * gap for Trade that it closes for the Marketplace — callers compute it via
 * InventoryManager.isItemEquippedAnywhere(save.towerLoadout, instanceId).
 */
export function canOfferItemInTrade(
  item: Pick<ItemInstance, "ownerId" | "tradable" | "pendingTrade" | "pendingAuction">,
  ownerId: string,
  isEquipped = false,
): boolean {
  return item.ownerId === ownerId && item.tradable && !item.pendingTrade && !item.pendingAuction && !isEquipped;
}

/**
 * Re-checks ground truth at commit time — exactly what a server would do
 * — rather than trusting whatever the offer looked like when items were
 * added. This is what actually prevents double-spend/duplication (spec
 * section 12): if `instanceId` was already traded away by a DIFFERENT
 * session between being offered and this session executing, its real
 * `ownerId` no longer matches the offering player, so this fails.
 * `equippedInstanceIds` closes the equip-then-trade race (spec section 12's
 * explicit "item listado e equipado ao mesmo tempo" case) the exact same
 * way canOfferItemInTrade does for the UI, and `purchasedGemsBalance`
 * closes the equally real "offered more Gems than actually owned" case
 * (spec section 24's "saldo insuficiente").
 */
export function validateTradeExecution(session: TradeSession, partyA: TradePartySnapshot, partyB: TradePartySnapshot): TradeValidationResult {
  if (session.status !== "PENDING") return { ok: false, reason: "NOT_PENDING" };
  if (!session.offerA.confirmed || !session.offerB.confirmed) return { ok: false, reason: "NOT_CONFIRMED" };

  const sides: [TradeOffer, TradePartySnapshot][] = [
    [session.offerA, partyA],
    [session.offerB, partyB],
  ];

  for (const [offer, party] of sides) {
    if (offer.purchasedGems > party.purchasedGemsBalance) return { ok: false, reason: "INSUFFICIENT_PURCHASED_GEMS" };

    const equipped = party.equippedInstanceIds ?? new Set<string>();
    const seen = new Set<string>();
    for (const instanceId of offer.itemInstanceIds) {
      if (seen.has(instanceId)) return { ok: false, reason: "DUPLICATE_ITEM_IN_OFFER", instanceId };
      seen.add(instanceId);

      const item = party.inventory.find((i) => i.instanceId === instanceId);
      if (!item) return { ok: false, reason: "ITEM_NOT_FOUND", instanceId };
      if (item.ownerId !== offer.playerId) return { ok: false, reason: "ITEM_NOT_OWNED", instanceId };
      if (!item.tradable) return { ok: false, reason: "ITEM_NOT_TRADABLE", instanceId };
      if (item.pendingTrade) return { ok: false, reason: "ITEM_ALREADY_PENDING_ELSEWHERE", instanceId };
      if (equipped.has(instanceId)) return { ok: false, reason: "ITEM_EQUIPPED", instanceId };
    }
  }

  return { ok: true };
}

export interface TradeExecutionResult {
  ok: true;
  session: TradeSession;
  updatedInventoryA: ItemInstance[];
  updatedInventoryB: ItemInstance[];
  /** Apply to playerA's purchasedGems (negative = paid out). Always 0 when neither side offered Gems. */
  purchasedGemsDeltaA: number;
  /** Apply to playerB's purchasedGems. */
  purchasedGemsDeltaB: number;
  /** Data-only ledger events — the caller (GameEngine) persists these via EconomyLedger.appendLedgerEvent. */
  ledgerEvents: Omit<LedgerEvent, "eventId" | "timestamp">[];
}

export type TradeExecutionOutcome = TradeExecutionResult | { ok: false; reason: TradeFailureReason; instanceId?: string };

/**
 * Atomically transfers ownership of every offered item on both sides AND
 * the net 💎 Purchased Gems delta, or changes nothing at all — never a
 * partial transfer (spec section 11). Gems and ledger events are returned
 * as data for the caller to apply/persist, keeping this function free of
 * any storage dependency.
 */
export function executeTrade(session: TradeSession, partyA: TradePartySnapshot, partyB: TradePartySnapshot, now = Date.now()): TradeExecutionOutcome {
  const validation = validateTradeExecution(session, partyA, partyB);
  if (!validation.ok) return validation;

  const transfer = (item: ItemInstance, toOwner: string): ItemInstance => ({
    ...item,
    ownerId: toOwner,
    pendingTrade: false,
    history: [...item.history, { timestamp: now, event: "TRADED", fromOwner: item.ownerId, toOwner }],
  });

  const aGivenIds = new Set(session.offerA.itemInstanceIds);
  const bGivenIds = new Set(session.offerB.itemInstanceIds);

  const aItemsGiven = partyA.inventory.filter((i) => aGivenIds.has(i.instanceId)).map((i) => transfer(i, session.playerBId));
  const bItemsGiven = partyB.inventory.filter((i) => bGivenIds.has(i.instanceId)).map((i) => transfer(i, session.playerAId));

  const updatedInventoryA = [...partyA.inventory.filter((i) => !aGivenIds.has(i.instanceId)), ...bItemsGiven];
  const updatedInventoryB = [...partyB.inventory.filter((i) => !bGivenIds.has(i.instanceId)), ...aItemsGiven];

  const ledgerEvents: Omit<LedgerEvent, "eventId" | "timestamp">[] = [
    ...aItemsGiven.map((item) => ({
      eventType: "ITEM_TRADED" as const,
      itemInstanceId: item.instanceId,
      itemDefinitionId: item.itemDefinitionId,
      fromOwner: session.playerAId,
      toOwner: session.playerBId,
      source: `trade:${session.id}`,
    })),
    ...bItemsGiven.map((item) => ({
      eventType: "ITEM_TRADED" as const,
      itemInstanceId: item.instanceId,
      itemDefinitionId: item.itemDefinitionId,
      fromOwner: session.playerBId,
      toOwner: session.playerAId,
      source: `trade:${session.id}`,
    })),
  ];

  // Net 💎 Purchased Gems flow — zero-sum between the two sides, so at most
  // ONE event describes it (mirrors ITEM_TRADED's per-direction shape, but
  // Gems only ever flow in one net direction per trade).
  const purchasedGemsDeltaA = session.offerB.purchasedGems - session.offerA.purchasedGems;
  const purchasedGemsDeltaB = purchasedGemsDeltaA === 0 ? 0 : -purchasedGemsDeltaA;
  if (purchasedGemsDeltaA !== 0) {
    const [fromOwner, toOwner] = purchasedGemsDeltaA < 0 ? [session.playerAId, session.playerBId] : [session.playerBId, session.playerAId];
    ledgerEvents.push({
      eventType: "GEMS_TRADED",
      fromOwner,
      toOwner,
      source: `trade:${session.id}`,
      amount: Math.abs(purchasedGemsDeltaA),
      currency: "PURCHASED",
    });
  }

  return {
    ok: true,
    session: { ...session, status: "COMPLETED", completedAt: now },
    updatedInventoryA,
    updatedInventoryB,
    purchasedGemsDeltaA,
    purchasedGemsDeltaB,
    ledgerEvents,
  };
}
