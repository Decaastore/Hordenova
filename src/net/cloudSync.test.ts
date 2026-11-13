import { describe, expect, it } from "vitest";
import { compareProgress, decideSync, parseSyncRecord, progressOf, type CloudRow } from "./cloudSync";

const save = (bestWave: number, bosses = 0) => JSON.stringify({ bestWave, bossesDefeatedTotal: bosses });
const row = (bestWave: number, at: number): CloudRow => ({ save: save(bestWave), eternal: null, clientUpdatedAt: at });
const local = (bestWave: number) => ({ save: bestWave > 0 ? save(bestWave) : null, eternal: null });

describe("cloud sync decision", () => {
  it("uploads a fresh account's first save and does nothing when both sides are empty", () => {
    expect(decideSync("u", local(12), null, null)).toBe("UPLOAD");
    expect(decideSync("u", local(0), null, null)).toBe("NOTHING");
  });

  it("downloads onto an empty device", () => {
    expect(decideSync("u", local(0), row(40, 100), null)).toBe("DOWNLOAD");
  });

  it("first meeting of device and account keeps whichever went further", () => {
    expect(decideSync("u", local(50), row(40, 100), null)).toBe("UPLOAD");
    expect(decideSync("u", local(10), row(40, 100), null)).toBe("DOWNLOAD");
  });

  it("follows whichever side changed since the last sync", () => {
    const rec = { userId: "u", lastSyncedAt: 100, dirtyAt: 100 };
    expect(decideSync("u", local(30), row(25, 200), rec)).toBe("DOWNLOAD"); // played on another device
    expect(decideSync("u", local(30), row(25, 100), { ...rec, dirtyAt: 150 })).toBe("UPLOAD"); // played here offline
    expect(decideSync("u", local(30), row(30, 100), rec)).toBe("NOTHING");
  });

  it("when both changed, more progress wins", () => {
    const rec = { userId: "u", lastSyncedAt: 100, dirtyAt: 150 };
    expect(decideSync("u", local(60), row(55, 200), rec)).toBe("UPLOAD");
    expect(decideSync("u", local(50), row(55, 200), rec)).toBe("DOWNLOAD");
  });

  it("never pushes another account's progress into this account", () => {
    const other = { userId: "someone-else", lastSyncedAt: 100, dirtyAt: 150 };
    expect(decideSync("u", local(99), row(5, 50), other)).toBe("DOWNLOAD");
  });

  it("scores progress by best wave, then bosses, and survives bad JSON", () => {
    expect(compareProgress(progressOf(save(10, 9)), progressOf(save(11, 0)))).toBeLessThan(0);
    expect(compareProgress(progressOf(save(10, 3)), progressOf(save(10, 1)))).toBeGreaterThan(0);
    expect(progressOf("{not json").bestWave).toBe(0);
    expect(parseSyncRecord("nope")).toBeNull();
    expect(parseSyncRecord(JSON.stringify({ userId: "a", lastSyncedAt: 5 }))).toEqual({ userId: "a", lastSyncedAt: 5, dirtyAt: 0 });
  });
});
