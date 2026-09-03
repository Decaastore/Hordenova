import { generateId } from "@/utils/id";
import type { ItemInstance } from "@/entities/Item";
import type { LedgerEvent } from "./EconomyLedger";

/**
 * Item System spec sections 15/16/17 — a real trade state machine, modeled
 * as if the server were already authoritative (spec section 31: "não
 * confiar no cliente para... trade completion"). Every function here is
 * PURE — no localStorage, no ledger writes — so the exact same functions
 * can run inside a future server process untouched; GameEngine (or a
 * server handler, later) is the only thing that persists results and
 * appends ledger events.
 *
 * There is currently no real second player to trade with (no multiplayer
 * backend — spec sections 23/31 explicitly say not to build one yet).
 * This module is still fully built and tested against synthetic two-owner
 * scenarios, per spec section 35's own test list, rather than faking a
 * live counterpart in the UI (spec section 36: no fake players).
 */
export interface TradeOffer {
  playerId: string;
  itemInstanceIds: string[];
  currency: number;
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
  return { playerId, itemInstanceIds: [], currency: 0, confirmed: false };
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

/** Any change to either offer un-confirms BOTH sides — spec section 16's "confirmação com estado diferente do exibido" is prevented structurally: you cannot be in a confirmed state next to a stale offer. */
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

export function setCurrencyOffer(session: TradeSession, playerId: string, amount: number): TradeSession {
  const key = offerKeyFor(session, playerId);
  if (!key || session.status !== "PENDING" || amount < 0) return session;
  return withOfferChange(session, key, { ...session[key], currency: amount });
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
  | "DUPLICATE_ITEM_IN_OFFER";

export type TradeValidationResult = { ok: true } | { ok: false; reason: TradeFailureReason; instanceId?: string };

/**
 * Re-checks ground truth at commit time — exactly what a server would do
 * — rather than trusting whatever the offer looked like when items were
 * added. This is what actually prevents double-spend/duplication (spec
 * section 16): if `instanceId` was already traded away by a DIFFERENT
 * session between being offered and this session executing, its real
 * `ownerId` no longer matches the offering player, so this fails.
 */
export function validateTradeExecution(
  session: TradeSession,
  inventoryA: readonly ItemInstance[],
  inventoryB: readonly ItemInstance[],
): TradeValidationResult {
  if (session.status !== "PENDING") return { ok: false, reason: "NOT_PENDING" };
  if (!session.offerA.confirmed || !session.offerB.confirmed) return { ok: false, reason: "NOT_CONFIRMED" };

  const sides: [TradeOffer, readonly ItemInstance[]][] = [
    [session.offerA, inventoryA],
    [session.offerB, inventoryB],
  ];

  for (const [offer, inventory] of sides) {
    const seen = new Set<string>();
    for (const instanceId of offer.itemInstanceIds) {
      if (seen.has(instanceId)) return { ok: false, reason: "DUPLICATE_ITEM_IN_OFFER", instanceId };
      seen.add(instanceId);

      const item = inventory.find((i) => i.instanceId === instanceId);
      if (!item) return { ok: false, reason: "ITEM_NOT_FOUND", instanceId };
      if (item.ownerId !== offer.playerId) return { ok: false, reason: "ITEM_NOT_OWNED", instanceId };
      if (!item.tradable) return { ok: false, reason: "ITEM_NOT_TRADABLE", instanceId };
      if (item.pendingTrade) return { ok: false, reason: "ITEM_ALREADY_PENDING_ELSEWHERE", instanceId };
    }
  }

  return { ok: true };
}

export interface TradeExecutionResult {
  ok: true;
  session: TradeSession;
  updatedInventoryA: ItemInstance[];
  updatedInventoryB: ItemInstance[];
  /** Apply to playerA's gold (negative = paid out). */
  currencyDeltaA: number;
  /** Apply to playerB's gold. */
  currencyDeltaB: number;
  /** Data-only ledger events — the caller (GameEngine) persists these via EconomyLedger.appendLedgerEvent. */
  ledgerEvents: Omit<LedgerEvent, "eventId" | "timestamp">[];
}

export type TradeExecutionOutcome = TradeExecutionResult | { ok: false; reason: TradeFailureReason; instanceId?: string };

/**
 * Atomically transfers ownership of every offered item on both sides, or
 * changes nothing at all — never a partial transfer. Currency and ledger
 * events are returned as data for the caller to apply/persist, keeping
 * this function free of any storage dependency (spec section 31).
 */
export function executeTrade(
  session: TradeSession,
  inventoryA: readonly ItemInstance[],
  inventoryB: readonly ItemInstance[],
  now = Date.now(),
): TradeExecutionOutcome {
  const validation = validateTradeExecution(session, inventoryA, inventoryB);
  if (!validation.ok) return validation;

  const transfer = (item: ItemInstance, toOwner: string): ItemInstance => ({
    ...item,
    ownerId: toOwner,
    pendingTrade: false,
    history: [...item.history, { timestamp: now, event: "TRADED", fromOwner: item.ownerId, toOwner }],
  });

  const aGivenIds = new Set(session.offerA.itemInstanceIds);
  const bGivenIds = new Set(session.offerB.itemInstanceIds);

  const aItemsGiven = inventoryA.filter((i) => aGivenIds.has(i.instanceId)).map((i) => transfer(i, session.playerBId));
  const bItemsGiven = inventoryB.filter((i) => bGivenIds.has(i.instanceId)).map((i) => transfer(i, session.playerAId));

  const updatedInventoryA = [...inventoryA.filter((i) => !aGivenIds.has(i.instanceId)), ...bItemsGiven];
  const updatedInventoryB = [...inventoryB.filter((i) => !bGivenIds.has(i.instanceId)), ...aItemsGiven];

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

  return {
    ok: true,
    session: { ...session, status: "COMPLETED", completedAt: now },
    updatedInventoryA,
    updatedInventoryB,
    currencyDeltaA: session.offerB.currency - session.offerA.currency,
    currencyDeltaB: session.offerA.currency - session.offerB.currency,
    ledgerEvents,
  };
}
