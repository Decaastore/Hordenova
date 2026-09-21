import type { ItemCategory } from "@/config/itemDefinitions";
import { getItemDefinition } from "@/config/itemDefinitions";
import type { Rarity } from "@/config/rarity";
import type { ItemInstance } from "@/entities/Item";
import type { TowerLoadoutEntry } from "@/entities/Tower";

/**
 * Item System spec section 13 — pure functions over an ItemInstance[],
 * matching this codebase's established pattern of mutable-state-plus-pure-
 * function engine modules (WaveManager, BossManager, CombatSystem) rather
 * than a class. GameEngine owns the actual array (in SaveData.inventory);
 * everything here just reads or returns a new array, never touches
 * localStorage directly.
 */
export function addItem(inventory: readonly ItemInstance[], item: ItemInstance): ItemInstance[] {
  return [...inventory, item];
}

/**
 * Inventory Capacity + Overflow (Progression 2.0 spec section 36/39): the
 * default save has DEFAULT_INVENTORY_CAPACITY (20) usable inventory slots
 * — a real limit, in preparation for a future paid Gem expansion (spec
 * section 36's "+10 slots"). A drop that arrives at a full inventory is
 * NEVER silently deleted (spec: "não deletar itens silenciosamente") — it
 * goes into `overflow`, a waiting area with no cap of its own, until the
 * player frees a slot or buys more capacity.
 */
export const DEFAULT_INVENTORY_CAPACITY = 20;

export function addItemWithCapacity(
  inventory: readonly ItemInstance[],
  overflow: readonly ItemInstance[],
  item: ItemInstance,
  capacity: number,
): { inventory: ItemInstance[]; overflow: ItemInstance[] } {
  if (inventory.length < capacity) {
    return { inventory: [...inventory, item], overflow: [...overflow] };
  }
  return { inventory: [...inventory], overflow: [...overflow, item] };
}

/** Moves one item out of the overflow waiting area into the main inventory, if there's room. A no-op (same contents, new array references) if the inventory is still full or the item isn't in overflow. */
export function claimFromOverflow(
  inventory: readonly ItemInstance[],
  overflow: readonly ItemInstance[],
  instanceId: string,
  capacity: number,
): { inventory: ItemInstance[]; overflow: ItemInstance[] } {
  if (inventory.length >= capacity) return { inventory: [...inventory], overflow: [...overflow] };
  const item = overflow.find((i) => i.instanceId === instanceId);
  if (!item) return { inventory: [...inventory], overflow: [...overflow] };
  return { inventory: [...inventory, item], overflow: overflow.filter((i) => i.instanceId !== instanceId) };
}

export function removeItem(inventory: readonly ItemInstance[], instanceId: string): ItemInstance[] {
  return inventory.filter((item) => item.instanceId !== instanceId);
}

export function findItem(inventory: readonly ItemInstance[], instanceId: string): ItemInstance | null {
  return inventory.find((item) => item.instanceId === instanceId) ?? null;
}

export function getItemsByCategory(inventory: readonly ItemInstance[], category: ItemCategory): ItemInstance[] {
  return inventory.filter((item) => getItemDefinition(item.itemDefinitionId)?.category === category);
}

export function getItemsByRarity(inventory: readonly ItemInstance[], rarity: Rarity): ItemInstance[] {
  return inventory.filter((item) => getItemDefinition(item.itemDefinitionId)?.rarity === rarity);
}

export function countByDefinition(inventory: readonly ItemInstance[], itemDefinitionId: string): number {
  return inventory.filter((item) => item.itemDefinitionId === itemDefinitionId).length;
}

/**
 * PLAYER ECONOMY UNIFICATION spec section 12/14 — the ONE place that
 * answers "is this exact item currently equipped on any tower", shared by
 * both Marketplace listing eligibility (engine/AuctionManager.ts's
 * canListItemForAuction) and Trade offer eligibility (engine/TradeManager.ts's
 * canOfferItemInTrade), so the two systems can never drift into allowing a
 * currently-equipped item to be listed/traded out from under its own tower
 * — the exact "item listado e equipado ao mesmo tempo" race the spec calls
 * out. Previously nothing checked this at all (a real gap this closes).
 */
export function isItemEquippedAnywhere(towers: readonly TowerLoadoutEntry[], instanceId: string): boolean {
  return towers.some((tower) => tower.equippedItemInstanceIds?.includes(instanceId) ?? false);
}
