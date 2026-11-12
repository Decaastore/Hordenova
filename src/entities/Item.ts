import { rollItemEffects } from "@/config/itemRolls";
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
  type: "BOSS_DROP" | "MINI_BOSS_DROP" | "PHASE_MILESTONE" | "TRADE" | "FUSION" | "SEASON_PASS" | "STORE";
  /** BossDefinition.id, phase-milestone id, the completed TradeSession.id, or "fusion" for a successful Item Fusion result. */
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
  /** MARKETPLACE / LEILÃO spec section 17 — true while this exact copy is listed in an ACTIVE auction. Mirrors pendingTrade's guard exactly (blocks equip via entities/Tower.ts's canEquipItem and Item Fusion via engine/ItemFusion.ts's checkFusionEligibility) so a listed item is genuinely unusable elsewhere, never just visually greyed out. Cleared the moment the auction settles or is cancelled — see engine/AuctionManager.ts. */
  pendingAuction: boolean;
  history: ItemHistoryEntry[];
  /** This copy's own rolled value for each of its definition's effects (config/itemRolls.ts). Absent on copies made before rolls existed — they use the listed value. */
  rolls?: number[];
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
    pendingAuction: false,
    history: [{ timestamp: now, event: "ACQUIRED", fromOwner: null, toOwner: ownerId }],
    ...(def && def.effects.length > 0 ? { rolls: rollItemEffects(def) } : {}),
  };
}

/**
 * SEASON PASS items arrive account-bound: they can be equipped and fused,
 * but never sold on the Marketplace or traded. A successful Fusion with them
 * gives a normal item, free to sell and trade (GameEngine.attemptFusion).
 */
export function isPassItem(item: { source?: ItemAcquiredFrom }): boolean {
  return item.source?.type === "SEASON_PASS";
}
