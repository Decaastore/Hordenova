import { getItemDefinition, getItemDefinitionsByRarity } from "@/config/itemDefinitions";
import { FUSION_ITEM_COUNT, getFusionSuccessChance, getNextRarity } from "@/config/itemFusion";
import type { Rarity } from "@/config/rarity";
import type { ItemInstance } from "@/entities/Item";
import { findItem } from "./InventoryManager";

/**
 * SISTEMA DE FUSÃO DE ITENS — pure eligibility/roll functions, matching this
 * codebase's established mutable-state-plus-pure-function engine module
 * pattern (WaveManager/BossManager/CombatSystem/InventoryManager). GameEngine
 * owns the actual inventory array and calls into these; nothing here touches
 * SaveData directly.
 */
export type FusionBlockReason =
  | "WRONG_COUNT"
  | "DUPLICATE_SELECTION"
  | "ITEM_NOT_FOUND"
  | "NOT_OWNED"
  | "NOT_ELIGIBLE"
  | "MIXED_RARITY"
  | "MAX_RARITY";

export interface FusionEligibility {
  ok: boolean;
  reason?: FusionBlockReason;
  /** Present only when ok — the shared rarity of the 3 selected items. */
  rarity?: Rarity;
  /** Present only when ok — the rarity a success would create. */
  nextRarity?: Rarity;
}

/** GameEngine.attemptFusion's result. BLOCKED means steps 5-8 never ran — the inventory is completely untouched. SUCCESS/FAILURE both mean the 3 items were consumed (step 5) and the operation persisted (step 8); only SUCCESS also created 1 new item (step 7). */
export type FusionOutcome =
  | { status: "BLOCKED"; reason: FusionBlockReason }
  | { status: "SUCCESS"; rarity: Rarity; nextRarity: Rarity; resultItem: ItemInstance }
  | { status: "FAILURE"; rarity: Rarity; nextRarity: Rarity };

/**
 * Validates the 3-item selection: exact count, no duplicates, every id
 * actually resolves to an item this account owns, none mid-trade, all the
 * same rarity, and a higher rarity tier actually exists. This is the exact
 * "steps 1-4" of the required atomic 8-step fusion operation — reused
 * as-is by both the UI (to disable CONFIRMAR / explain why) and by
 * GameEngine.attemptFusion (which re-validates the same rules immediately
 * before consuming anything, never trusting an earlier UI read).
 */
export function checkFusionEligibility(
  inventory: readonly ItemInstance[],
  selectedInstanceIds: readonly string[],
  ownerId: string,
): FusionEligibility {
  if (selectedInstanceIds.length !== FUSION_ITEM_COUNT) return { ok: false, reason: "WRONG_COUNT" };
  if (new Set(selectedInstanceIds).size !== selectedInstanceIds.length) {
    return { ok: false, reason: "DUPLICATE_SELECTION" };
  }

  const items: ItemInstance[] = [];
  for (const instanceId of selectedInstanceIds) {
    const item = findItem(inventory, instanceId);
    if (!item) return { ok: false, reason: "ITEM_NOT_FOUND" };
    items.push(item);
  }

  if (items.some((item) => item.ownerId !== ownerId)) return { ok: false, reason: "NOT_OWNED" };
  // Mirrors canEquipItem's own pendingTrade guard — an item mid-trade must
  // never be consumed out from under that trade.
  if (items.some((item) => item.pendingTrade)) return { ok: false, reason: "NOT_ELIGIBLE" };

  const defs = items.map((item) => getItemDefinition(item.itemDefinitionId));
  if (defs.some((def) => !def)) return { ok: false, reason: "ITEM_NOT_FOUND" };

  const rarity = defs[0]!.rarity;
  if (defs.some((def) => def!.rarity !== rarity)) return { ok: false, reason: "MIXED_RARITY" };

  const nextRarity = getNextRarity(rarity);
  if (!nextRarity) return { ok: false, reason: "MAX_RARITY" };

  return { ok: true, rarity, nextRarity };
}

/**
 * The success roll — RNG-injectable, mirroring config/dropTables.ts's
 * rollDropTable convention. Reads ONLY config/itemFusion.ts's final chance
 * table: never boosted by Prestige, Mastery, Specialization, or Gems, and
 * carries no pity/guarantee state of any kind.
 */
export function rollFusion(rarity: Rarity, rng: () => number = Math.random): boolean {
  return rng() < getFusionSuccessChance(rarity);
}

/** Picks which real item definition id a successful fusion creates at `rarity`. Today always exactly 1 real candidate per rarity (see itemDefinitions.ts) — RNG-injectable so a future multi-item-per-rarity catalog doesn't need a new selection function. */
export function pickFusionResultDefinitionId(rarity: Rarity, rng: () => number = Math.random): string | null {
  const candidates = getItemDefinitionsByRarity(rarity);
  if (candidates.length === 0) return null;
  const index = Math.min(Math.floor(rng() * candidates.length), candidates.length - 1);
  return candidates[index]!.id;
}
