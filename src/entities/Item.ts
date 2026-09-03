import { generateId } from "@/utils/id";
import { getItemDefinition } from "@/config/itemDefinitions";

/**
 * Item System spec section 8 — every tradable-grade item is an
 * INDIVIDUAL, uniquely-identified copy, not a `{ itemId: "sword", qty: 3 }`
 * stack entry. `instanceId` is what ownership, trades, and the ledger all
 * key off; `itemDefinitionId` is the template it was stamped from
 * (config/itemDefinitions.ts).
 */
export interface ItemAcquiredFrom {
  type: "BOSS_DROP" | "MINI_BOSS_DROP" | "PHASE_MILESTONE" | "TRADE";
  /** BossDefinition.id, phase-milestone id, or the completed TradeSession.id. */
  refId: string;
}

export interface ItemHistoryEntry {
  timestamp: number;
  /** "ACQUIRED" the first entry for every instance; "TRADED" for every ownership change after. */
  event: "ACQUIRED" | "TRADED";
  fromOwner: string | null;
  toOwner: string;
}

export interface ItemInstance {
  instanceId: string;
  itemDefinitionId: string;
  ownerId: string;
  acquiredAt: number;
  source: ItemAcquiredFrom;
  /** Denormalized from the definition at creation time (spec section 17) — a definition could theoretically be re-tuned later without silently changing already-owned copies' tradability. */
  tradable: boolean;
  /** True once involved in a TradeManager session that hasn't completed or been cancelled yet — blocks a second concurrent trade from touching the same instance (spec section 16: no double-spend). */
  pendingTrade: boolean;
  history: ItemHistoryEntry[];
}

export function createItemInstance(itemDefinitionId: string, ownerId: string, source: ItemAcquiredFrom, now = Date.now()): ItemInstance {
  const def = getItemDefinition(itemDefinitionId);
  return {
    instanceId: generateId("item"),
    itemDefinitionId,
    ownerId,
    acquiredAt: now,
    source,
    tradable: def?.tradable ?? false,
    pendingTrade: false,
    history: [{ timestamp: now, event: "ACQUIRED", fromOwner: null, toOwner: ownerId }],
  };
}
