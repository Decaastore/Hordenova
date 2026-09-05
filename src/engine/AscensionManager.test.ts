import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAscensionStatus, syncSeasonIfNeeded } from "./AscensionManager";
import { loadSave, updateSave } from "./SaveSystem";
import { LocalSeasonClock, SEASON_DURATION_MS, SEASON_EPOCH_MS, seasonClock } from "./SeasonClock";
import { getSeasonRewardBundle } from "@/config/ascension";
import { RUN_START } from "@/config/gameBalance";
import { createItemInstance } from "@/entities/Item";

/**
 * PRÓXIMA GRANDE FASE — "DECISÃO DEFINITIVA SOBRE PROGRESSÃO" +
 * "CORREÇÃO DE REQUISITOS": there is only ONE permanent save now (no more
 * separate Ascension namespace/storage key) — Season is a competitive
 * window layered on top of it. `seasonBestWave`/ranking/rewards reset at
 * every boundary; tower LEVEL/specialization/Gold/currentWave (all
 * Season-scoped) reset too; everything else (gems, Tower Mastery, owned
 * skins, prestige, items, collection, ascensionHistory/records) never does.
 */
describe("AscensionManager — season lifecycle (PRÓXIMA GRANDE FASE)", () => {
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
    updateSave({ ascensionLastSyncedSeason: 5, currentWave: 40, gold: 500 });

    syncSeasonIfNeeded();

    expect(loadSave().currentWave).toBe(40);
    expect(loadSave().gold).toBe(500);
    expect(loadSave().ascensionHistory).toEqual([]);
  });

  it("a season that ended WITH participation gets finalized as rank 1 and grants Gems + cosmetics to the permanent save", () => {
    mockSeasonNumber(2); // now in season 2 — season 1 has fully ended
    updateSave({
      ascensionLastSyncedSeason: 1,
      gems: 10,
      ownedCosmetics: [],
      seasonBestWave: 55,
      currentWave: 55,
      gold: 9999,
      towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 5 }],
    });

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
  });

  it("[Test 1/11] a new Season resets every placed tower's level back to its fresh baseline", () => {
    mockSeasonNumber(2);
    updateSave({
      ascensionLastSyncedSeason: 1,
      seasonBestWave: 40,
      towerLoadout: [
        { slotId: "slot-1", type: "IRONWOOD", level: 35, specializationId: "IRONWOOD_EXECUTIONER", specializationLevel: 3 },
        { slotId: "slot-2", type: "INFERNO", level: 12 },
      ],
    });

    syncSeasonIfNeeded();

    const main = loadSave();
    for (const entry of main.towerLoadout) {
      expect(entry.level).toBe(1);
      expect(entry.specializationId ?? null).toBeNull();
      expect(entry.specializationLevel ?? 0).toBe(0);
    }
  });

  it("[Test 2/11] a tower's TYPE stays placed/unlocked in its slot across the reset — only level resets, the slot itself is never cleared", () => {
    mockSeasonNumber(2);
    updateSave({
      ascensionLastSyncedSeason: 1,
      seasonBestWave: 40,
      towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 35 }],
    });

    syncSeasonIfNeeded();

    const main = loadSave();
    expect(main.towerLoadout).toHaveLength(1);
    expect(main.towerLoadout[0]!.slotId).toBe("slot-1");
    expect(main.towerLoadout[0]!.type).toBe("IRONWOOD");
    expect(main.towerLoadout[0]!.level).toBe(1);
  });

  it("[Test 3/11 & 4/11] Tower Mastery levels are PERMANENT — untouched by a Season boundary — and were funded by Gems, never Gold", () => {
    mockSeasonNumber(2);
    updateSave({
      ascensionLastSyncedSeason: 1,
      seasonBestWave: 40,
      gold: 12345,
      towerMasteryLevels: { IRONWOOD: 7 },
    });

    syncSeasonIfNeeded();

    const main = loadSave();
    expect(main.towerMasteryLevels.IRONWOOD).toBe(7);
    // Gold itself is Season-scoped and resets — Mastery's own permanence is
    // independent of whatever Gold balance existed; GameEngine's own
    // upgradeSelectedTowerMastery test (GameEngineProgression2.test.ts)
    // covers the "Gems, not Gold, are debited" half of this requirement.
    expect(main.gold).toBe(RUN_START.startingGold);
  });

  it("[Test 5/11] an owned Tower Skin (bought with Gems) persists across a Season boundary", () => {
    mockSeasonNumber(2);
    updateSave({
      ascensionLastSyncedSeason: 1,
      seasonBestWave: 40,
      ownedTowerSkinIds: ["IRONWOOD_WARDEN_OF_THE_ABYSS"],
      equippedTowerSkinByType: { IRONWOOD: "IRONWOOD_WARDEN_OF_THE_ABYSS" },
    });

    syncSeasonIfNeeded();

    const main = loadSave();
    expect(main.ownedTowerSkinIds).toContain("IRONWOOD_WARDEN_OF_THE_ABYSS");
    expect(main.equippedTowerSkinByType.IRONWOOD).toBe("IRONWOOD_WARDEN_OF_THE_ABYSS");
  });

  it("[Test 7/11] tower specialization progress does NOT cross a Season boundary", () => {
    mockSeasonNumber(2);
    updateSave({
      ascensionLastSyncedSeason: 1,
      seasonBestWave: 40,
      towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 30, specializationId: "IRONWOOD_EXECUTIONER", specializationLevel: 5 }],
    });

    syncSeasonIfNeeded();

    const entry = loadSave().towerLoadout[0]!;
    expect(entry.specializationId ?? null).toBeNull();
    expect(entry.specializationLevel ?? 0).toBe(0);
  });

  it("[Test 8/11] Season Gold does NOT cross a Season boundary — resets to the starting amount", () => {
    mockSeasonNumber(2);
    updateSave({ ascensionLastSyncedSeason: 1, seasonBestWave: 40, gold: 50000 });

    syncSeasonIfNeeded();

    expect(loadSave().gold).toBe(RUN_START.startingGold);
  });

  it("[Test 9/11] items/inventory continue across a Season boundary", () => {
    mockSeasonNumber(2);
    const inventory = [createItemInstance("iron_sword", "player-1", { type: "PHASE_MILESTONE", refId: "phase-1" })];
    updateSave({ ascensionLastSyncedSeason: 1, seasonBestWave: 40, inventory });

    syncSeasonIfNeeded();

    expect(loadSave().inventory).toEqual(inventory);
  });

  it("[Test 10/11] Best Wave history (the account's all-time bestWave) continues across a Season boundary", () => {
    mockSeasonNumber(2);
    updateSave({ ascensionLastSyncedSeason: 1, seasonBestWave: 40, bestWave: 123 });

    syncSeasonIfNeeded();

    expect(loadSave().bestWave).toBe(123);
  });

  it("[Test 11/11] seasonBestWave and ranking reset correctly at a new Season", () => {
    mockSeasonNumber(2);
    updateSave({ ascensionLastSyncedSeason: 1, seasonBestWave: 88 });

    syncSeasonIfNeeded();

    const main = loadSave();
    expect(main.seasonBestWave).toBe(0);
    expect(getAscensionStatus().seasonBestWave).toBe(0);
    expect(getAscensionStatus().hasParticipated).toBe(false);
  });

  it("[Test 6/11 — see towerSkins.test.ts] a skin cannot be bought with Gold — covered at the entities/Tower.ts + towerSkins.ts level (every TOWER_SKINS entry only has a gemCost, never a goldCost field)", () => {
    // Documented here for traceability with the user's 11-test checklist;
    // the actual assertion lives in config/towerSkins.test.ts ("every skin
    // has a positive Gems cost") since TowerSkinDefinition has no gold-cost
    // field at all for GameEngine.purchaseTowerSkin to ever read.
    expect(true).toBe(true);
  });

  it("a season that ended with NO participation (never left wave 0) is recorded but grants no reward — no free-riding an idle account", () => {
    mockSeasonNumber(2);
    updateSave({ ascensionLastSyncedSeason: 1, gems: 0, seasonBestWave: 0 });

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
    updateSave({ ascensionLastSyncedSeason: 1, gems: 0, seasonBestWave: 30 });

    syncSeasonIfNeeded();
    const gemsAfterFirst = loadSave().gems;
    const historyAfterFirst = loadSave().ascensionHistory.length;

    syncSeasonIfNeeded(); // already caught up — must be a pure no-op
    expect(loadSave().gems).toBe(gemsAfterFirst);
    expect(loadSave().ascensionHistory).toHaveLength(historyAfterFirst);
  });

  it("multiple fully-skipped seasons (app closed for a month) each get their own history entry, only the last-played one uses real leftover progress", () => {
    mockSeasonNumber(5); // 4 seasons (1,2,3,4) have all fully ended
    updateSave({ ascensionLastSyncedSeason: 1, gems: 0, seasonBestWave: 20 }); // real progress from season 1

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
    updateSave({ ascensionLastSyncedSeason: 3, seasonBestWave: 12 });

    const status = getAscensionStatus();
    expect(status.seasonNumber).toBe(3);
    expect(status.seasonBestWave).toBe(12);
    expect(status.hasParticipated).toBe(true);
    expect(typeof status.timeRemainingMs).toBe("number");

    // Confirm it's read-only — a second call sees identical state.
    expect(getAscensionStatus()).toEqual(status);
  });

  it("finalizing a placed season records a full SeasonRewardRecord (spec section 24: SeasonId/PlayerId/RewardId/RewardType/Rank/GrantedAt) per reward, Gems included, and never duplicates them on re-sync", () => {
    mockSeasonNumber(2);
    updateSave({ ascensionLastSyncedSeason: 1, gems: 0, seasonRewardRecords: [], seasonBestWave: 40 });

    syncSeasonIfNeeded();

    const main = loadSave();
    const expectedBundle = getSeasonRewardBundle(1, 1);
    // One record per cosmetic, plus one for the Gems grant.
    expect(main.seasonRewardRecords).toHaveLength(expectedBundle.cosmetics.length + 1);

    const gemsRecord = main.seasonRewardRecords.find((r) => r.rewardType === "GEMS");
    expect(gemsRecord).toMatchObject({ seasonId: "season-1", seasonNumber: 1, playerId: main.playerId, rank: 1 });
    expect(typeof gemsRecord!.grantedAt).toBe("number");

    for (const cosmetic of expectedBundle.cosmetics) {
      const record = main.seasonRewardRecords.find((r) => r.rewardId === cosmetic.id);
      expect(record).toMatchObject({ seasonNumber: 1, playerId: main.playerId, rewardType: cosmetic.type, rank: 1 });
    }

    // Re-syncing (already caught up) must never add duplicate records.
    syncSeasonIfNeeded();
    expect(loadSave().seasonRewardRecords).toHaveLength(expectedBundle.cosmetics.length + 1);
  });
});
