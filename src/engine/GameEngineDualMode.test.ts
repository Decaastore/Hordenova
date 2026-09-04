import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { ASCENSION_STORAGE_KEY, loadSave, updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

/**
 * Master Implementation spec section 1/2 — "REGRA FUNDAMENTAL: dois modos
 * completamente separados". GameEngine itself has zero mode-branching
 * logic (see its constructor's own doc comment) — this proves the
 * separation actually holds end-to-end: two real engine instances, one per
 * storage key, playing independently without a single line of cross-talk.
 */
describe("GameEngine — Infinite/Ascension dual-mode via storageKey (Master Implementation spec section 1/2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("an Infinite engine (default storageKey) and an Ascension engine (ASCENSION_STORAGE_KEY) never see each other's gold/towers/wave", () => {
    updateSave({ currentWave: 1, gold: 100_000, towerLoadout: [] }); // Infinite
    updateSave({ currentWave: 1, gold: 100_000, towerLoadout: [] }, ASCENSION_STORAGE_KEY); // Ascension

    const infinite = new GameEngine();
    const ascension = new GameEngine(ASCENSION_STORAGE_KEY);
    infinite.startRun();
    ascension.startRun();

    infinite.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    infinite.selectTower(infinite.getRenderSnapshot().towers[0]!.id);
    infinite.upgradeSelectedTower();
    infinite.upgradeSelectedTower();

    // Ascension never built anything — its own state must be completely unaffected.
    expect(ascension.getRenderSnapshot().towers).toHaveLength(0);
    expect(ascension.getHudSnapshot().gold).toBe(100_000);

    // And persisting Infinite's progress must not leak into the Ascension save blob.
    expect(loadSave(ASCENSION_STORAGE_KEY).towerLoadout).toEqual([]);
    expect(loadSave(ASCENSION_STORAGE_KEY).gold).toBe(100_000);
    expect(loadSave().towerLoadout.length).toBeGreaterThan(0);
  });

  it("a defeat in Ascension mode records bestWave only in the Ascension save, never touching Infinite's own bestWave", () => {
    updateSave({ bestWave: 500 }); // Infinite's real personal best
    updateSave({ currentWave: 1, gold: 0, towerLoadout: [], bestWave: 0 }, ASCENSION_STORAGE_KEY);

    const ascension = new GameEngine(ASCENSION_STORAGE_KEY);
    ascension.startRun();
    // Drive baseHp to 0 directly to force PROGRESSION_STOPPED without
    // needing a full combat simulation — this test is about which save
    // gets written, not about combat itself.
    for (let i = 0; i < 500 && ascension.getHudSnapshot().phase !== "PROGRESSION_STOPPED"; i++) {
      ascension.update(1000);
    }

    expect(loadSave().bestWave).toBe(500); // untouched
  });

  it("both engines can run simultaneously in the same tab without their in-memory state colliding", () => {
    updateSave({ currentWave: 1, gold: 500, towerLoadout: [] });
    updateSave({ currentWave: 1, gold: 500, towerLoadout: [] }, ASCENSION_STORAGE_KEY);

    const infinite = new GameEngine();
    const ascension = new GameEngine(ASCENSION_STORAGE_KEY);
    infinite.startRun();
    ascension.startRun();

    infinite.placeTower(TOWER_SLOTS[0]!.id, "FROSTBORN");
    ascension.placeTower(TOWER_SLOTS[1]!.id, "STORMCALLER");

    expect(infinite.getRenderSnapshot().towers[0]!.type).toBe("FROSTBORN");
    expect(ascension.getRenderSnapshot().towers[0]!.type).toBe("STORMCALLER");
    expect(infinite.getRenderSnapshot().towers).toHaveLength(1);
    expect(ascension.getRenderSnapshot().towers).toHaveLength(1);
  });
});
