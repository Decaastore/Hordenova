import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

describe("GameEngine — Rifts", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("an opened Rift takes the next regular wave, and clearing it pays shards and items", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    updateSave({
      currentWave: 11,
      gold: 0,
      rift: { charges: 1, armed: null, active: null },
      towerLoadout: TOWER_SLOTS.slice(0, 4).map((s, i) => ({ slotId: s.id, type: (["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"] as const)[i]!, level: 40 })),
    });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.openRift(["HASTE", "TOUGH"])).toBe(true);
    expect(engine.getHudSnapshot().rift.armed).toEqual(["HASTE", "TOUGH"]);
    const shardsBefore = engine.getHudSnapshot().gemShards;
    const itemsBefore = engine.getInventory().length;

    let sawActive = false;
    for (let i = 0; i < 6000; i++) {
      engine.update(100);
      const rift = engine.getHudSnapshot().rift;
      if (rift.active) sawActive = true;
      if (rift.lastResult) break;
    }
    const rift = engine.getHudSnapshot().rift;
    expect(sawActive).toBe(true);
    expect(rift.charges).toBe(0);
    expect(rift.lastResult?.won).toBe(true);
    expect(engine.getHudSnapshot().gemShards).toBeGreaterThan(shardsBefore);
    expect(engine.getInventory().length + engine.getOverflowInventory().length).toBeGreaterThan(itemsBefore);
    expect(engine.getRenderSnapshot().lootDrops.length).toBeGreaterThan(0);
  }, 30_000);

  it("can't open a Rift without a charge", () => {
    updateSave({ currentWave: 5, gold: 0, rift: { charges: 0, armed: null, active: null }, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.openRift(["HASTE"])).toBe(false);
  });
});
