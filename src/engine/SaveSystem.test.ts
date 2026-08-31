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
    writeSave({ bestWave: 7, essence: 0, lastPlayedAt: 123 });
    expect(loadSave().bestWave).toBe(7);
  });

  it("recordRunResult only raises bestWave, never lowers it", () => {
    writeSave({ bestWave: 10, essence: 0, lastPlayedAt: null });

    recordRunResult(4);
    expect(loadSave().bestWave).toBe(10);

    recordRunResult(15);
    expect(loadSave().bestWave).toBe(15);
  });

  it("survives corrupted JSON in storage", () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, "{not json");
    expect(loadSave()).toEqual(DEFAULT_SAVE_DATA);
  });
});
