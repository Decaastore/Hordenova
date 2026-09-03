import type { ItemCategory } from "@/config/itemDefinitions";
import { getItemDefinition } from "@/config/itemDefinitions";
import type { Rarity } from "@/config/rarity";
import type { ItemInstance } from "@/entities/Item";

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
