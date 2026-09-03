import type { ItemInstance } from "@/entities/Item";
import type { LocalFirstDiscoveries } from "./WorldFirst";

/**
 * Item System spec sections 18/21/33 — "If the game shows a number, the
 * number must be real." This build has no backend and no cross-player
 * database, so it CANNOT know global owner counts, global drop counts, or
 * "players online" — and must not pretend to. Every field below is either
 * computed from data this device actually has, or is the literal
 * `available: false` sentinel the spec's own worked example asks for
 * ("Global statistics unavailable in offline/local mode.").
 */
export interface LocalItemStats {
  itemDefinitionId: string;
  /** How many copies of this definition THIS save currently owns (0 if none). */
  ownedCount: number;
  /** When this save first ever obtained a copy, or null if never. */
  firstAcquiredAt: number | null;
}

export function getLocalItemStats(inventory: readonly ItemInstance[], localFirstDiscoveries: LocalFirstDiscoveries, itemDefinitionId: string): LocalItemStats {
  return {
    itemDefinitionId,
    ownedCount: inventory.filter((item) => item.itemDefinitionId === itemDefinitionId).length,
    firstAcquiredAt: localFirstDiscoveries[itemDefinitionId]?.obtainedAt ?? null,
  };
}

export interface LocalEconomySummary {
  bossesDefeatedTotal: number;
  miniBossesDefeatedTotal: number;
  itemsOwnedTotal: number;
  itemsFoundTotal: number;
}

/** A discriminated union so the UI is FORCED to branch on `available` instead of accidentally rendering a fabricated global number. */
export type GlobalEconomyStats = { available: false } | { available: true; playersRegistered: number; itemsTraded: number };

/** Always `{ available: false }` in this local-only build — see file header. The shape is ready for a future API response to slot into the `true` branch without a UI rewrite. */
export function getGlobalEconomyStats(): GlobalEconomyStats {
  return { available: false };
}
