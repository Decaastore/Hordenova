/**
 * Globally-unique ID generator for anything that must stay unique ACROSS
 * reloads/sessions — item instances, ledger events, trade sessions, the
 * local player id. Unlike the in-memory counters used for ephemeral
 * per-attempt entities (enemies/projectiles/towers, which reset every
 * reload and never need cross-session uniqueness), these IDs get persisted
 * and referenced by other persisted records, so a counter that resets to 1
 * on every page load would eventually collide. `crypto.randomUUID` is
 * exactly the scheme a future backend would also assign, so this needs no
 * rework when item/trade creation moves server-side.
 */
export function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
