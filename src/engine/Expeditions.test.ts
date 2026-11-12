import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import {
  BASE_SCOUT_GROUPS,
  createExpeditionState,
  expeditionPrize,
  expeditionRegions,
  FORGE_RECIPES,
  rushPrice,
  sanitizeExpeditionState,
  unlockedRegions,
} from "@/config/expeditions";

describe("expeditions config", () => {
  it("opens a region once the record has passed it, deeper ones pay more", () => {
    expect(unlockedRegions(30)).toEqual([]);
    expect(unlockedRegions(31).map((r) => r.index)).toEqual([0]);
    const regions = expeditionRegions();
    expect(regions[regions.length - 1]!.tier).toBe(4);
    expect(expeditionPrize(4, 24).gold).toBeGreaterThan(expeditionPrize(1, 24).gold);
    expect(expeditionPrize(1, 24).gold).toBeGreaterThan(expeditionPrize(1, 8).gold);
  });

  it("keeps the top essences for the deepest, longest trips", () => {
    for (const h of [1, 4, 8] as const) for (const t of [1, 2, 3, 4]) expect(expeditionPrize(t, h).essences.LEGENDARY + expeditionPrize(t, h).essences.MYTHIC).toBe(0);
    expect(expeditionPrize(3, 24).essences.MYTHIC).toBe(0);
    expect(expeditionPrize(4, 24).essences.MYTHIC).toBe(1);
  });

  it("rush costs 5 to 60 Gems by time left", () => {
    expect(rushPrice(60_000).purchased).toBe(5);
    expect(rushPrice(24 * 3_600_000).purchased).toBe(60);
    expect(rushPrice(48 * 3_600_000).purchased).toBe(60);
  });

  it("every recipe is harder as rarity goes up", () => {
    for (let i = 1; i < FORGE_RECIPES.length; i++) {
      expect(FORGE_RECIPES[i]!.splinters).toBeGreaterThan(FORGE_RECIPES[i - 1]!.splinters);
      expect(FORGE_RECIPES[i]!.hours).toBeGreaterThan(FORGE_RECIPES[i - 1]!.hours);
    }
  });

  it("sanitizes broken saves", () => {
    expect(sanitizeExpeditionState(null)).toEqual(createExpeditionState());
    const s = sanitizeExpeditionState({ groups: 99, splinters: -4, active: [{ regionIndex: 0, hours: 3 }], forging: { itemId: "nope" } });
    expect(s.groups).toBe(4);
    expect(s.splinters).toBe(0);
    expect(s.active).toEqual([]);
    expect(s.forging).toBeNull();
  });
});

describe("expeditions in the engine", () => {
  beforeEach(() => window.localStorage.clear());

  it("sends, waits and pays exactly the prize shown", () => {
    updateSave({ bestWave: 60, seasonBestWave: 60, gold: 0 });
    const engine = new GameEngine();
    engine.startRun();
    const now = 1_000_000;
    expect(engine.startExpedition(5, 4, now)).toBe(false); // region not beaten
    expect(engine.startExpedition(0, 4, now)).toBe(true);
    expect(engine.startExpedition(1, 1, now)).toBe(true);
    expect(engine.startExpedition(0, 1, now)).toBe(false); // both groups away
    expect(engine.collectExpedition(0, now + 3_600_000)).toBeNull(); // 4h trip not back
    const prize = engine.collectExpedition(0, now + 4 * 3_600_000)!;
    expect(prize).toEqual(expeditionPrize(1, 4));
    const save = loadSave();
    expect(save.gold).toBe(prize.gold);
    expect(save.expeditions.splinters).toBe(prize.splinters);
    expect(save.expeditions.essences.RARE).toBe(1);
    expect(save.expeditions.active).toHaveLength(1);
  });

  it("rush and extra groups spend Gems, and fail without them", () => {
    updateSave({ bestWave: 60, purchasedGems: 400 });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.startExpedition(0, 24, 0)).toBe(true);
    expect(engine.rushExpedition(0, "PURCHASED", 0)).not.toBeNull();
    expect(loadSave().purchasedGems).toBe(340);
    expect(engine.buyScoutGroup("PURCHASED")).toBe(true);
    expect(loadSave().expeditions.groups).toBe(BASE_SCOUT_GROUPS + 1);
    expect(engine.buyScoutGroup("PURCHASED")).toBe(false); // 40 left
  });

  it("forges the chosen item from its materials", () => {
    updateSave({ expeditions: { ...createExpeditionState(), splinters: 45, essences: { RARE: 6, EPIC: 0, LEGENDARY: 0, MYTHIC: 0 } } });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.startForge("hollow_sigil", 0)).toBe(false);
    expect(engine.startForge("ancient_core", 0)).toBe(true);
    expect(engine.startForge("mosswood_charm", 0)).toBe(false); // one at a time
    expect(engine.collectForge(3_600_000)).toBeNull();
    const item = engine.collectForge(8 * 3_600_000)!;
    expect(item.itemDefinitionId).toBe("ancient_core");
    const save = loadSave();
    expect(save.inventory.some((i) => i.instanceId === item.instanceId)).toBe(true);
    expect(save.expeditions.splinters).toBe(5);
    expect(save.expeditions.essences.RARE).toBe(0);
    expect(save.expeditions.forging).toBeNull();
  });
});
