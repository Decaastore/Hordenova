import { beforeEach, describe, expect, it } from "vitest";
import { ASCENSION_STORAGE_KEY, DEFAULT_SAVE_DATA, SAVE_DATA_VERSION, loadSave, recordRunResult, updateSave, writeSave } from "./SaveSystem";
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
    // Progression 2.0 self-heals a pre-existing entry missing the new
    // specialization/skin fields to their "never chosen" defaults, rather
    // than dropping it — see parseTowerLoadout in SaveSystem.ts.
    expect(loaded.towerLoadout).toEqual([
      {
        slotId: "slot-1",
        type: "IRONWOOD",
        level: 3,
        specializationId: null,
        specializationLevel: 0,
        equippedSkinId: null,
        masteryLevel: 0,
      },
    ]);
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

  describe("Save versioning (Master Implementation Pass spec section 39)", () => {
    it("a pre-Tower-Mastery/pre-Prestige save (v9, missing masteryLevel/prestigeLevel entirely) self-heals both new fields to their fresh-account defaults without losing any pre-existing progress", () => {
      window.localStorage.setItem(
        SAVE_STORAGE_KEY,
        JSON.stringify({
          version: 9,
          bestWave: 240,
          gold: 88_000,
          currentWave: 240,
          towerLoadout: [{ slotId: "slot-1", type: "IRONWOOD", level: 30, specializationId: null, specializationLevel: 0, equippedSkinId: null }],
          gems: 42,
        }),
      );
      const loaded = loadSave();
      expect(loaded.version).toBe(SAVE_DATA_VERSION);
      // Pre-existing progress is fully preserved.
      expect(loaded.bestWave).toBe(240);
      expect(loaded.gold).toBe(88_000);
      expect(loaded.currentWave).toBe(240);
      expect(loaded.gems).toBe(42);
      // Brand-new fields self-heal to a fresh-account default, never throwing/dropping the save.
      expect(loaded.prestigeLevel).toBe(0);
      expect(loaded.towerLoadout[0]?.masteryLevel).toBe(0);
    });

    it("never regresses a save already at the current (or a future) version", () => {
      window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SAVE_DATA, version: 999, prestigeLevel: 7 }));
      const loaded = loadSave();
      // loadSave always normalizes to the code's own SAVE_DATA_VERSION on write,
      // but must never discard a higher-versioned save's actual data doing so.
      expect(loaded.prestigeLevel).toBe(7);
    });

    it("reloading an already-migrated save (F5 twice in a row) is idempotent — no field drifts or resets on a second load", () => {
      writeSave({ ...DEFAULT_SAVE_DATA, prestigeLevel: 3, gold: 500, towerLoadout: [{ slotId: "s1", type: "INFERNO", level: 10, specializationId: null, specializationLevel: 0, equippedSkinId: null, masteryLevel: 5 }] });
      const first = loadSave();
      const second = loadSave();
      expect(second).toEqual(first);
    });

    it("CORREÇÃO DE REQUISITOS: a pre-Season-Mastery save (missing towerMasteryLevels/ownedTowerSkinIds/equippedTowerSkinByType entirely) self-heals all three to empty defaults", () => {
      window.localStorage.setItem(
        SAVE_STORAGE_KEY,
        JSON.stringify({ version: 13, bestWave: 10, seasonBestWave: 10 }),
      );
      const loaded = loadSave();
      expect(loaded.towerMasteryLevels).toEqual({});
      expect(loaded.ownedTowerSkinIds).toEqual([]);
      expect(loaded.equippedTowerSkinByType).toEqual({});
    });

    it("towerMasteryLevels/ownedTowerSkinIds/equippedTowerSkinByType round-trip through save/load exactly, and a tampered/malformed value self-heals instead of throwing", () => {
      writeSave({
        ...DEFAULT_SAVE_DATA,
        towerMasteryLevels: { IRONWOOD: 3, INFERNO: 1 },
        ownedTowerSkinIds: ["IRONWOOD_WARDEN_OF_THE_ABYSS"],
        equippedTowerSkinByType: { IRONWOOD: "IRONWOOD_WARDEN_OF_THE_ABYSS" },
      });
      const loaded = loadSave();
      expect(loaded.towerMasteryLevels).toEqual({ IRONWOOD: 3, INFERNO: 1 });
      expect(loaded.ownedTowerSkinIds).toEqual(["IRONWOOD_WARDEN_OF_THE_ABYSS"]);
      expect(loaded.equippedTowerSkinByType).toEqual({ IRONWOOD: "IRONWOOD_WARDEN_OF_THE_ABYSS" });

      // Tampered save: an invalid tower type key, a negative mastery level,
      // and a skin id that doesn't belong to the tower type it's keyed
      // under — every one of these must be dropped, never trusted as-is.
      window.localStorage.setItem(
        SAVE_STORAGE_KEY,
        JSON.stringify({
          ...DEFAULT_SAVE_DATA,
          towerMasteryLevels: { IRONWOOD: -5, NOT_A_TOWER: 9 },
          ownedTowerSkinIds: ["real-string", 42, null],
          equippedTowerSkinByType: { IRONWOOD: "INFERNO_ASHEN_TYRANT", NOT_A_TOWER: "x" },
        }),
      );
      const tamperedLoad = loadSave();
      expect(tamperedLoad.towerMasteryLevels).toEqual({});
      expect(tamperedLoad.ownedTowerSkinIds).toEqual(["real-string"]);
      expect(tamperedLoad.equippedTowerSkinByType).toEqual({});
    });
  });

  describe("Ascension storage namespace (Master Implementation spec section 2)", () => {
    it("the Ascension save is a completely separate blob from the Infinite save — writing one never touches the other", () => {
      updateSave({ gold: 999, currentWave: 50 }); // Infinite
      updateSave({ gold: 5, currentWave: 3 }, ASCENSION_STORAGE_KEY); // Ascension

      expect(loadSave().gold).toBe(999);
      expect(loadSave().currentWave).toBe(50);
      expect(loadSave(ASCENSION_STORAGE_KEY).gold).toBe(5);
      expect(loadSave(ASCENSION_STORAGE_KEY).currentWave).toBe(3);
    });

    it("recordRunResult against the Ascension key only raises the Ascension save's bestWave, leaving Infinite's untouched", () => {
      writeSave({ ...DEFAULT_SAVE_DATA, bestWave: 100 }); // Infinite's own personal best
      writeSave({ ...DEFAULT_SAVE_DATA, bestWave: 0 }, ASCENSION_STORAGE_KEY);

      recordRunResult(7, ASCENSION_STORAGE_KEY);

      expect(loadSave(ASCENSION_STORAGE_KEY).bestWave).toBe(7);
      expect(loadSave().bestWave).toBe(100);
    });

    it("a fresh Ascension save (nothing written yet) still returns valid default data, independent of whatever the Infinite save holds", () => {
      updateSave({ gold: 12345, bestWave: 999 }); // Infinite has real progress
      const ascension = loadSave(ASCENSION_STORAGE_KEY); // Ascension never touched
      expect(ascension.gold).toBe(DEFAULT_SAVE_DATA.gold);
      expect(ascension.bestWave).toBe(0);
    });

    it("permanent Ascension fields (history/trophies/counters) live on the Infinite save, not the Ascension namespace", () => {
      const entry = { seasonNumber: 3, bestWave: 88, rank: 1 as const, achievedAtMs: 5000, seasonThemeNameKey: "EMBERS_OF_WAR" };
      updateSave({ ascensionHistory: [entry], ascensionSeasonsWon: 1 });

      expect(loadSave().ascensionHistory).toEqual([entry]);
      expect(loadSave().ascensionSeasonsWon).toBe(1);
      // The Ascension namespace itself never carries this — it's not what it's for.
      expect(loadSave(ASCENSION_STORAGE_KEY).ascensionHistory).toEqual([]);
    });
  });
});
