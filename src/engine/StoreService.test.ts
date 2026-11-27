import { beforeEach, describe, expect, it } from "vitest";
import { loadSave, updateSave } from "./SaveSystem";
import { buyTowerSkin, buyVipWithGems, claimVipGift, claimDailyGift, equipTowerSkin, getSkinStatus, isDailyGiftAvailable, requestGemPackPurchase } from "./StoreService";
import { bundleForSkin, bundleSkinIds, DAILY_GIFT_FREE_GEMS, GEM_PACKS, gemPackTotal, SKIN_BUNDLES } from "@/config/store";
import { DUEL_TOWER_SKINS, getTowerSkinDefinition, getTowerSkinDualPrice, PACK_TOWER_SKINS, PRESTIGE_TOWER_SKINS, TOWER_SKINS } from "@/config/towerSkins";
import { DAY_DURATION_MS } from "./DailyClock";

const skin = TOWER_SKINS.find((s) => s.towerType === "IRONWOOD")!;
const entry = (level: number) => ({ slotId: "s1", type: "IRONWOOD" as const, level, specializationId: null, specializationLevel: 0, equippedSkinId: null, masteryLevel: 0, equippedItemInstanceIds: [null, null, null] });

describe("Store", () => {
  beforeEach(() => window.localStorage.clear());

  it("gem packs can't be bought until real payments exist — and nothing ever grants Gems for free", () => {
    const before = loadSave().purchasedGems;
    for (const pack of GEM_PACKS) expect(requestGemPackPurchase(pack.id)).toEqual({ ok: false, reason: "PAYMENTS_NOT_ENABLED" });
    expect(loadSave().purchasedGems).toBe(before);
    // bigger packs are always a better deal per real
    for (let i = 1; i < GEM_PACKS.length; i++) {
      expect(gemPackTotal(GEM_PACKS[i]!) / GEM_PACKS[i]!.priceBrl).toBeGreaterThan(gemPackTotal(GEM_PACKS[i - 1]!) / GEM_PACKS[i - 1]!.priceBrl);
    }
  });

  it("a paid skin is buyable from the start, even before that tower is built, with either currency", () => {
    updateSave({ towerLoadout: [] as never, freeGems: 10_000, purchasedGems: 0 });
    expect(getSkinStatus(skin.id)!.kind).toBe("AVAILABLE");

    updateSave({ towerLoadout: [entry(1)] as never });
    expect(getSkinStatus(skin.id)!.kind).toBe("AVAILABLE");
    expect(buyTowerSkin(skin.id, "PURCHASED")).toEqual({ ok: false, reason: "INSUFFICIENT_GEMS" });
    const result = buyTowerSkin(skin.id, "FREE");
    expect(result.ok).toBe(true);
    const save = loadSave();
    expect(save.freeGems).toBe(10_000 - getTowerSkinDualPrice(skin).free);
    expect(save.ownedTowerSkinIds).toContain(skin.id);
    expect(buyTowerSkin(skin.id, "FREE")).toEqual({ ok: false, reason: "OWNED" });
  });

  it("equipping applies to the tower type the game reads, and only owned skins can be equipped", () => {
    expect(equipTowerSkin("IRONWOOD", skin.id)).toEqual({ ok: false, reason: "NOT_OWNED" });
    updateSave({ ownedTowerSkinIds: [skin.id] });
    expect(equipTowerSkin("INFERNO", skin.id)).toEqual({ ok: false, reason: "UNKNOWN" });
    expect(equipTowerSkin("IRONWOOD", skin.id).ok).toBe(true);
    expect(loadSave().equippedTowerSkinByType.IRONWOOD).toBe(skin.id);
    expect(getSkinStatus(skin.id)).toEqual({ kind: "OWNED", equipped: true });
    expect(equipTowerSkin("IRONWOOD", null).ok).toBe(true);
    expect(loadSave().equippedTowerSkinByType.IRONWOOD).toBeUndefined();
  });

  it("the daily gift gives Free Gems once per day and survives a reload", () => {
    const now = Date.UTC(2026, 10, 2, 15);
    expect(isDailyGiftAvailable(loadSave(), now)).toBe(true);
    const after = claimDailyGift(now)!;
    expect(after.freeGems).toBe(DAILY_GIFT_FREE_GEMS);
    expect(after.purchasedGems).toBe(0);
    expect(claimDailyGift(now + 1000)).toBeNull();
    expect(isDailyGiftAvailable(loadSave(), now + 1000)).toBe(false);
    expect(claimDailyGift(now + DAY_DURATION_MS)!.freeGems).toBe(DAILY_GIFT_FREE_GEMS * 2);
  });

  it("Prestige, Duel and bundle-exclusive skins can never be bought with Gems (they cost 0 in the skin table)", () => {
    updateSave({ freeGems: 99_999, purchasedGems: 99_999 });
    for (const skin of [...PRESTIGE_TOWER_SKINS, ...DUEL_TOWER_SKINS, ...PACK_TOWER_SKINS]) {
      expect(buyTowerSkin(skin.id, "PURCHASED").ok).toBe(false);
      expect(buyTowerSkin(skin.id, "FREE").ok).toBe(false);
    }
    expect(loadSave().ownedTowerSkinIds).toEqual([]);
    expect(loadSave().purchasedGems).toBe(99_999);
  });

  it("skin bundles: every bundle-exclusive skin is in exactly one bundle, prices go up to R$ 300, and payments stay closed", () => {
    for (const skin of PACK_TOWER_SKINS) expect(bundleForSkin(skin.id)).not.toBeNull();
    const all = SKIN_BUNDLES.flatMap(bundleSkinIds);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(getTowerSkinDefinition(id)?.tier).toBe("PACK");
    for (const b of SKIN_BUNDLES) {
      expect(b.priceBrl).toBeGreaterThan(0);
      expect(b.priceBrl).toBeLessThanOrEqual(300);
      // Normal (Uncommon) and Rare items to forge, plus one Epic in the biggest bundle (owner's call); never Legendary or Mythic
      expect(b.contents.every((p) => p.kind !== "ITEM" || p.rarity === "UNCOMMON" || p.rarity === "RARE" || (p.rarity === "EPIC" && b.id === "BUNDLE_SOVEREIGN"))).toBe(true);
      expect(b.contents.filter((p) => p.kind === "CASTLE_SKIN")).toHaveLength(1);
      expect(requestGemPackPurchase(b.id)).toEqual({ ok: false, reason: "PAYMENTS_NOT_ENABLED" });
    }
  });

  it("VIP with Purchased Gems: 400 Gems buy 30 days; its daily gift pays FREE Gems, so it can never pay itself back in Purchased Gems", () => {
    const now = Date.UTC(2026, 10, 22, 12);
    updateSave({ purchasedGems: 399, freeGems: 0 });
    expect(buyVipWithGems(now)).toEqual({ ok: false, reason: "INSUFFICIENT_GEMS" });
    updateSave({ purchasedGems: 400 });
    expect(buyVipWithGems(now).ok).toBe(true);
    expect(loadSave().purchasedGems).toBe(0);
    expect(loadSave().vip.until).toBe(now + 30 * 86_400_000);
    expect(claimVipGift(now)).not.toBeNull();
    expect(loadSave().purchasedGems).toBe(0);
    expect(loadSave().freeGems).toBe(20);
  });

  it("days paid with real money pay the VIP gift in Purchased Gems", () => {
    const now = Date.UTC(2026, 10, 22, 12);
    updateSave({ purchasedGems: 0, vip: { until: now + 86_400_000, lastGiftDay: -1, paidGifts: 1 } });
    claimVipGift(now);
    expect(loadSave().purchasedGems).toBe(20);
    expect(loadSave().vip.paidGifts).toBe(0);
  });
});
