import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { ETERNAL_STORAGE_KEY, hasEternalCastle, loadEternalCastle, loadSave, updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

describe("Eternal castle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("is a separate castle that shares the account: its waves and gold never touch the Season castle, gems do", () => {
    updateSave({ currentWave: 40, gold: 777, seasonBestWave: 40, freeGems: 10 });
    expect(hasEternalCastle()).toBe(false);
    const eternal = loadSave(ETERNAL_STORAGE_KEY);
    expect(eternal.currentWave).toBe(0);
    expect(eternal.towerLoadout).toEqual([]);
    expect(eternal.freeGems).toBe(10);

    updateSave({ currentWave: 12, gold: 50, freeGems: 25 }, ETERNAL_STORAGE_KEY);
    const main = loadSave();
    expect(main.currentWave).toBe(40);
    expect(main.gold).toBe(777);
    expect(main.freeGems).toBe(25);
    expect(loadEternalCastle()!.currentWave).toBe(12);
  });

  it("an Eternal engine plays, pays the 50-wave milestone and counts weekly contracts", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    updateSave(
      {
        currentWave: 49,
        seasonBestWave: 49,
        gold: 0,
        towerLoadout: TOWER_SLOTS.slice(0, 6).map((s, i) => ({ slotId: s.id, type: (["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"] as const)[i % 4]!, level: 60 })),
      },
      ETERNAL_STORAGE_KEY,
    );
    const engine = new GameEngine(ETERNAL_STORAGE_KEY);
    engine.startRun();
    expect(engine.getHudSnapshot().eternal.active).toBe(true);
    for (let i = 0; i < 4000 && engine.getHudSnapshot().seasonBestWave < 51; i++) engine.update(100);
    const hud = engine.getHudSnapshot();
    expect(hud.seasonBestWave).toBeGreaterThanOrEqual(50);
    expect(hud.eternal.marks).toBeGreaterThan(0);
    expect(hud.eternal.lastEvent?.kind).toBe("MILESTONE");
    const waves = engine.getEternalContracts().find((c) => c.kind === "CLEAR_WAVES");
    if (waves) expect(waves.progress).toBeGreaterThan(0);
    // the Season castle was never touched
    expect(loadSave().currentWave).toBe(0);
  }, 60_000);

  it("a Season engine is not the Eternal one", () => {
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().eternal.active).toBe(false);
  });
});

describe("Season end joins the Eternal castle", () => {
  beforeEach(() => window.localStorage.clear());

  it("the Season castle becomes the Eternal one when the Season ends, then the Season starts over", async () => {
    const { syncSeasonIfNeeded } = await import("./AscensionManager");
    const { seasonClock } = await import("./SeasonClock");
    const current = seasonClock.getCurrentSeasonWindow().seasonNumber;
    updateSave({
      ascensionLastSyncedSeason: current - 1,
      seasonBestWave: 95,
      currentWave: 95,
      gold: 1234,
      towerLoadout: [{ slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 33 }],
    });
    syncSeasonIfNeeded();
    const eternal = loadEternalCastle()!;
    expect(eternal.seasonBestWave).toBe(95);
    expect(eternal.gold).toBe(1234);
    expect(eternal.towerLoadout[0]!.level).toBe(33);
    const main = loadSave();
    expect(main.seasonBestWave).toBe(0);
    expect(main.towerLoadout[0]!.level).toBe(1);
  });
});
