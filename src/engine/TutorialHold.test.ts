import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { SEASON_EPOCH_MS } from "./SeasonClock";

describe("GameEngine — first-run tutorial hold", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(SEASON_EPOCH_MS + 1000);
  });
  afterEach(() => vi.useRealTimers());

  it("while held a fresh run doesn't move: no enemy spawns, the castle takes no damage; released, the wave plays", () => {
    const engine = new GameEngine();
    engine.startRun();
    engine.setTutorialHold(true);
    for (let i = 0; i < 60; i++) engine.update(1000);
    const held = engine.getHudSnapshot();
    expect(engine.getRenderSnapshot().enemies).toHaveLength(0);
    expect(held.baseHp).toBe(held.maxBaseHp);
    expect(held.wave).toBe(1);

    engine.setTutorialHold(false);
    for (let i = 0; i < 20; i++) engine.update(500);
    expect(engine.getRenderSnapshot().enemies.length).toBeGreaterThan(0);
  });

  it("towers can still be placed while held (that is what the player is being asked to do)", () => {
    const engine = new GameEngine();
    engine.startRun();
    engine.setTutorialHold(true);
    const slot = engine.getAvailableSlotIds()[0]!;
    expect(engine.placeTower(slot, "IRONWOOD")).toBeTruthy();
    expect(engine.getHudSnapshot().towerCount).toBe(1);
  });
});
