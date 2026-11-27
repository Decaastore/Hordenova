import { loadSave, updateSave, type SaveData } from "./SaveSystem";
import { appendLedgerEvent } from "./EconomyLedger";
import { creatorBonusGems, CREATOR_PURCHASE_BONUS_PCT, findCreator, SUPPORTER_LOOKS, type Creator } from "@/config/creators";
import { getShopItem } from "@/config/duel";

/**
 * PROGRAMA DE CRIADORES — the player's side (config/creators.ts has the rules).
 */

export type CreatorCodeResult = { ok: true; creator: Creator; save: SaveData } | { ok: false; reason: "INVALID" | "UNKNOWN" | "SAME" };

/** The creator this account supports right now, or null (a code that is no longer approved counts as none). */
export function currentCreator(save: SaveData = loadSave()): Creator | null {
  return findCreator(save.creatorCode);
}

/**
 * Sets the creator code. It must belong to an approved creator. The first
 * time any code is set, the Supporter looks are added to the Duel profile.
 */
export function applyCreatorCode(raw: string, nowMs: number = Date.now()): CreatorCodeResult {
  const save = loadSave();
  const creator = findCreator(raw);
  if (!raw.trim()) return { ok: false, reason: "INVALID" };
  if (!creator) return { ok: false, reason: /^[A-Za-z0-9_\s]{3,20}$/.test(raw.trim()) ? "UNKNOWN" : "INVALID" };
  if (save.creatorCode === creator.code.toUpperCase()) return { ok: false, reason: "SAME" };
  const owned = [...save.duel.owned];
  for (const id of SUPPORTER_LOOKS) if (getShopItem(id)?.cosmetic && !owned.includes(id)) owned.push(id);
  const next = updateSave({
    creatorCode: creator.code.toUpperCase(),
    creatorCodeSetAt: nowMs,
    duel: { ...save.duel, owned },
  });
  return { ok: true, creator, save: next };
}

/** Stops supporting a creator (the Supporter looks the player earned stay). */
export function clearCreatorCode(): SaveData {
  return updateSave({ creatorCode: null, creatorCodeSetAt: null });
}

/**
 * The creator's link: hordenova…/?criador=CODE. On a visit with that link,
 * an account that supports nobody yet starts supporting that creator; an
 * account that already chose one keeps it. The parameter is then removed
 * from the address bar. Returns the creator applied, if any.
 */
export function captureCreatorLink(loc: Pick<Location, "search" | "href"> = window.location, nowMs: number = Date.now()): Creator | null {
  let code: string | null = null;
  try {
    code = new URLSearchParams(loc.search).get("criador") ?? new URLSearchParams(loc.search).get("creator");
  } catch {
    return null;
  }
  if (!code) return null;
  try {
    const url = new URL(loc.href);
    url.searchParams.delete("criador");
    url.searchParams.delete("creator");
    window.history?.replaceState?.(null, "", url.pathname + url.search + url.hash);
  } catch {
    /* leave the address as it is */
  }
  if (loadSave().creatorCode) return null;
  const r = applyCreatorCode(code, nowMs);
  return r.ok ? r.creator : null;
}

/**
 * What a real-money checkout sends along (StoreService.requestGemPackPurchase,
 * the day payments open): the creator code, if any, and the player's extra
 * Purchased Gems for it. The payment provider's server confirms both.
 */
export function creatorCheckout(gems: number, save: SaveData = loadSave()): { creatorCode: string | null; bonusGems: number; bonusPct: number } {
  const creator = currentCreator(save);
  return creator ? { creatorCode: creator.code.toUpperCase(), bonusGems: creatorBonusGems(gems), bonusPct: CREATOR_PURCHASE_BONUS_PCT } : { creatorCode: null, bonusGems: 0, bonusPct: 0 };
}

/** Records a confirmed real-money purchase made with a creator code (a payout record; amount in BRL cents). */
export function recordCreatorSale(packId: string, priceBrl: number, save: SaveData = loadSave()): void {
  const creator = currentCreator(save);
  if (!creator) return;
  appendLedgerEvent({
    eventType: "CREATOR_SALE",
    fromOwner: save.playerId,
    toOwner: null,
    source: `creator:${creator.code.toUpperCase()}:${packId}`,
    amount: Math.round(priceBrl * 100),
  });
}
