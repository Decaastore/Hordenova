import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
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

  it("a main boss that reaches the base without dying does not soft-lock BOSS_BATTLE (regression)", () => {
    // Seed a save exactly at the Wave 30 boss milestone with an empty
    // build, so the boss takes zero damage and is guaranteed to walk to
    // the base and "escape" (removed via the leak path, not isEnemyDead)
    // instead of ever dying — the exact scenario a balance simulation
    // found could permanently soft-lock BOSS_BATTLE before this was fixed.
    updateSave({ currentWave: 30, gold: 0, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().phase).toBe("BOSS_INTRO");

    let sawBossBattle = false;
    let iterations = 0;
    const maxIterations = 20_000; // 2000s simulated — the boss crossing the path takes well under 200s
    while (engine.getHudSnapshot().phase !== "PROGRESSION_STOPPED" && iterations < maxIterations) {
      if (engine.getHudSnapshot().phase === "BOSS_BATTLE") sawBossBattle = true;
      engine.update(100);
      iterations++;
    }

    expect(sawBossBattle).toBe(true);
    // Must have resolved (either fell through to more undefended waves and
    // stopped, or otherwise moved on) well within the tick budget — never
    // stuck at wave 30 in BOSS_BATTLE forever.
    expect(iterations).toBeLessThan(maxIterations);
    expect(engine.getHudSnapshot().phase).toBe("PROGRESSION_STOPPED");
    expect(engine.getHudSnapshot().wave).toBeGreaterThan(30);
  });

  it("a spawned mini-boss's ability actually fires (regression: it used to only tick the tracked main boss)", () => {
    // Wave 21 is Ancient Forest's 3rd configured mini-boss wave, and the
    // deterministic roster (wave % 6) resolves it to "gloom-jammer" —
    // the DISABLE archetype, whose effect (a jammed tower) is directly
    // observable. Before the fix, a mini-boss's ability never fired after
    // spawn because only the BOSS_BATTLE-tracked main boss was ticked.
    updateSave({ currentWave: 21, gold: 500, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD")).toBe(true);

    let sawDisabledTower = false;
    for (let i = 0; i < 4000 && !sawDisabledTower; i++) {
      engine.update(100);
      const tower = engine.getRenderSnapshot().towers[0];
      if (tower && tower.disabledRemainingMs > 0) sawDisabledTower = true;
    }

    expect(sawDisabledTower).toBe(true);
  });

  it("spawns an Elite enemy on an ELITE-tagged wave", () => {
    // Wave 18 is one of Ancient Forest's configured ELITE waves.
    updateSave({ currentWave: 18, gold: 0, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();

    let sawElite = false;
    for (let i = 0; i < 200 && !sawElite; i++) {
      engine.update(100);
      if (engine.getRenderSnapshot().enemies.some((e) => e.elite)) sawElite = true;
    }

    expect(sawElite).toBe(true);
  });

  it("the render snapshot's biome changes with the current phase", () => {
    const first = new GameEngine();
    first.startRun();
    expect(first.getRenderSnapshot().biomeId).toBe("ANCIENT_FOREST");

    window.localStorage.clear();
    updateSave({ currentWave: 31, gold: 0, towerLoadout: [] });
    const second = new GameEngine();
    second.startRun();
    expect(second.getRenderSnapshot().biomeId).toBe("VOLCANIC_WASTES");
  });

  it("discovering a new enemy type surfaces it once via HudSnapshot.pendingDiscoveryType, then clears on acknowledgement, and never repeats after reload", () => {
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().pendingDiscoveryType).toBeNull();

    engine.update(700); // enough for Wave 1's first Crawler to spawn
    expect(engine.getHudSnapshot().pendingDiscoveryType).toBe("CRAWLER");

    engine.acknowledgeDiscovery();
    expect(engine.getHudSnapshot().pendingDiscoveryType).toBeNull();

    const reloaded = new GameEngine();
    reloaded.startRun();
    reloaded.update(700);
    expect(reloaded.getHudSnapshot().pendingDiscoveryType).toBeNull();
  });
});
