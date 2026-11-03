import type { SaveData } from "./SaveSystem";
import { appendLedgerEvent } from "./EconomyLedger";
import { addItemWithCapacity } from "./InventoryManager";
import { createItemInstance, type ItemInstance } from "@/entities/Item";
import { getItemDefinitionsByRarity } from "@/config/itemDefinitions";
import { getScaledEnemyStats } from "@/config/enemyStats";
import type { RewardPart } from "@/config/seasonPass";

/**
 * Turns reward parts (config/seasonPass.ts's RewardPart — used by the
 * Season Pass and the Store's bundles) into save changes, with a ledger
 * entry for each. Items are created account-bound (tradable: false).
 */

export function goldForKills(save: Pick<SaveData, "currentWave">, kills: number): number {
  return getScaledEnemyStats("CRAWLER", Math.max(1, save.currentWave)).goldReward * kills;
}

export function rewardItemDefinitionId(rarity: Parameters<typeof getItemDefinitionsByRarity>[0]): string | null {
  return getItemDefinitionsByRarity(rarity)[0]?.id ?? null;
}

export function applyRewardParts(save: SaveData, parts: readonly RewardPart[], source: { type: "SEASON_PASS" | "STORE"; refId: string }): Partial<SaveData> {
  let { gold, gemShards, freeGems, purchasedGems, inventoryCapacity } = save;
  let inventory: ItemInstance[] = [...save.inventory];
  let overflow: ItemInstance[] = [...save.overflowInventory];
  let ownedSkins = [...save.ownedTowerSkinIds];
  const ledgerSource = `${source.type.toLowerCase()}:${source.refId}`;

  for (const part of parts) {
    switch (part.kind) {
      case "SHARDS":
        gemShards += part.amount;
        appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: save.playerId, source: ledgerSource, amount: part.amount });
        break;
      case "GEMS":
        freeGems += part.amount;
        appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: save.playerId, source: ledgerSource, amount: part.amount, currency: "FREE" });
        break;
      case "PURCHASED_GEMS":
        purchasedGems += part.amount;
        appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: save.playerId, source: ledgerSource, amount: part.amount, currency: "PURCHASED" });
        break;
      case "GOLD":
        gold += goldForKills(save, part.kills);
        break;
      case "INVENTORY_SLOTS":
        inventoryCapacity += part.amount;
        break;
      case "SKIN":
        if (!ownedSkins.includes(part.skinId)) ownedSkins = [...ownedSkins, part.skinId];
        break;
      case "ITEM": {
        const defId = rewardItemDefinitionId(part.rarity);
        if (!defId) break;
        const item = createItemInstance(defId, save.playerId, source);
        item.tradable = false; // account-bound: never sold on the Marketplace
        const added = addItemWithCapacity(inventory, overflow, item, inventoryCapacity);
        inventory = added.inventory;
        overflow = added.overflow;
        for (const eventType of ["ITEM_CREATED", "ITEM_ACQUIRED"] as const) {
          appendLedgerEvent({ eventType, fromOwner: null, toOwner: save.playerId, source: ledgerSource, itemInstanceId: item.instanceId, itemDefinitionId: defId });
        }
        break;
      }
    }
  }
  return { gold, gemShards, freeGems, purchasedGems, inventoryCapacity, inventory, overflowInventory: overflow, ownedTowerSkinIds: ownedSkins };
}
