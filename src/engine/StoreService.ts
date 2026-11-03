import { loadSave, updateSave, type SaveData } from "./SaveSystem";
import { appendLedgerEvent } from "./EconomyLedger";
import { getCurrentDayIndex } from "./DailyClock";
import { getTowerSkinDefinition, getTowerSkinDualPrice, TOWER_SKINS, type TowerSkinDefinition } from "@/config/towerSkins";
import { gemPriceForCurrency, type GemCurrency } from "@/config/gemsEconomy";
import { DAILY_GIFT_FREE_GEMS, GEM_PACKS, REAL_MONEY_PAYMENTS_ENABLED, STARTER_PACK } from "@/config/store";
import type { TowerType } from "@/config/towerStats";

/**
 * STORE — the Loja page's actions, read and written straight on the save
 * (loadSave/updateSave), exactly like MarketplaceService: the store is a
 * site page, so no GameEngine is running while it's open.
 *
 * Tower skins follow the same rules as buying one from the tower panel in
 * game (GameEngine.purchaseTowerSkin): the account needs a tower of that
 * type at the skin's unlock level, the price is the skin's dual Gem price,
 * and ownership is permanent.
 */

export type SkinStatus =
  | { kind: "OWNED"; equipped: boolean }
  | { kind: "LOCKED"; needLevel: number; haveLevel: number }
  | { kind: "AVAILABLE" };

/** Commercial tower skins in store order: by tower type, cheapest first. */
export function getStoreTowerSkins(): readonly TowerSkinDefinition[] {
  return TOWER_SKINS;
}

function highestLevelOfType(save: SaveData, type: TowerType): number {
  let best = 0;
  for (const entry of save.towerLoadout) if (entry.type === type) best = Math.max(best, entry.level);
  return best;
}

export function getSkinStatus(skinId: string, save: SaveData = loadSave()): SkinStatus | null {
  const def = getTowerSkinDefinition(skinId);
  if (!def) return null;
  if (save.ownedTowerSkinIds.includes(skinId)) return { kind: "OWNED", equipped: save.equippedTowerSkinByType[def.towerType] === skinId };
  const have = highestLevelOfType(save, def.towerType);
  if (have < def.unlockLevel) return { kind: "LOCKED", needLevel: def.unlockLevel, haveLevel: have };
  return { kind: "AVAILABLE" };
}

export type StoreResult = { ok: true; save: SaveData } | { ok: false; reason: "UNKNOWN" | "OWNED" | "LOCKED" | "INSUFFICIENT_GEMS" | "NOT_OWNED" };

export function buyTowerSkin(skinId: string, currency: GemCurrency): StoreResult {
  const save = loadSave();
  const def = getTowerSkinDefinition(skinId);
  const status = getSkinStatus(skinId, save);
  if (!def || !status) return { ok: false, reason: "UNKNOWN" };
  if (status.kind === "OWNED") return { ok: false, reason: "OWNED" };
  if (status.kind === "LOCKED") return { ok: false, reason: "LOCKED" };
  const cost = gemPriceForCurrency(getTowerSkinDualPrice(def), currency);
  const balance = currency === "FREE" ? save.freeGems : save.purchasedGems;
  if (balance < cost) return { ok: false, reason: "INSUFFICIENT_GEMS" };
  appendLedgerEvent({ eventType: "GEMS_SPENT", fromOwner: save.playerId, toOwner: null, source: `tower_skin:${skinId}`, amount: cost, currency });
  const next = updateSave({
    ...(currency === "FREE" ? { freeGems: save.freeGems - cost } : { purchasedGems: save.purchasedGems - cost }),
    ownedTowerSkinIds: [...save.ownedTowerSkinIds, skinId],
  });
  return { ok: true, save: next };
}

/** Equips an owned skin on every tower of its type (or `null` back to the default look). */
export function equipTowerSkin(type: TowerType, skinId: string | null): StoreResult {
  const save = loadSave();
  if (skinId !== null) {
    const def = getTowerSkinDefinition(skinId);
    if (!def || def.towerType !== type) return { ok: false, reason: "UNKNOWN" };
    if (!save.ownedTowerSkinIds.includes(skinId)) return { ok: false, reason: "NOT_OWNED" };
  }
  const equipped = { ...save.equippedTowerSkinByType };
  if (skinId === null) delete equipped[type];
  else equipped[type] = skinId;
  return { ok: true, save: updateSave({ equippedTowerSkinByType: equipped }) };
}

export function isDailyGiftAvailable(save: SaveData = loadSave(), nowMs: number = Date.now()): boolean {
  return save.lastStoreGiftDayIndex !== getCurrentDayIndex(nowMs);
}

/** Claims today's Free Gems gift. Returns the new save, or null if it was already claimed today. */
export function claimDailyGift(nowMs: number = Date.now()): SaveData | null {
  const save = loadSave();
  if (!isDailyGiftAvailable(save, nowMs)) return null;
  appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: save.playerId, source: "store_daily_gift", amount: DAILY_GIFT_FREE_GEMS, currency: "FREE" });
  return updateSave({ freeGems: save.freeGems + DAILY_GIFT_FREE_GEMS, lastStoreGiftDayIndex: getCurrentDayIndex(nowMs) });
}

/**
 * Where a real-money checkout will start once a payment provider is
 * connected. Until then it refuses — it never grants Gems on its own.
 */
export function requestGemPackPurchase(packId: string): { ok: false; reason: "PAYMENTS_NOT_ENABLED" | "UNKNOWN_PACK" } {
  if (packId !== STARTER_PACK.id && !GEM_PACKS.some((p) => p.id === packId)) return { ok: false, reason: "UNKNOWN_PACK" };
  if (!REAL_MONEY_PAYMENTS_ENABLED) return { ok: false, reason: "PAYMENTS_NOT_ENABLED" };
  // The checkout integration goes here (see config/store.ts's header).
  return { ok: false, reason: "PAYMENTS_NOT_ENABLED" };
}
