import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SAVE_DATA, loadSave, recordRunResult, writeSave } from "./SaveSystem";
import { SAVE_STORAGE_KEY } from "@/config/gameBalance";

describe("SaveSystem", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns default data when nothing was ever saved (plus a freshly generated playerId)", () => {
    const loaded = loadSave();
    expect(loaded).toEqual({ ...DEFAULT_SAVE_DATA, playerId: loaded.playerId });
    expect(loaded.playerId.length).toBeGreaterThan(0);
  });

  it("persists and reloads data", () => {
    writeSave({ ...DEFAULT_SAVE_DATA, bestWave: 7, lastPlayedAt: 123 });
    expect(loadSave().bestWave).toBe(7);
  });

  it("persists tower loadout and current wave", () => {
    writeSave({
      ...DEFAULT_SAVE_DATA,
      currentWave: 12,
      gold: 340,
      towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 3 }],
    });
    const loaded = loadSave();
    expect(loaded.currentWave).toBe(12);
    expect(loaded.gold).toBe(340);
    expect(loaded.towerLoadout).toEqual([{ slotId: "slot-1", type: "IRONWOOD", level: 3 }]);
  });

  it("recordRunResult only raises bestWave, never lowers it", () => {
    writeSave({ ...DEFAULT_SAVE_DATA, bestWave: 10, lastPlayedAt: null });

    recordRunResult(4);
    expect(loadSave().bestWave).toBe(10);

    recordRunResult(15);
    expect(loadSave().bestWave).toBe(15);
  });

  it("survives corrupted JSON in storage", () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, "{not json");
    const loaded = loadSave();
    expect(loaded).toEqual({ ...DEFAULT_SAVE_DATA, playerId: loaded.playerId });
    expect(loaded.playerId.length).toBeGreaterThan(0);
  });

  it("is backward compatible with an old 3-field save (pre-persistent-progression)", () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ bestWave: 9, essence: 0, lastPlayedAt: 1000 }));
    const loaded = loadSave();
    expect(loaded.bestWave).toBe(9);
    expect(loaded.currentWave).toBe(0);
    expect(loaded.towerLoadout).toEqual([]);
  });

  it("drops malformed towerLoadout entries instead of throwing", () => {
    window.localStorage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SAVE_DATA, towerLoadout: [{ slotId: "slot-1", type: "NOT_REAL", level: 1 }, "garbage"] }),
    );
    expect(loadSave().towerLoadout).toEqual([]);
  });

  it("self-heals a missing playerId on an old save (pre-Item System) without discarding the rest of it", () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ bestWave: 9, gold: 500, currentWave: 30 }));
    const loaded = loadSave();
    expect(loaded.playerId.length).toBeGreaterThan(0);
    expect(loaded.bestWave).toBe(9);
    expect(loaded.gold).toBe(500);
    // The generated id is stable across subsequent loads (persisted, not regenerated every call).
    expect(loadSave().playerId).toBe(loaded.playerId);
  });

  it("drops malformed inventory entries instead of throwing, and keeps well-formed ones", () => {
    const validItem = {
      instanceId: "item-1",
      itemDefinitionId: "warden_fragment",
      ownerId: "player-1",
      acquiredAt: 1000,
      source: { type: "BOSS_DROP", refId: "hollow-warden" },
      tradable: false,
      pendingTrade: false,
      history: [],
    };
    window.localStorage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SAVE_DATA, inventory: [validItem, "garbage", { instanceId: "missing-fields" }] }),
    );
    expect(loadSave().inventory).toEqual([validItem]);
  });
});
