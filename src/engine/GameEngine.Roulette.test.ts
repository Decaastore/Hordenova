import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { RUN_START } from "@/config/gameBalance";
import { CASTLE_SKINS } from "@/config/castleSkins";
import { ROULETTE_CASTLE_SKIN_FALLBACK_GEMS, ROULETTE_GEM_REWARD_AMOUNT } from "@/config/roulette";

const TICK_MS = 50;

/** A strong, mixed build (same precedent as GameEngine.test.ts's reload test) so combat clears wave 9 into wave 10 quickly and deterministically rather than dying to it. */
const STRONG_LOADOUT = [
  { slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD" as const, level: 10 },
  { slotId: TOWER_SLOTS[1]!.id, type: "INFERNO" as const, level: 10 },
  { slotId: TOWER_SLOTS[2]!.id, type: "FROSTBORN" as const, level: 10 },
  { slotId: TOWER_SLOTS[3]!.id, type: "STORMCALLER" as const, level: 10 },
];

function runUntilWaveAtLeast(engine: GameEngine, targetWave: number, maxIterations = 20_000): void {
  let iterations = 0;
  while (engine.getHudSnapshot().bestWave < targetWave && engine.getHudSnapshot().phase !== "PROGRESSION_STOPPED" && iterations < maxIterations) {
    engine.update(TICK_MS);
    iterations++;
  }
}

describe("GameEngine — Roulette (Master Implementation spec sections 46-48)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("crossing wave 10 for the first time spins a real Roulette, grants the reward immediately, and surfaces it as a pending banner", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // lands in the first band: CASTLE_HP_5

    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();

    runUntilWaveAtLeast(engine, 10);

    const hud = engine.getHudSnapshot();
    expect(hud.bestWave).toBeGreaterThanOrEqual(10);
    expect(hud.maxBaseHp).toBe(RUN_START.baseHp + 5);
    expect(hud.pendingRouletteResult).toEqual({
      wave: 10,
      rewardType: "CASTLE_HP_5",
      castleHpGranted: 5,
      gemsGranted: 0,
      castleSkinId: null,
    });

    engine.acknowledgeRouletteResult();
    expect(engine.getHudSnapshot().pendingRouletteResult).toBeNull();
  });

  it("the Castle HP bonus is permanent — a brand-new engine instance (a reload) loads the raised maxBaseHp", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, towerLoadout: STRONG_LOADOUT });
    const first = new GameEngine();
    first.startRun();
    runUntilWaveAtLeast(first, 10);
    expect(first.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp + 5);

    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp + 5);
    expect(loadSave().castleHpBonus).toBe(5);
  });

  it("never spins the Roulette twice for the same wave — no double-granting on repeated ticks past the milestone", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();
    runUntilWaveAtLeast(engine, 10);
    engine.acknowledgeRouletteResult();

    // Keep ticking well past the milestone wave — must never produce a second banner for wave 10.
    for (let i = 0; i < 200; i++) engine.update(TICK_MS);
    expect(engine.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp + 5);
    expect(loadSave().castleHpBonus).toBe(5);
  });

  it("the GEM outcome adds exactly ROULETTE_GEM_REWARD_AMOUNT Gems via the real GemManager path", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.95); // [90,99) band -> GEM
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, gems: 0, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();
    runUntilWaveAtLeast(engine, 10);

    expect(engine.getHudSnapshot().pendingRouletteResult).toMatchObject({ rewardType: "GEM", gemsGranted: ROULETTE_GEM_REWARD_AMOUNT });
    expect(engine.getGemBalance()).toBe(ROULETTE_GEM_REWARD_AMOUNT);
  });

  it("the CASTLE_SKIN outcome grants a real, previously-unowned Castle Skin — permanent, non-consumable", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999); // [99,100) band -> CASTLE_SKIN
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, unlockedCastleSkinIds: [], towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();
    runUntilWaveAtLeast(engine, 10);

    const expectedSkinId = CASTLE_SKINS[0]!.id;
    expect(engine.getHudSnapshot().pendingRouletteResult).toMatchObject({ rewardType: "CASTLE_SKIN", castleSkinId: expectedSkinId });
    expect(engine.getUnlockedCastleSkinIds()).toContain(expectedSkinId);

    // Survives a reload (permanent collection, never a consumable).
    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.getUnlockedCastleSkinIds()).toContain(expectedSkinId);
  });

  it("the CASTLE_SKIN outcome falls back to Gems when every real Castle Skin is already owned, instead of wasting the roll", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    updateSave({
      currentWave: 9,
      bestWave: 9,
      gold: 99_999,
      gems: 0,
      unlockedCastleSkinIds: CASTLE_SKINS.map((s) => s.id), // already owns every real skin
      towerLoadout: STRONG_LOADOUT,
    });
    const engine = new GameEngine();
    engine.startRun();
    runUntilWaveAtLeast(engine, 10);

    expect(engine.getHudSnapshot().pendingRouletteResult).toMatchObject({
      rewardType: "CASTLE_SKIN",
      castleSkinId: null,
      gemsGranted: ROULETTE_CASTLE_SKIN_FALLBACK_GEMS,
    });
    expect(engine.getGemBalance()).toBe(ROULETTE_CASTLE_SKIN_FALLBACK_GEMS);
  });
});
