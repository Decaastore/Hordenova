import { lastPrizePlace, rankedPrizeParts, rankedPrizeTier, type RankedBoard } from "@/config/rankedRewards";
import { getShopItem } from "@/config/duel";
import { createItemInstance } from "@/entities/Item";
import { applyRewardParts } from "./RewardGrant";
import { addItemWithCapacity } from "./InventoryManager";
import { appendLedgerEvent } from "./EconomyLedger";
import { loadSave, updateSave, type SaveData } from "./SaveSystem";

/**
 * Grants a ranking prize (config/rankedRewards.ts) for a FINAL placement on
 * the online ranking — the only source of a real placement. Each
 * board+period pays once (SaveData.rankedPrizesGranted), so a repeated call
 * (reconnect, refresh) never pays twice. A place outside the prizes records
 * the period as settled and grants nothing.
 *
 * On top of the Free Gems and skins (reward parts) a place can carry a
 * one-of-a-kind relic (account-bound item), Duel looks and Duel Coins.
 */
export function grantRankedPlacement(board: RankedBoard, periodKey: string, place: number): { granted: boolean; save: SaveData } {
  const save = loadSave();
  const key = `${board}:${periodKey}`;
  if (save.rankedPrizesGranted.includes(key)) return { granted: false, save };
  const parts = place >= 1 && place <= lastPrizePlace(board) ? rankedPrizeParts(board, place) : null;
  const tier = parts ? rankedPrizeTier(board, place) : null;
  const refId = `${key}:#${place}`;
  const patch: Partial<SaveData> = parts ? applyRewardParts(save, parts, { type: "RANKED", refId }) : {};

  if (tier?.relic) {
    const item = createItemInstance(tier.relic, save.playerId, { type: "RANKED", refId });
    item.tradable = false; // account-bound: never sold or traded
    const added = addItemWithCapacity(patch.inventory ?? save.inventory, patch.overflowInventory ?? save.overflowInventory, item, patch.inventoryCapacity ?? save.inventoryCapacity);
    patch.inventory = added.inventory;
    patch.overflowInventory = added.overflow;
    for (const eventType of ["ITEM_CREATED", "ITEM_ACQUIRED"] as const) {
      appendLedgerEvent({ eventType, fromOwner: null, toOwner: save.playerId, source: `ranked:${refId}`, itemInstanceId: item.instanceId, itemDefinitionId: tier.relic });
    }
  }
  if (tier && (tier.looks?.length || tier.duelCoins)) {
    const owned = [...save.duel.owned];
    for (const id of tier.looks ?? []) if (getShopItem(id)?.cosmetic && !owned.includes(id)) owned.push(id);
    patch.duel = { ...save.duel, owned, coins: save.duel.coins + (tier.duelCoins ?? 0) };
  }

  const trophies = parts ? [...save.rankedTrophies, { board, period: periodKey, place, atMs: Date.now() }].slice(-200) : save.rankedTrophies;
  return { granted: !!parts, save: updateSave({ ...patch, rankedPrizesGranted: [...save.rankedPrizesGranted, key].slice(-200), rankedTrophies: trophies }) };
}
