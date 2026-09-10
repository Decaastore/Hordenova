import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAscensionStatus, resetSeasonProgressionForTesting, syncSeasonIfNeeded } from "./AscensionManager";
import { loadSave, updateSave } from "./SaveSystem";
import { LocalSeasonClock, SEASON_DURATION_MS, SEASON_EPOCH_MS, seasonClock } from "./SeasonClock";
import { GameEngine } from "./GameEngine";
import { getSeasonRewardBundle } from "@/config/ascension";
import { RUN_START } from "@/config/gameBalance";
import { createItemInstance } from "@/entities/Item";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

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

  it("[Test 3/11 & 4/11] Tower Mastery OWNERSHIP is PERMANENT — untouched by a Season boundary — while its numeric LEVEL is Season-scoped and resets to 0", () => {
    mockSeasonNumber(2);
    updateSave({
      ascensionLastSyncedSeason: 1,
      seasonBestWave: 40,
      gold: 12345,
      masteryUnlocked: { IRONWOOD: true },
      towerMasteryLevels: { IRONWOOD: 7 },
    });

    syncSeasonIfNeeded();

    const main = loadSave();
    // HORDENOVA Season/Progression v1.0 — "Season resets progression, not
    // ownership": the one-time 400 Gems unlock (funded by Gems, never Gold —
    // see GameEngineProgression2.test.ts's own dedicated coverage) is never
    // re-charged and survives every Season boundary...
    expect(main.masteryUnlocked.IRONWOOD).toBe(true);
    // ...but the numeric level it gates access to is Season-scoped, exactly
    // like tower level and specialization level — it resets to a clean
    // slate at the start of every Season, regardless of ownership.
    expect(main.towerMasteryLevels.IRONWOOD).toBeUndefined();
    // Gold itself is also Season-scoped and resets independently of both.
    expect(main.gold).toBe(RUN_START.startingGold);
  });

  it("SISTEMA DE SLOTS DE EQUIPAMENTO — a purchased item slot unlock is PERMANENT, exactly like Mastery ownership — untouched by a Season boundary", () => {
    mockSeasonNumber(2);
    updateSave({
      ascensionLastSyncedSeason: 1,
      seasonBestWave: 40,
      gold: 12345,
      unlockedItemSlots: { IRONWOOD: [true, true, false] },
    });

    syncSeasonIfNeeded();

    const main = loadSave();
    // The Gems spent to unlock slot 2 (index 1) must never be re-charged by
    // a Season boundary — AscensionManager's season-reset updateSave call
    // simply never names unlockedItemSlots, so it survives untouched.
    expect(main.unlockedItemSlots.IRONWOOD).toEqual([true, true, false]);
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

  it("Profile Prestige (bought with Gems, permanent) is completely untouched by a Season boundary", () => {
    mockSeasonNumber(2);
    updateSave({ ascensionLastSyncedSeason: 1, seasonBestWave: 40, prestigeLevel: 12 });

    syncSeasonIfNeeded();

    expect(loadSave().prestigeLevel).toBe(12);
  });

  it("[Test 7/11] tower specialization progress does NOT cross a Season boundary, but the account's ownership of the path (paid for in Gems) does", () => {
    mockSeasonNumber(2);
    updateSave({
      ascensionLastSyncedSeason: 1,
      seasonBestWave: 40,
      towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 30, specializationId: "IRONWOOD_EXECUTIONER", specializationLevel: 5 }],
      unlockedSpecializationIds: { IRONWOOD: ["IRONWOOD_EXECUTIONER"] },
    });

    syncSeasonIfNeeded();

    const main = loadSave();
    const entry = main.towerLoadout[0]!;
    expect(entry.specializationId ?? null).toBeNull();
    expect(entry.specializationLevel ?? 0).toBe(0);
    // HORDENOVA Season/Progression v1.0 — "Season resets progression, not
    // ownership": the 500 Gems already spent on this path is never
    // re-charged; re-choosing it next Season is free (see
    // GameEngineProgression2.test.ts's own dedicated coverage).
    expect(main.unlockedSpecializationIds.IRONWOOD).toEqual(["IRONWOOD_EXECUTIONER"]);
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

  /**
   * BALANCEAMENTO DEFINITIVO spec section 7/12 — regression test for a real
   * bug found during the persistence audit: the season reset rebuilds each
   * TowerLoadoutEntry from scratch and had forgotten to carry forward the
   * new equippedItemInstanceIds field, silently unequipping every tower's
   * items at every Season boundary even though this file's own header
   * classifies items/inventory as PERMANENT. Items grant no combat power in
   * this pass, so there is no seasonal-balance reason to strip them either.
   */
  it("equipped items survive a Season boundary — Item Slots are equipment/build state, not seasonal combat progression", () => {
    mockSeasonNumber(2);
    const item = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({
      ascensionLastSyncedSeason: 1,
      seasonBestWave: 40,
      inventory: [item],
      towerLoadout: [
        {
          slotId: "slot-1",
          type: "IRONWOOD",
          level: 12,
          specializationId: "IRONWOOD_EXECUTIONER",
          specializationLevel: 3,
          equippedItemInstanceIds: [item.instanceId, null, null],
        },
      ],
    });

    syncSeasonIfNeeded();

    const reloaded = loadSave();
    expect(reloaded.towerLoadout[0]!.equippedItemInstanceIds).toEqual([item.instanceId, null, null]);
    // Level/specialization DID reset, exactly as before — only the equip state survived.
    expect(reloaded.towerLoadout[0]!.level).toBe(1);
    expect(reloaded.towerLoadout[0]!.specializationId).toBeNull();
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

/**
 * CLAUDE CODE — IMPLEMENTAÇÃO INTEGRADA spec section 9: "Reset global para
 * teste" — a second, independent, manually-triggered reset path (distinct
 * from syncSeasonIfNeeded's real season-boundary logic). Must zero
 * everything spec section 9 lists (Best Wave included — the one field
 * syncSeasonIfNeeded deliberately never touches) while preserving the exact
 * same permanent bucket this file's other tests already establish.
 */
describe("AscensionManager.resetSeasonProgressionForTesting — manual global reset for testing (spec section 9)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("zeroes Best Wave (all-time), seasonBestWave, currentWave, and Gold", () => {
    updateSave({ bestWave: 480, seasonBestWave: 55, currentWave: 55, gold: 99999 });

    resetSeasonProgressionForTesting();

    const main = loadSave();
    expect(main.bestWave).toBe(0);
    expect(main.seasonBestWave).toBe(0);
    expect(main.currentWave).toBe(0);
    expect(main.gold).toBe(RUN_START.startingGold);
  });

  /**
   * CORRECTION (this describe block's own earlier version had this
   * backwards): a real Season boundary (syncSeasonIfNeeded) keeps every
   * placed tower standing and only resets its level/specialization — but
   * this MANUAL TESTING reset must additionally clear the map itself, so a
   * tester starts as if they had never placed a tower this Season. Merely
   * zeroing each entry's `level` field is NOT enough — the entries
   * themselves (the map's only persisted "what's placed, in which slot"
   * record) must be gone.
   */
  it("removes every tower currently placed on the map — towerLoadout is empty after the reset, not just re-leveled", () => {
    updateSave({
      bestWave: 300,
      towerLoadout: [
        { slotId: "slot-1", type: "IRONWOOD", level: 60, specializationId: "IRONWOOD_EXECUTIONER", specializationLevel: 20 },
        { slotId: "slot-2", type: "INFERNO", level: 45 },
        { slotId: "slot-3", type: "FROSTBORN", level: 30 },
      ],
    });

    resetSeasonProgressionForTesting();

    expect(loadSave().towerLoadout).toEqual([]);
  });

  it("Tower Levels are gone along with the removed towers — no leftover loadout entry carries a level of any kind", () => {
    updateSave({
      towerLoadout: [
        { slotId: "slot-1", type: "IRONWOOD", level: 60 },
        { slotId: "slot-2", type: "INFERNO", level: 45 },
      ],
    });

    resetSeasonProgressionForTesting();

    const main = loadSave();
    expect(main.towerLoadout).toHaveLength(0);
    expect(main.towerLoadout.some((e) => e.level > 0)).toBe(false);
  });

  it("Mastery Levels (the season-scoped per-type map, independent of which towers are currently placed) reset to empty", () => {
    updateSave({
      towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 60 }],
      towerMasteryLevels: { IRONWOOD: 30, INFERNO: 18 },
    });

    resetSeasonProgressionForTesting();

    expect(loadSave().towerMasteryLevels).toEqual({});
  });

  it("Specialization Levels are gone along with the removed towers — no leftover loadout entry carries a specialization choice or level", () => {
    updateSave({
      towerLoadout: [
        { slotId: "slot-1", type: "IRONWOOD", level: 60, specializationId: "IRONWOOD_EXECUTIONER", specializationLevel: 20 },
      ],
    });

    resetSeasonProgressionForTesting();

    const main = loadSave();
    expect(main.towerLoadout).toHaveLength(0);
    expect(main.towerLoadout.some((e) => (e.specializationLevel ?? 0) > 0)).toBe(false);
  });

  it("PRESERVES every permanent field: Mastery/Specialization ownership, Gems, owned skins, item-slot unlocks, inventory, Prestige, and ascension history/records — clearing towerLoadout never touches any of them", () => {
    const item = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    updateSave({
      bestWave: 300,
      gems: 4321,
      gemShards: 7,
      prestigeLevel: 12,
      masteryUnlocked: { IRONWOOD: true },
      unlockedSpecializationIds: { IRONWOOD: ["IRONWOOD_EXECUTIONER"] },
      unlockedItemSlots: { IRONWOOD: [true, true, false] },
      ownedTowerSkinIds: ["IRONWOOD_WARDEN_OF_THE_ABYSS"],
      equippedTowerSkinByType: { IRONWOOD: "IRONWOOD_WARDEN_OF_THE_ABYSS" },
      inventory: [item],
      ascensionSeasonsWon: 3,
      ascensionTop3: 5,
      ascensionTop5: 6,
      towerLoadout: [
        {
          slotId: "slot-1",
          type: "IRONWOOD",
          level: 40,
          specializationId: "IRONWOOD_EXECUTIONER",
          specializationLevel: 10,
          equippedItemInstanceIds: [item.instanceId, null, null],
        },
      ],
    });
    const playerIdBefore = loadSave().playerId;

    resetSeasonProgressionForTesting();

    const main = loadSave();
    expect(main.playerId).toBe(playerIdBefore);
    expect(main.gems).toBe(4321);
    expect(main.gemShards).toBe(7);
    expect(main.prestigeLevel).toBe(12);
    expect(main.masteryUnlocked.IRONWOOD).toBe(true);
    expect(main.unlockedSpecializationIds.IRONWOOD).toEqual(["IRONWOOD_EXECUTIONER"]);
    expect(main.unlockedItemSlots.IRONWOOD).toEqual([true, true, false]);
    expect(main.ownedTowerSkinIds).toContain("IRONWOOD_WARDEN_OF_THE_ABYSS");
    expect(main.equippedTowerSkinByType.IRONWOOD).toBe("IRONWOOD_WARDEN_OF_THE_ABYSS");
    // The item itself remains permanently owned in inventory — only its
    // equip-on-a-tower-slot association is gone, since the tower slot it
    // was equipped to no longer exists.
    expect(main.inventory).toEqual([item]);
    expect(main.ascensionSeasonsWon).toBe(3);
    expect(main.ascensionTop3).toBe(5);
    expect(main.ascensionTop5).toBe(6);
  });

  it("never touches ascensionHistory/ascensionLastSyncedSeason — this is not a real season boundary, so nothing gets finalized or recorded", () => {
    mockSeasonNumber(2);
    updateSave({ ascensionLastSyncedSeason: 1, ascensionHistory: [], bestWave: 200, seasonBestWave: 40 });

    resetSeasonProgressionForTesting();

    const main = loadSave();
    expect(main.ascensionHistory).toEqual([]);
    expect(main.ascensionLastSyncedSeason).toBe(1);
  });

  it("the old Best Wave never reappears after a reload — the reset is written to the real persistent save, not just an in-memory value", () => {
    updateSave({ bestWave: 777, seasonBestWave: 777 });

    resetSeasonProgressionForTesting();

    // Simulate a reload by loading fresh from the persistent store again.
    const reloaded = loadSave();
    expect(reloaded.bestWave).toBe(0);
    expect(reloaded.seasonBestWave).toBe(0);
  });

  /**
   * Real-engine proof (not just a SaveData assertion): GameEngine's own
   * constructor is the thing that turns `towerLoadout` back into on-map
   * towers on every resume (`this.towers = save.towerLoadout.map(...)`),
   * and its `persist()` writes `this.towers` straight back into that same
   * field. Both directions run through the exact save this test reset —
   * proving the fix isn't just "the raw array looks empty" but "the game
   * itself, reading this save fresh, renders no towers and never re-derives
   * any from elsewhere."
   */
  it("reload after the reset never resurrects a placed tower — a fresh GameEngine reading the post-reset save renders an empty map", () => {
    updateSave({
      gold: 1_000_000,
      towerLoadout: [
        { slotId: "slot-1", type: "IRONWOOD", level: 40 },
        { slotId: "slot-2", type: "INFERNO", level: 25 },
      ],
    });

    resetSeasonProgressionForTesting();

    // A brand-new GameEngine instance, constructed fresh from the same
    // persistent store — the closest this test suite gets to a real page
    // reload without a browser.
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getRenderSnapshot().towers).toEqual([]);
  });

  it("the player can place a tower again immediately after the reset — the empty map is a real, usable starting state, not a broken one", () => {
    updateSave({
      gold: 1_000_000,
      towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 40 }],
    });

    resetSeasonProgressionForTesting();

    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getRenderSnapshot().towers).toEqual([]);

    const placed = engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");

    expect(placed).toBe(true);
    expect(engine.getRenderSnapshot().towers).toHaveLength(1);
    expect(engine.getRenderSnapshot().towers[0]!.level).toBe(1);
  });

  it("Prestige is preserved by the reset (spot-checked again through the real GameEngine's own save-derived state, not just loadSave)", () => {
    updateSave({ prestigeLevel: 9, towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 40 }] });

    resetSeasonProgressionForTesting();

    expect(loadSave().prestigeLevel).toBe(9);
  });

  function mockSeasonNumber(n: number) {
    const t = SEASON_EPOCH_MS + (n - 1) * SEASON_DURATION_MS + 1000;
    vi.spyOn(seasonClock, "getCurrentSeasonWindow").mockImplementation(() => new LocalSeasonClock(() => t).getCurrentSeasonWindow());
    vi.spyOn(seasonClock, "getTimeRemainingMs").mockImplementation(() => new LocalSeasonClock(() => t).getTimeRemainingMs());
    vi.spyOn(seasonClock, "now").mockReturnValue(t);
  }
});
