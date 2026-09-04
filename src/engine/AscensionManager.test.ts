import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAscensionSave, getAscensionStatus, syncSeasonIfNeeded } from "./AscensionManager";
import { ASCENSION_STORAGE_KEY, loadSave, updateSave } from "./SaveSystem";
import { LocalSeasonClock, SEASON_DURATION_MS, SEASON_EPOCH_MS, seasonClock } from "./SeasonClock";
import { getSeasonRewardBundle } from "@/config/ascension";

describe("AscensionManager — season lifecycle (Master Implementation spec sections 6/9/22/23)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  function mockSeasonNumber(n: number) {
    const t = SEASON_EPOCH_MS + (n - 1) * SEASON_DURATION_MS + 1000;
    vi.spyOn(seasonClock, "getCurrentSeasonWindow").mockImplementation(() => new LocalSeasonClock(() => t).getCurrentSeasonWindow());
    vi.spyOn(seasonClock, "getTimeRemainingMs").mockImplementation(() => new LocalSeasonClock(() => t).getTimeRemainingMs());
    vi.spyOn(seasonClock, "now").mockReturnValue(t);
  }

  it("syncSeasonIfNeeded is a no-op when still in the last-synced season", () => {
    mockSeasonNumber(5);
    updateSave({ ascensionLastSyncedSeason: 5 });
    updateSave({ currentWave: 40, gold: 500 }, ASCENSION_STORAGE_KEY);

    syncSeasonIfNeeded();

    // Nothing reset — the Ascension namespace is untouched mid-season.
    expect(loadSave(ASCENSION_STORAGE_KEY).currentWave).toBe(40);
    expect(loadSave(ASCENSION_STORAGE_KEY).gold).toBe(500);
    expect(loadSave().ascensionHistory).toEqual([]);
  });

  it("a season that ended WITH participation gets finalized as rank 1, grants Gems + cosmetics, and the Ascension namespace resets to fresh", () => {
    mockSeasonNumber(2); // now in season 2 — season 1 has fully ended
    updateSave({ ascensionLastSyncedSeason: 1, gems: 10, ownedCosmetics: [] });
    updateSave({ currentWave: 55, gold: 9999, towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 5 }] }, ASCENSION_STORAGE_KEY);

    syncSeasonIfNeeded();

    const main = loadSave();
    expect(main.ascensionHistory).toHaveLength(1);
    expect(main.ascensionHistory[0]).toMatchObject({ seasonNumber: 1, bestWave: 55, rank: 1 });
    expect(main.ascensionSeasonsWon).toBe(1);
    expect(main.ascensionTop3).toBe(1);
    expect(main.ascensionTop5).toBe(1);

    const expectedBundle = getSeasonRewardBundle(1, 1);
    expect(main.gems).toBe(10 + expectedBundle.gems);
    for (const cosmetic of expectedBundle.cosmetics) expect(main.ownedCosmetics).toContain(cosmetic.id);

    expect(main.ascensionLastSyncedSeason).toBe(2);

    const ascension = loadSave(ASCENSION_STORAGE_KEY);
    expect(ascension.currentWave).toBe(1);
    expect(ascension.gold).toBe(0);
    expect(ascension.towerLoadout).toEqual([]);
  });

  it("a season that ended with NO participation (never left wave 1) is recorded but grants no reward — no free-riding an idle account", () => {
    mockSeasonNumber(2);
    updateSave({ ascensionLastSyncedSeason: 1, gems: 0 });
    updateSave({ currentWave: 1 }, ASCENSION_STORAGE_KEY); // never even cleared wave 1

    syncSeasonIfNeeded();

    const main = loadSave();
    expect(main.ascensionHistory).toHaveLength(1);
    expect(main.ascensionHistory[0]!.rank).toBeNull();
    expect(main.ascensionSeasonsWon).toBe(0);
    expect(main.gems).toBe(0);
    expect(main.ownedCosmetics).toEqual([]);
  });

  it("calling syncSeasonIfNeeded twice for the same boundary never double-grants (idempotent)", () => {
    mockSeasonNumber(2);
    updateSave({ ascensionLastSyncedSeason: 1, gems: 0 });
    updateSave({ currentWave: 30 }, ASCENSION_STORAGE_KEY);

    syncSeasonIfNeeded();
    const gemsAfterFirst = loadSave().gems;
    const historyAfterFirst = loadSave().ascensionHistory.length;

    syncSeasonIfNeeded(); // already caught up — must be a pure no-op
    expect(loadSave().gems).toBe(gemsAfterFirst);
    expect(loadSave().ascensionHistory).toHaveLength(historyAfterFirst);
  });

  it("multiple fully-skipped seasons (app closed for a month) each get their own history entry, only the last-played one uses real leftover progress", () => {
    mockSeasonNumber(5); // 4 seasons (1,2,3,4) have all fully ended
    updateSave({ ascensionLastSyncedSeason: 1, gems: 0 });
    updateSave({ currentWave: 20 }, ASCENSION_STORAGE_KEY); // real progress from season 1

    syncSeasonIfNeeded();

    const main = loadSave();
    expect(main.ascensionHistory).toHaveLength(4);
    const bySeasonNumber = new Map(main.ascensionHistory.map((h) => [h.seasonNumber, h]));
    expect(bySeasonNumber.get(1)!.bestWave).toBe(20);
    expect(bySeasonNumber.get(1)!.rank).toBe(1);
    // Seasons 2/3/4 were fully skipped — no real progress, no participation.
    expect(bySeasonNumber.get(2)!.rank).toBeNull();
    expect(bySeasonNumber.get(3)!.rank).toBeNull();
    expect(bySeasonNumber.get(4)!.rank).toBeNull();
    expect(main.ascensionLastSyncedSeason).toBe(5);
  });

  it("getAscensionStatus reports the current season's wave/theme/timer without mutating anything", () => {
    mockSeasonNumber(3);
    updateSave({ ascensionLastSyncedSeason: 3 });
    updateSave({ currentWave: 12 }, ASCENSION_STORAGE_KEY);

    const status = getAscensionStatus();
    expect(status.seasonNumber).toBe(3);
    expect(status.currentWave).toBe(12);
    expect(status.hasParticipated).toBe(true);
    expect(typeof status.timeRemainingMs).toBe("number");

    // Confirm it's read-only — a second call sees identical state.
    expect(getAscensionStatus()).toEqual(status);
  });

  it("getAscensionSave never conflates with the Infinite save", () => {
    updateSave({ gold: 777 }); // Infinite
    updateSave({ gold: 3 }, ASCENSION_STORAGE_KEY);
    expect(getAscensionSave().gold).toBe(3);
    expect(loadSave().gold).toBe(777);
  });
});
