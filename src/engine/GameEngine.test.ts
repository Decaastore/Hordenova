import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

const TICK_MS = 50;

function runUntilStopped(engine: GameEngine, maxIterations = 20_000): void {
  let iterations = 0;
  while (engine.getHudSnapshot().phase !== "PROGRESSION_STOPPED" && iterations < maxIterations) {
    engine.update(TICK_MS);
    iterations++;
  }
}

describe("GameEngine — Active Idle progression", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts Wave 1 automatically on startRun, with no button required", () => {
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().phase).toBe("RUNNING");
    expect(engine.getHudSnapshot().wave).toBe(1);
  });

  it("does nothing before startRun is called", () => {
    const engine = new GameEngine();
    engine.update(1000);
    expect(engine.getHudSnapshot().phase).toBe("PRE_RUN");
  });

  it("placing a tower spends gold and occupies the slot", () => {
    const engine = new GameEngine();
    engine.startRun();
    const startingGold = engine.getHudSnapshot().gold;
    const slotId = TOWER_SLOTS[0]!.id;

    const placed = engine.placeTower(slotId, "IRONWOOD");
    expect(placed).toBe(true);
    expect(engine.getHudSnapshot().gold).toBeLessThan(startingGold);
    expect(engine.getAvailableSlotIds()).not.toContain(slotId);

    // Can't double-place on the same slot.
    expect(engine.placeTower(slotId, "IRONWOOD")).toBe(false);
  });

  it("stops progression (not a plain defeat) when undefended enemies reach the base, with a diagnostic report attached", () => {
    const engine = new GameEngine();
    engine.startRun();

    runUntilStopped(engine);

    const hud = engine.getHudSnapshot();
    expect(hud.phase).toBe("PROGRESSION_STOPPED");
    expect(hud.baseHp).toBe(0);
    expect(hud.wave).toBeGreaterThanOrEqual(1);

    const report = engine.getFailureReport();
    expect(report).not.toBeNull();
    expect(report!.waveReached).toBe(hud.wave);
    expect(report!.reasonKeys.length).toBeGreaterThan(0);
  });

  it("records bestWave on PROGRESSION_STOPPED", () => {
    const engine = new GameEngine();
    engine.startRun();
    runUntilStopped(engine);

    const waveReached = engine.getHudSnapshot().wave;
    expect(engine.getHudSnapshot().bestWave).toBeGreaterThanOrEqual(waveReached);
  });

  it("retryPhase() retries the SAME wave (Active Idle never resets progress to Wave 1) and keeps towers/gold", () => {
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");

    runUntilStopped(engine);
    const waveThatFailed = engine.getHudSnapshot().wave;
    const towersBeforeRetry = engine.getRenderSnapshot().towers.length;

    engine.retryPhase();
    const hud = engine.getHudSnapshot();
    expect(hud.phase).toBe("RUNNING");
    expect(hud.wave).toBe(waveThatFailed);
    expect(hud.baseHp).toBe(hud.maxBaseHp);
    expect(engine.getRenderSnapshot().towers.length).toBe(towersBeforeRetry);
  });

  it("towers can be upgraded while PROGRESSION_STOPPED — the spec's build-and-strategize loop", () => {
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    runUntilStopped(engine);

    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);
    const upgraded = engine.upgradeSelectedTower();
    expect(upgraded).toBe(true);
    expect(engine.getRenderSnapshot().towers[0]!.level).toBe(2);
  });

  it("persists progress across a new engine instance (simulating a reload)", () => {
    const first = new GameEngine();
    first.startRun();
    first.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    const goldAfterBuild = first.getHudSnapshot().gold;

    const second = new GameEngine();
    second.startRun();
    expect(second.getRenderSnapshot().towers.length).toBe(1);
    expect(second.getHudSnapshot().gold).toBe(goldAfterBuild);
  });

  it("higher speed advances the simulation faster for the same number of real-time ticks", () => {
    const slow = new GameEngine();
    slow.startRun();
    slow.setSpeed(1);

    window.localStorage.clear();

    const fast = new GameEngine();
    fast.startRun();
    fast.setSpeed(4);

    for (let i = 0; i < 40; i++) {
      slow.update(TICK_MS);
      fast.update(TICK_MS);
    }

    const slowEnemies = slow.getRenderSnapshot().enemies.length;
    const fastProgress = fast.getHudSnapshot().wave + fast.getRenderSnapshot().enemies.length;
    const slowProgress = slow.getHudSnapshot().wave + slowEnemies;
    expect(fastProgress).toBeGreaterThanOrEqual(slowProgress);
  });

  it("checkpoints lastPlayedAt so Offline Defense has a reference point", () => {
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    expect(loadSave().lastPlayedAt).not.toBeNull();
  });
});
