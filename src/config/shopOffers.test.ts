import { beforeEach, describe, expect, it } from "vitest";
import { activeMomentOffer, createMomentOfferState, dailyOffers, dailyShopFor, isVipActive, MOMENT_COOLDOWN_MS, shopDay, triggerMomentOffer, vipGiftAvailable } from "./shopOffers";
import { buyDailyOffer, claimVipGift, getDailyOffers, requestGemPackPurchase } from "@/engine/StoreService";
import { loadSave, updateSave } from "@/engine/SaveSystem";

const DAY = 86_400_000;

describe("daily shop", () => {
  beforeEach(() => window.localStorage.clear());

  it("is the same for everyone on a day and changes the next", () => {
    expect(dailyOffers(100)).toEqual(dailyOffers(100));
    expect(dailyOffers(100).map((o) => o.id)).not.toEqual(dailyOffers(101).map((o) => o.id));
    expect(dailyOffers(100)).toHaveLength(4);
  });

  it("never sells Legendary or Mythic essences", () => {
    for (let d = 0; d < 60; d++) for (const o of dailyOffers(d)) expect((o.essences?.LEGENDARY ?? 0) + (o.essences?.MYTHIC ?? 0)).toBe(0);
  });

  it("each offer is bought once a day, paid in Gems, and lands on the account", () => {
    const now = 200 * DAY + 1000;
    updateSave({ freeGems: 1000 });
    const rare = getDailyOffers(loadSave(), now).find((e) => e.offer.kind === "RARE_ESSENCE")!.offer;
    expect(buyDailyOffer(rare.id, "FREE", now).ok).toBe(true);
    expect(loadSave().expeditions.essences.RARE).toBe(10);
    expect(loadSave().freeGems).toBe(1000 - rare.price.free);
    expect(buyDailyOffer(rare.id, "FREE", now)).toEqual({ ok: false, reason: "BOUGHT" });
    // next day it's a new shop
    expect(dailyShopFor(loadSave().dailyShop, now + DAY).bought).toEqual([]);
    expect(shopDay(now + DAY)).toBe(201);
  });

  it("refuses without Gems", () => {
    const now = 300 * DAY;
    const skin = getDailyOffers(loadSave(), now).find((e) => e.offer.kind === "SKIN")!.offer;
    expect(buyDailyOffer(skin.id, "PURCHASED", now)).toEqual({ ok: false, reason: "INSUFFICIENT_GEMS" });
  });
});

describe("moment offers and VIP", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows an offer at the moment and not again within a day", () => {
    let s = triggerMomentOffer(createMomentOfferState(), "CASTLE_FELL", 1000);
    expect(activeMomentOffer(s, 1000)!.offer.id).toBe("MOMENT_REBUILD");
    expect(activeMomentOffer(s, 1000 + 7 * 3_600_000)).toBeNull();
    s = { ...s, active: null };
    expect(triggerMomentOffer(s, "CASTLE_FELL", 2000).active).toBeNull();
    expect(triggerMomentOffer(s, "CASTLE_FELL", 1000 + MOMENT_COOLDOWN_MS).active).not.toBeNull();
  });

  it("real-money offers never grant anything while payments are off", () => {
    updateSave({ purchasedGems: 0 });
    expect(requestGemPackPurchase("MOMENT_BOSS").ok).toBe(false);
    expect(requestGemPackPurchase("VIP").ok).toBe(false);
    expect(loadSave().purchasedGems).toBe(0);
  });

  it("only a paid VIP collects the daily VIP Gems, once a day", () => {
    const now = 50 * DAY;
    expect(claimVipGift(now)).toBeNull();
    updateSave({ vip: { until: now + 30 * DAY, lastGiftDay: -1 } });
    expect(isVipActive(loadSave().vip, now)).toBe(true);
    expect(claimVipGift(now)!.purchasedGems).toBe(20);
    expect(vipGiftAvailable(loadSave().vip, now)).toBe(false);
    expect(claimVipGift(now)).toBeNull();
  });
});
