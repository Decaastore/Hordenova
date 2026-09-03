/**
 * World First — Item System spec section 19. The RECORD shape here is
 * exactly what a future backend endpoint would need to arbitrate a real
 * global "first ever" across all players (playerId + itemDefinitionId +
 * instanceId + timestamp). What this file does NOT do, because it's
 * impossible to do honestly from a single local save, is claim a GLOBAL
 * first — that requires a server comparing across every player. Locally
 * we can only ever know "first time I found this on THIS device", so
 * that's exactly what's tracked and exactly how the UI must label it
 * (spec section 33: no fake global claims).
 */
export interface LocalFirstRecord {
  itemDefinitionId: string;
  instanceId: string;
  playerId: string;
  obtainedAt: number;
}

/** SaveData.localFirstDiscoveries maps itemDefinitionId -> the record for the first copy this save ever obtained. */
export type LocalFirstDiscoveries = Record<string, LocalFirstRecord>;

/**
 * Returns the record to persist if `itemDefinitionId` has never been seen
 * in `existing` before, or null if it has (nothing to record). Pure —
 * caller decides whether/how to persist.
 */
export function checkLocalFirst(
  existing: LocalFirstDiscoveries,
  itemDefinitionId: string,
  instanceId: string,
  playerId: string,
  now = Date.now(),
): LocalFirstRecord | null {
  if (existing[itemDefinitionId]) return null;
  return { itemDefinitionId, instanceId, playerId, obtainedAt: now };
}
