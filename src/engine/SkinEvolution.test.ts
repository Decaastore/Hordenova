import { beforeEach, describe, expect, it } from "vitest";
import { buySkinEvolution, getStoreTowerSkins } from "./StoreService";
import { loadSave, updateSave } from "./SaveSystem";
import { SKIN_EVOLUTION_PRICE, TOWER_SKINS } from "@/config/towerSkins";
import { isSkinEvolved, setEvolvedSkins } from "@/rendering/skinEvolution";
import { TOWER_SPRITES } from "@/rendering/towerSpriteMeta";

describe("tower skin catalog", () => {
  it("every tower has 2 Entry, 2 Intermediate and 5 Premium skins, each with baked art", () => {
    for (const type of ["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"] as const) {
      const mine = TOWER_SKINS.filter((s) => s.towerType === type);
      expect(mine.filter((s) => s.tier === "ENTRY")).toHaveLength(2);
      expect(mine.filter((s) => s.tier === "INTERMEDIATE")).toHaveLength(2);
      expect(mine.filter((s) => s.tier === "PREMIUM")).toHaveLength(5);
      for (const s of mine) expect(Object.keys(TOWER_SPRITES[type]?.[s.id] ?? {})).toHaveLength(6);
    }
  });

  it("the store lists them by tower, cheapest first", () => {
    const list = getStoreTowerSkins();
    for (let i = 1; i < list.length; i++) if (list[i]!.towerType === list[i - 1]!.towerType) expect(list[i]!.gemCost).toBeGreaterThanOrEqual(list[i - 1]!.gemCost);
  });
});

describe("skin evolution", () => {
  beforeEach(() => window.localStorage.clear());

  it("only an owned Premium skin evolves, once, for Gems", () => {
    const premium = TOWER_SKINS.find((s) => s.tier === "PREMIUM")!;
    const entry = TOWER_SKINS.find((s) => s.tier === "ENTRY")!;
    updateSave({ purchasedGems: 1000, ownedTowerSkinIds: [entry.id] });
    expect(buySkinEvolution(premium.id, "PURCHASED")).toEqual({ ok: false, reason: "NOT_OWNED" });
    expect(buySkinEvolution(entry.id, "PURCHASED")).toEqual({ ok: false, reason: "UNKNOWN" });
    updateSave({ ownedTowerSkinIds: [entry.id, premium.id] });
    expect(buySkinEvolution(premium.id, "PURCHASED").ok).toBe(true);
    expect(loadSave().purchasedGems).toBe(1000 - SKIN_EVOLUTION_PRICE.purchased);
    expect(loadSave().evolvedSkinIds).toEqual([premium.id]);
    expect(buySkinEvolution(premium.id, "PURCHASED")).toEqual({ ok: false, reason: "OWNED" });
    setEvolvedSkins(loadSave().evolvedSkinIds);
    expect(isSkinEvolved(premium.id)).toBe(true);
    expect(isSkinEvolved(entry.id)).toBe(false);
  });
});
