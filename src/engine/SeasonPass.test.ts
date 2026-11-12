import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import { claimAllFreePassLevels, claimFreePassLevel, getPassView } from "./SeasonPassService";
import { seasonClock } from "./SeasonClock";
import { freeRewardForLevel, PASS_LEVELS, PASS_XP, PASS_XP_PER_LEVEL, premiumRewardForLevel, premiumSkinsForSeason } from "@/config/seasonPass";
import { STARTER_PACK } from "@/config/store";
import { getItemDefinition } from "@/config/itemDefinitions";

const season = () => seasonClock.getCurrentSeasonWindow().seasonNumber;
const kinds = (parts: readonly { kind: string }[]) => parts.map((p) => p.kind).join("+");

describe("Season Pass", () => {
  beforeEach(() => window.localStorage.clear());

  it("playing earns pass XP: clearing waves counts and is saved with the run", () => {
    const entry = (slotId: string) => ({ slotId, type: "IRONWOOD" as const, level: 40, specializationId: null, specializationLevel: 0, equippedSkinId: null, masteryLevel: 0, equippedItemInstanceIds: [null, null, null] });
    updateSave({ currentWave: 2, gold: 0, towerLoadout: [entry("slot-1"), entry("slot-2")] as never, mapLayoutId: null });
    const engine = new GameEngine();
    engine.startRun();
    for (let i = 0; i < 6000 && (loadSave().seasonPass?.xp ?? 0) < 3; i++) engine.update(100);
    expect(loadSave().seasonPass!.xp).toBeGreaterThanOrEqual(3 * PASS_XP.WAVE_CLEARED);
    expect(loadSave().seasonPass!.seasonNumber).toBe(season());
  });

  it("the free track, the premium track and the starter pack each offer different things", () => {
    const free = new Set<string>();
    const premium = new Set<string>();
    for (let l = 1; l <= PASS_LEVELS; l++) {
      for (const p of freeRewardForLevel(l)) free.add(p.kind);
      for (const p of premiumRewardForLevel(l, season())) premium.add(p.kind);
      expect(kinds(premiumRewardForLevel(l, season()))).not.toBe(kinds(freeRewardForLevel(l)));
    }
    expect([...free].sort()).toEqual(["GEMS", "GOLD", "ITEM", "SHARDS"]);
    expect(premium.has("SKIN") && premium.has("INVENTORY_SLOTS")).toBe(true);
    expect(free.has("SKIN")).toBe(false);
    // the starter pack's skin isn't one of this season's pass skins, and it carries Purchased Gems the pass never gives
    const starterSkin = (STARTER_PACK.contents.find((p) => p.kind === "SKIN") as { skinId: string }).skinId;
    for (let n = 1; n <= 40; n++) expect(premiumSkinsForSeason(n)).not.toContain(starterSkin);
    expect(STARTER_PACK.contents.some((p) => p.kind === "PURCHASED_GEMS")).toBe(true);
    // premium skins change from one Season to the next
    expect(premiumSkinsForSeason(season())).not.toEqual(premiumSkinsForSeason(season() + 1));
  });

  it("claiming pays the level's real reward once: Shards, Gold, account-bound items, Gems", () => {
    updateSave({ seasonPass: { seasonNumber: season(), xp: PASS_XP_PER_LEVEL * 10 + 5, claimedFree: [] }, gemShards: 0, freeGems: 0, gold: 0, currentWave: 20, inventory: [] });
    const view = getPassView();
    expect(view.level).toBe(10);
    expect(view.xpIntoLevel).toBe(5);
    expect(view.claimable).toHaveLength(10);

    expect(claimFreePassLevel(11)).toBeNull(); // not reached
    expect(claimFreePassLevel(2)!.gold).toBeGreaterThan(0); // a Gold level
    const withItem = claimFreePassLevel(5)!; // an item level
    expect(withItem.inventory).toHaveLength(1);
    const item = withItem.inventory[0]!;
    expect(getItemDefinition(item.itemDefinitionId)!.rarity).toBe("UNCOMMON");
    expect(item.tradable).toBe(false); // can't be sold on the Marketplace
    expect(claimFreePassLevel(5)).toBeNull(); // only once

    const all = claimAllFreePassLevels();
    expect(all.freeGems).toBe(1); // level 10
    expect(all.gemShards).toBeGreaterThan(0);
    expect(getPassView().claimable).toHaveLength(0);
  });

  it("a new Season starts the pass over; the level is capped at the last tier", () => {
    updateSave({ seasonPass: { seasonNumber: season() - 1, xp: 999_999, claimedFree: [1, 2, 3] } });
    expect(getPassView().level).toBe(0);
    updateSave({ seasonPass: { seasonNumber: season(), xp: 999_999, claimedFree: [] } });
    expect(getPassView().level).toBe(PASS_LEVELS);
  });
});

describe("Season Pass items: equip and fuse, never sell or trade", () => {
  it("can be equipped, and fusing them gives a normal item that can be sold and traded", async () => {
    const { vi } = await import("vitest");
    const { createItemInstance } = await import("@/entities/Item");
    const { canEquipItem, createTowerInstance } = await import("@/entities/Tower");
    const { rewardItemDefinitionId } = await import("./RewardGrant");
    const defId = rewardItemDefinitionId("UNCOMMON")!;
    const owner = loadSave().playerId;
    const passItems = [0, 1, 2].map((i) => {
      const it = createItemInstance(defId, owner, { type: "SEASON_PASS", refId: `free:${5 + i * 10}` });
      it.tradable = false;
      return it;
    });
    const tower = createTowerInstance("t", "IRONWOOD", { x: 0, y: 0 }, 10);
    tower.unlockedItemSlots = [true, true, true];
    expect(canEquipItem(tower, 0, passItems[0]!, false)).toBe(true);
    expect(passItems[0]!.tradable).toBe(false);

    updateSave({ inventory: passItems, overflowInventory: [] });
    const engine = new GameEngine();
    engine.startRun();
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    const out = engine.attemptFusion(passItems.map((i) => i.instanceId));
    spy.mockRestore();
    expect(out.status).toBe("SUCCESS");
    const result = loadSave().inventory.find((i) => i.source.type === "FUSION")!;
    expect(result).toBeTruthy();
    expect(result.tradable).toBe(getItemDefinition(result.itemDefinitionId)!.tradable);
    expect(canEquipItem(tower, 0, result, false)).toBe(true);
  });
});

describe("Season Pass item rarities", () => {
  it("the regular pass (free and premium) only gives items below Rare; Rare and up come only from the Supreme pass", async () => {
    const { supremeRewardForLevel, supremeOnSale, SUPREME_SALE_DAYS } = await import("@/config/seasonPass");
    const low = new Set(["COMMON", "UNCOMMON"]);
    for (let level = 1; level <= PASS_LEVELS; level++) {
      for (const part of [...freeRewardForLevel(level), ...premiumRewardForLevel(level, 5)]) if (part.kind === "ITEM") expect(low.has(part.rarity)).toBe(true);
    }
    const supreme = Array.from({ length: PASS_LEVELS }, (_, i) => supremeRewardForLevel(i + 1)).flat().filter((p) => p.kind === "ITEM").map((p) => (p as { rarity: string }).rarity);
    expect(supreme).toContain("EPIC");
    expect(supreme).toContain("LEGENDARY");
    const DAY = 86_400_000;
    expect(supremeOnSale({ startAtMs: 0 }, 2 * DAY)).toBe((SUPREME_SALE_DAYS - 2) * DAY);
    expect(supremeOnSale({ startAtMs: 0 }, SUPREME_SALE_DAYS * DAY)).toBeNull();
  });
});
