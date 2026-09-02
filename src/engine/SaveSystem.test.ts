import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SAVE_DATA, loadSave, recordRunResult, writeSave } from "./SaveSystem";
import { SAVE_STORAGE_KEY } from "@/config/gameBalance";

describe("SaveSystem", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns default data when nothing was ever saved", () => {
    expect(loadSave()).toEqual(DEFAULT_SAVE_DATA);
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
    expect(loadSave()).toEqual(DEFAULT_SAVE_DATA);
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
});
