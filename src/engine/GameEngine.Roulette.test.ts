import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { DEFAULT_SAVE_DATA, loadSave, updateSave, writeSave } from "./SaveSystem";
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

/**
 * AUDITORIA E CORREÇÃO GERAL spec sections 1-13 — the Roulette was
 * rewritten from "auto-resolves the instant a milestone wave is crossed"
 * to "crossing a milestone only enqueues it; nothing is rolled or granted
 * until GameEngine.spinPendingRoulette() is called (the player's own
 * ROLETAR click)". Every test below reflects that: reaching wave 10 must
 * NEVER change Gold/Castle HP/Gems by itself.
 */
describe("GameEngine — Roulette (Master Implementation spec sections 46-48, AUDITORIA E CORREÇÃO GERAL sections 1-13)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wave 9 (one below the first milestone) never has a pending Roulette", () => {
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().pendingRouletteSpinWave).toBeNull();
  });

  it("crossing wave 10 for the first time ONLY enqueues a pending Roulette — Castle HP/Gold/Gems are completely untouched before any spin", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // would land in the first band (CASTLE_HP_5) IF spun
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();

    runUntilWaveAtLeast(engine, 10);

    const hud = engine.getHudSnapshot();
    expect(hud.bestWave).toBeGreaterThanOrEqual(10);
    expect(hud.pendingRouletteSpinWave).toBe(10);
    expect(hud.pendingRouletteResult).toBeNull();
    expect(hud.maxBaseHp).toBe(RUN_START.baseHp); // NOT raised — no auto-grant.

    // Keep ticking well past the milestone — still nothing granted until spun.
    for (let i = 0; i < 200; i++) engine.update(TICK_MS);
    expect(engine.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp);
    expect(engine.getHudSnapshot().pendingRouletteSpinWave).toBe(10);
  });

  it("spinPendingRoulette() is the ONLY thing that rolls and grants a reward — calling it resolves the oldest pending wave", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // [0,45) -> CASTLE_HP_5
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();
    runUntilWaveAtLeast(engine, 10);

    const spun = engine.spinPendingRoulette();
    expect(spun).toBe(true);

    const hud = engine.getHudSnapshot();
    expect(hud.pendingRouletteSpinWave).toBeNull(); // consumed
    expect(hud.maxBaseHp).toBe(RUN_START.baseHp + 5); // now (and only now) granted
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

  it("spinPendingRoulette() returns false and is a safe no-op when nothing is pending", () => {
    updateSave({ currentWave: 5, bestWave: 5, gold: 99_999, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().pendingRouletteSpinWave).toBeNull();
    expect(engine.spinPendingRoulette()).toBe(false);
    expect(engine.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp);
  });

  it("the NOTHING outcome grants absolutely nothing — no Castle HP, no Gems, no skin — but still consumes the pending spin", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9); // [85,100) -> NOTHING
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, gems: 0, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();
    runUntilWaveAtLeast(engine, 10);

    engine.spinPendingRoulette();
    const hud = engine.getHudSnapshot();
    expect(hud.pendingRouletteResult).toEqual({ wave: 10, rewardType: "NOTHING", castleHpGranted: 0, gemsGranted: 0, castleSkinId: null });
    expect(hud.maxBaseHp).toBe(RUN_START.baseHp);
    expect(engine.getGemBalance()).toBe(0);
    expect(hud.pendingRouletteSpinWave).toBeNull();
  });

  it("the Castle HP bonus is permanent and idempotent — a brand-new engine instance (a reload) loads the raised maxBaseHp exactly once, never re-granting", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, towerLoadout: STRONG_LOADOUT });
    const first = new GameEngine();
    first.startRun();
    runUntilWaveAtLeast(first, 10);
    first.spinPendingRoulette();
    expect(first.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp + 5);

    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp + 5);
    expect(loadSave().castleHpBonus).toBe(5);
    // Opening the screen again / ticking more must never re-grant.
    for (let i = 0; i < 50; i++) reloaded.update(TICK_MS);
    expect(reloaded.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp + 5);
  });

  it("F5 before spinning: the pending Roulette survives a reload untouched — never lost, never auto-resolved, never duplicated", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, towerLoadout: STRONG_LOADOUT });
    const first = new GameEngine();
    first.startRun();
    runUntilWaveAtLeast(first, 10);
    expect(first.getHudSnapshot().pendingRouletteSpinWave).toBe(10);
    expect(first.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp); // still not granted

    // F5 == a brand-new GameEngine loading the same save.
    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.getHudSnapshot().pendingRouletteSpinWave).toBe(10);
    expect(reloaded.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp);

    // Now spin on the reloaded instance — exactly one reward, never two.
    reloaded.spinPendingRoulette();
    expect(reloaded.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp + 5);

    // F5 again after spinning: must not re-grant a second time.
    const reloadedAgain = new GameEngine();
    reloadedAgain.startRun();
    expect(reloadedAgain.getHudSnapshot().pendingRouletteSpinWave).toBeNull();
    expect(reloadedAgain.getHudSnapshot().maxBaseHp).toBe(RUN_START.baseHp + 5);
  });

  it("crossing waves 20 and 30 both queue as pending — resolved one at a time, oldest first, never both at once", () => {
    updateSave({ currentWave: 19, bestWave: 19, gold: 999_999, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();

    vi.spyOn(Math, "random").mockReturnValue(0.9); // NOTHING for both, so HP stays comparable
    runUntilWaveAtLeast(engine, 30, 100_000);

    expect(engine.getHudSnapshot().pendingRouletteSpinWave).toBe(20);
    expect(engine.spinPendingRoulette()).toBe(true);
    expect(engine.getHudSnapshot().pendingRouletteResult?.wave).toBe(20);
    engine.acknowledgeRouletteResult();

    expect(engine.getHudSnapshot().pendingRouletteSpinWave).toBe(30);
    expect(engine.spinPendingRoulette()).toBe(true);
    expect(engine.getHudSnapshot().pendingRouletteResult?.wave).toBe(30);

    expect(engine.getHudSnapshot().pendingRouletteSpinWave).toBeNull();
    expect(engine.spinPendingRoulette()).toBe(false);
  });

  it("the GEM outcome adds exactly ROULETTE_GEM_REWARD_AMOUNT Gems via the real GemManager path, only once spun", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.8); // [76,84) -> GEM
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, gems: 0, towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();
    runUntilWaveAtLeast(engine, 10);
    expect(engine.getGemBalance()).toBe(0); // not granted yet

    engine.spinPendingRoulette();
    expect(engine.getHudSnapshot().pendingRouletteResult).toMatchObject({ rewardType: "GEM", gemsGranted: ROULETTE_GEM_REWARD_AMOUNT });
    expect(engine.getGemBalance()).toBe(ROULETTE_GEM_REWARD_AMOUNT);
  });

  it("the CASTLE_SKIN outcome grants a real, previously-unowned Castle Skin — permanent, non-consumable, only once spun", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.845); // [84,85) -> CASTLE_SKIN
    updateSave({ currentWave: 9, bestWave: 9, gold: 99_999, unlockedCastleSkinIds: [], towerLoadout: STRONG_LOADOUT });
    const engine = new GameEngine();
    engine.startRun();
    runUntilWaveAtLeast(engine, 10);
    engine.spinPendingRoulette();

    const expectedSkinId = CASTLE_SKINS[0]!.id;
    expect(engine.getHudSnapshot().pendingRouletteResult).toMatchObject({ rewardType: "CASTLE_SKIN", castleSkinId: expectedSkinId });
    expect(engine.getUnlockedCastleSkinIds()).toContain(expectedSkinId);

    // Survives a reload (permanent collection, never a consumable).
    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.getUnlockedCastleSkinIds()).toContain(expectedSkinId);
  });

  it("the CASTLE_SKIN outcome falls back to Gems when every real Castle Skin is already owned, instead of wasting the roll", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.845);
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
    engine.spinPendingRoulette();

    expect(engine.getHudSnapshot().pendingRouletteResult).toMatchObject({
      rewardType: "CASTLE_SKIN",
      castleSkinId: null,
      gemsGranted: ROULETTE_CASTLE_SKIN_FALLBACK_GEMS,
    });
    expect(engine.getGemBalance()).toBe(ROULETTE_CASTLE_SKIN_FALLBACK_GEMS);
  });

  it("AUDITORIA spec section 12 — Offline Defense crossing multiple milestones queues them as pending, never auto-rolls/auto-grants", () => {
    // A build strong enough to clear real waves offline (mirrors
    // OfflineDefense.test.ts's own STRONG_BUILD fixture) — the point of
    // this test is the milestone-queueing behavior, not offline balance.
    const OFFLINE_STRONG_LOADOUT = [
      { slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD" as const, level: 25 },
      { slotId: TOWER_SLOTS[1]!.id, type: "INFERNO" as const, level: 25 },
      { slotId: TOWER_SLOTS[2]!.id, type: "FROSTBORN" as const, level: 20 },
      { slotId: TOWER_SLOTS[3]!.id, type: "STORMCALLER" as const, level: 20 },
    ];
    // writeSave (not updateSave) — updateSave unconditionally stamps
    // lastPlayedAt to Date.now() itself, which would defeat the whole point
    // of seeding an old timestamp here.
    writeSave({
      ...DEFAULT_SAVE_DATA,
      currentWave: 15,
      bestWave: 15,
      gold: 0,
      towerLoadout: OFFLINE_STRONG_LOADOUT,
      lastPlayedAt: Date.now() - 8 * 60 * 60 * 1000, // full offline capacity window
    });
    const engine = new GameEngine();
    engine.startRun();

    const hud = engine.getHudSnapshot();
    expect(hud.phase).toBe("OFFLINE_RETURN");
    expect(hud.bestWave).toBeGreaterThan(15); // the simulation genuinely advanced
    expect(hud.maxBaseHp).toBe(RUN_START.baseHp); // no Castle HP auto-granted
    expect(loadSave().castleHpBonus).toBe(0);
    // At least the wave-20 milestone must be queued (bestWave rose well past it for a strong build).
    expect(hud.pendingRouletteSpinWave).toBe(20);

    // A reload before ever spinning must not lose or duplicate the queue.
    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.getHudSnapshot().pendingRouletteSpinWave).toBe(20);
  });
});
