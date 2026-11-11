import { beforeEach, describe, expect, it } from "vitest";
import { loadSave, updateSave } from "./SaveSystem";
import { buyTowerSkin, claimDailyGift, equipTowerSkin, getSkinStatus, isDailyGiftAvailable, requestGemPackPurchase } from "./StoreService";
import { DAILY_GIFT_FREE_GEMS, GEM_PACKS, gemPackTotal } from "@/config/store";
import { getTowerSkinDualPrice, TOWER_SKINS } from "@/config/towerSkins";
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
});
