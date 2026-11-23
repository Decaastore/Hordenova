import { beforeEach, describe, expect, it } from "vitest";
import { grantRankedPlacement } from "./RankedRewardsService";
import { loadSave, updateSave } from "./SaveSystem";
import { lastPrizePlace, RANKED_PRIZES, RANKED_SETS, rankedPeriod, rankedPrizeParts, type RankedBoard } from "@/config/rankedRewards";
import { getTowerSkinDefinition, isGemPurchasableSkin } from "@/config/towerSkins";
import { getCastleSkinDefinition } from "@/config/castleSkins";
import { SKIN_BUNDLES } from "@/config/store";

const BOARDS: RankedBoard[] = ["SEASON", "DUEL", "ETERNAL"];

describe("ranking prizes", () => {
  beforeEach(() => window.localStorage.clear());

  it("Season pays places 1-20 (full set to the top 5, castle to 6-10); Duel and Eternal pay the top 10 with the full set", () => {
    expect(lastPrizePlace("SEASON")).toBe(20);
    expect(lastPrizePlace("DUEL")).toBe(10);
    expect(lastPrizePlace("ETERNAL")).toBe(10);
    expect(rankedPrizeParts("SEASON", 5)!.filter((p) => p.kind === "SKIN")).toHaveLength(4);
    expect(rankedPrizeParts("SEASON", 6)!.filter((p) => p.kind === "SKIN")).toHaveLength(0);
    expect(rankedPrizeParts("SEASON", 6)!.some((p) => p.kind === "CASTLE_SKIN")).toBe(true);
    expect(rankedPrizeParts("SEASON", 20)!.some((p) => p.kind === "CASTLE_SKIN")).toBe(false);
    expect(rankedPrizeParts("SEASON", 21)).toBeNull();
    expect(rankedPrizeParts("ETERNAL", 10)!.filter((p) => p.kind === "SKIN")).toHaveLength(4);
    expect(rankedPrizeParts("DUEL", 11)).toBeNull();
  });

  it("prizes only ever pay FREE Gems, and better places never pay less", () => {
    for (const b of BOARDS) {
      for (let place = 1; place <= lastPrizePlace(b); place++) {
        const parts = rankedPrizeParts(b, place)!;
        expect(parts.some((p) => p.kind === "PURCHASED_GEMS")).toBe(false);
      }
      const gems = RANKED_PRIZES[b].map((t) => t.freeGems);
      expect([...gems].sort((x, y) => y - x)).toEqual(gems);
    }
    expect(RANKED_PRIZES.ETERNAL[0]!.freeGems).toBeGreaterThan(RANKED_PRIZES.DUEL[0]!.freeGems);
  });

  it("ranking skins exist, are never sold for Gems and never sit in a bundle", () => {
    const bundled = new Set(SKIN_BUNDLES.flatMap((b) => b.contents.flatMap((p) => (p.kind === "SKIN" || p.kind === "CASTLE_SKIN" ? [p.skinId] : []))));
    for (const b of BOARDS) {
      const set = RANKED_SETS[b];
      expect(getCastleSkinDefinition(set.castle)?.source).toBe("RANKED");
      expect(bundled.has(set.castle)).toBe(false);
      for (const [type, id] of Object.entries(set.towers)) {
        const def = getTowerSkinDefinition(id)!;
        expect(def.tier).toBe("RANKED");
        expect(def.towerType).toBe(type);
        expect(isGemPurchasableSkin(def)).toBe(false);
        expect(bundled.has(id)).toBe(false);
      }
    }
  });

  it("a placement is granted once per period: skins and Free Gems land, Purchased Gems untouched, a repeat pays nothing", () => {
    updateSave({ freeGems: 0, purchasedGems: 7, ownedTowerSkinIds: [], unlockedCastleSkinIds: [] });
    expect(grantRankedPlacement("ETERNAL", "2026", 1).granted).toBe(true);
    const s = loadSave();
    expect(s.freeGems).toBe(RANKED_PRIZES.ETERNAL[0]!.freeGems);
    expect(s.purchasedGems).toBe(7);
    expect(s.ownedTowerSkinIds).toEqual(expect.arrayContaining(Object.values(RANKED_SETS.ETERNAL.towers)));
    expect(s.unlockedCastleSkinIds).toContain(RANKED_SETS.ETERNAL.castle);
    expect(grantRankedPlacement("ETERNAL", "2026", 1).granted).toBe(false);
    expect(loadSave().freeGems).toBe(RANKED_PRIZES.ETERNAL[0]!.freeGems);
    expect(grantRankedPlacement("DUEL", "2026-11", 42).granted).toBe(false);
    // the profile keeps one trophy per placement won — none for a place outside the prizes
    expect(loadSave().rankedTrophies).toEqual([expect.objectContaining({ board: "ETERNAL", period: "2026", place: 1 })]);
    // the Eternal #1 also gets its one-of-a-kind relic, account-bound, and the Eternal Duel looks
    const relic = [...loadSave().inventory, ...loadSave().overflowInventory].find((i) => i.itemDefinitionId === "immortal_hourglass");
    expect(relic?.tradable).toBe(false);
    expect(loadSave().duel.owned).toEqual(expect.arrayContaining(["BANNER_ETERNITY", "KILL_STARDUST"]));
  });

  it("a Duel placement pays its Duel Coins and Duel looks", () => {
    const coins = loadSave().duel.coins;
    grantRankedPlacement("DUEL", "2026-10", 1);
    expect(loadSave().duel.coins).toBe(coins + RANKED_PRIZES.DUEL[0]!.duelCoins!);
    expect(loadSave().duel.owned).toEqual(expect.arrayContaining(["BANNER_ARENA_KING", "FRAME_ARENA_CROWN", "KILL_LAUREL"]));
  });

  it("periods: Eternal by calendar year, Duel by calendar month (Brasília time), Season by the Season clock", () => {
    const t = Date.UTC(2026, 10, 23, 15);
    expect(rankedPeriod("ETERNAL", t).key).toBe("2026");
    expect(rankedPeriod("ETERNAL", t).endsAtMs).toBe(Date.UTC(2027, 0, 1, 3));
    expect(rankedPeriod("DUEL", t).key).toBe("2026-11");
    expect(rankedPeriod("DUEL", t).endsAtMs).toBe(Date.UTC(2026, 11, 1, 3));
    expect(rankedPeriod("SEASON", t).endsAtMs).toBeGreaterThan(t);
  });
});
