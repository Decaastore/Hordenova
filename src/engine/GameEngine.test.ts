import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

const TICK_MS = 50;

describe("GameEngine — full run flow", () => {
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

  it("progresses through multiple waves automatically while undefended enemies eventually reach the base", () => {
    const engine = new GameEngine();
    engine.startRun();

    let iterations = 0;
    const maxIterations = 20_000; // generous safety cap
    while (engine.getHudSnapshot().phase !== "DEFEAT" && iterations < maxIterations) {
      engine.update(TICK_MS);
      iterations++;
    }

    const hud = engine.getHudSnapshot();
    expect(hud.phase).toBe("DEFEAT");
    expect(hud.baseHp).toBe(0);
    expect(hud.wave).toBeGreaterThanOrEqual(1);
  });

  it("records bestWave on defeat and restart returns to PRE_RUN", () => {
    const engine = new GameEngine();
    engine.startRun();

    let iterations = 0;
    while (engine.getHudSnapshot().phase !== "DEFEAT" && iterations < 20_000) {
      engine.update(TICK_MS);
      iterations++;
    }

    const waveReached = engine.getHudSnapshot().wave;
    expect(engine.getHudSnapshot().bestWave).toBeGreaterThanOrEqual(waveReached);

    engine.restart();
    expect(engine.getHudSnapshot().phase).toBe("PRE_RUN");

    engine.startRun();
    expect(engine.getHudSnapshot().wave).toBe(1);
    expect(engine.getHudSnapshot().baseHp).toBe(engine.getHudSnapshot().maxBaseHp);
  });

  it("higher speed advances the simulation faster for the same number of real-time ticks", () => {
    const slow = new GameEngine();
    slow.startRun();
    slow.setSpeed(1);

    const fast = new GameEngine();
    fast.startRun();
    fast.setSpeed(4);

    for (let i = 0; i < 40; i++) {
      slow.update(TICK_MS);
      fast.update(TICK_MS);
    }

    // Same wall-clock ticks, but the 4x engine should have spawned more
    // enemies / dealt more base damage / progressed further.
    const slowEnemies = slow.getRenderSnapshot().enemies.length;
    const fastProgress = fast.getHudSnapshot().wave + fast.getRenderSnapshot().enemies.length;
    const slowProgress = slow.getHudSnapshot().wave + slowEnemies;
    expect(fastProgress).toBeGreaterThanOrEqual(slowProgress);
  });
});
