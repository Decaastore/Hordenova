import { generateId } from "@/utils/id";

/**
 * HORDENOVA LEDGER — Item System spec section 20. NOT a blockchain: a
 * plain, local, append-only event log recording every state change the
 * economy cares about, shaped so a future backend can accept the exact
 * same event records over an API (spec section 31) instead of this file's
 * localStorage write.
 *
 * Kept in its OWN storage key, separate from SaveSystem's save blob — it's
 * an audit trail, not player-resumable state, and grows differently (it
 * only ever appends). Capped locally at LEDGER_MAX_EVENTS because a
 * client-side log has to fit in localStorage; a server-side ledger would
 * not need this cap; the cap is a local-storage limitation, not a design
 * intent, so it's called out here rather than silently dropped.
 */
export type LedgerEventType =
  | "ITEM_CREATED"
  | "ITEM_DROPPED"
  | "ITEM_ACQUIRED"
  | "ITEM_TRADED"
  | "ITEM_CONSUMED"
  | "ITEM_DESTROYED"
  | "ITEM_BOUND";

export interface LedgerEvent {
  eventId: string;
  timestamp: number;
  eventType: LedgerEventType;
  itemInstanceId: string;
  itemDefinitionId: string;
  fromOwner: string | null;
  toOwner: string | null;
  /** Free-form provenance string — a boss id, "trade:<sessionId>", etc. */
  source: string;
}

const LEDGER_STORAGE_KEY = "hordenova.ledger.v1";
const LEDGER_MAX_EVENTS = 500;

function isStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function isValidEvent(raw: unknown): raw is LedgerEvent {
  if (!raw || typeof raw !== "object") return false;
  const e = raw as Partial<LedgerEvent>;
  return (
    typeof e.eventId === "string" &&
    typeof e.timestamp === "number" &&
    typeof e.eventType === "string" &&
    typeof e.itemInstanceId === "string" &&
    typeof e.itemDefinitionId === "string" &&
    typeof e.source === "string"
  );
}

export function getLedgerEvents(): LedgerEvent[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEvent);
  } catch {
    return [];
  }
}

/** Appends one event and returns it (with its assigned eventId/timestamp). Trims the oldest events past LEDGER_MAX_EVENTS — see file header. */
export function appendLedgerEvent(event: Omit<LedgerEvent, "eventId" | "timestamp">, now = Date.now()): LedgerEvent {
  const full: LedgerEvent = { ...event, eventId: generateId("ledger"), timestamp: now };
  if (!isStorageAvailable()) return full;
  try {
    const events = getLedgerEvents();
    events.push(full);
    const trimmed = events.length > LEDGER_MAX_EVENTS ? events.slice(events.length - LEDGER_MAX_EVENTS) : events;
    window.localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage unavailable/full — the event still happened in-memory (the
    // caller has `full`), it just won't be queryable after reload.
  }
  return full;
}

/** Item History (spec section 22) — every ledger event for one item instance, oldest first. */
export function getItemHistory(instanceId: string): LedgerEvent[] {
  return getLedgerEvents()
    .filter((e) => e.itemInstanceId === instanceId)
    .sort((a, b) => a.timestamp - b.timestamp);
}
