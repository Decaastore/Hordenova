import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { REPOSITION_GEM_COST } from "@/config/repositioning";
import { DAY_DURATION_MS } from "./DailyClock";
import { SEASON_EPOCH_MS } from "./SeasonClock";

/**
 * BALANCEAMENTO DEFINITIVO spec section 6/13 — real-GameEngine tests for
 * Tower Repositioning: 1 free swap/move per day, resets daily (day-index,
 * not a stored boolean — see DailyClock.ts), 200 Gems after, never touches
 * Tower Level/Mastery/Specialization/ownership, survives reload/save-load.
 */
describe("Tower Repositioning (real GameEngine) — BALANCEAMENTO DEFINITIVO spec section 6/13", () => {
  const DAY0 = SEASON_EPOCH_MS + DAY_DURATION_MS * 100; // an arbitrary, stable "day 100"

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(DAY0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupTwoTowers(): GameEngine {
    updateSave({ gold: 100_000, gems: 100_000, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    engine.placeTower(TOWER_SLOTS[1]!.id, "INFERNO");
    return engine;
  }

  it("the first reposition of the day is free — no Gems spent", () => {
    const engine = setupTwoTowers();
    const gemsBefore = engine.getHudSnapshot().gems;
    expect(engine.getHudSnapshot().repositionFreeAvailable).toBe(true);
    expect(engine.getRepositionCost()).toBe(0);

    const ok = engine.repositionTower(TOWER_SLOTS[0]!.id, TOWER_SLOTS[2]!.id);
    expect(ok).toBe(true);
    expect(engine.getHudSnapshot().gems).toBe(gemsBefore);
  });

  it("moving to an EMPTY slot relocates the tower; the destination slot was empty, so nothing else changes", () => {
    const engine = setupTwoTowers();
    const before = engine.getRenderSnapshot().towers.find((t) => t.slotId === TOWER_SLOTS[0]!.id)!;
    const level = before.level;

    engine.repositionTower(TOWER_SLOTS[0]!.id, TOWER_SLOTS[2]!.id);

    const towers = engine.getRenderSnapshot().towers;
    expect(towers.find((t) => t.slotId === TOWER_SLOTS[0]!.id)).toBeUndefined();
    const moved = towers.find((t) => t.id === before.id)!;
    expect(moved.slotId).toBe(TOWER_SLOTS[2]!.id);
    expect(moved.position).toEqual(TOWER_SLOTS[2]!.position);
    // Nothing about the tower's own build changed.
    expect(moved.level).toBe(level);
    expect(moved.type).toBe(before.type);
  });

  it("moving to an OCCUPIED slot swaps both towers atomically — still just 1 change", () => {
    const engine = setupTwoTowers();
    const towerA = engine.getRenderSnapshot().towers.find((t) => t.slotId === TOWER_SLOTS[0]!.id)!;
    const towerB = engine.getRenderSnapshot().towers.find((t) => t.slotId === TOWER_SLOTS[1]!.id)!;

    const ok = engine.repositionTower(TOWER_SLOTS[0]!.id, TOWER_SLOTS[1]!.id);
    expect(ok).toBe(true);

    const towers = engine.getRenderSnapshot().towers;
    const movedA = towers.find((t) => t.id === towerA.id)!;
    const movedB = towers.find((t) => t.id === towerB.id)!;
    expect(movedA.slotId).toBe(TOWER_SLOTS[1]!.id);
    expect(movedB.slotId).toBe(TOWER_SLOTS[0]!.id);
    expect(movedA.position).toEqual(TOWER_SLOTS[1]!.position);
    expect(movedB.position).toEqual(TOWER_SLOTS[0]!.position);
    // Only 1 free-use consumed by this single swap action.
    expect(engine.getHudSnapshot().repositionFreeAvailable).toBe(false);
  });

  it("reposition NEVER touches Level, Mastery, or Specialization — swaps only slotId/position", () => {
    updateSave({ gold: 100_000, gems: 100_000, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    engine.placeTower(TOWER_SLOTS[1]!.id, "INFERNO");
    const before = engine.getRenderSnapshot().towers.map((t) => ({ ...t }));

    engine.repositionTower(TOWER_SLOTS[0]!.id, TOWER_SLOTS[1]!.id);

    const after = engine.getRenderSnapshot().towers;
    for (const prior of before) {
      const now = after.find((t) => t.id === prior.id)!;
      expect(now.level).toBe(prior.level);
      expect(now.masteryLevel).toBe(prior.masteryLevel);
      expect(now.masteryUnlocked).toBe(prior.masteryUnlocked);
      expect(now.specializationId).toBe(prior.specializationId);
      expect(now.specializationLevel).toBe(prior.specializationLevel);
      expect(now.type).toBe(prior.type);
      expect(now.id).toBe(prior.id);
    }
  });

  it("a SECOND reposition the same day costs REPOSITION_GEM_COST Gems and deducts them", () => {
    const engine = setupTwoTowers();
    engine.repositionTower(TOWER_SLOTS[0]!.id, TOWER_SLOTS[2]!.id); // consumes the free one

    expect(engine.getHudSnapshot().repositionFreeAvailable).toBe(false);
    expect(engine.getRepositionCost()).toBe(REPOSITION_GEM_COST);

    const gemsBefore = engine.getHudSnapshot().gems;
    const ok = engine.repositionTower(TOWER_SLOTS[2]!.id, TOWER_SLOTS[3]!.id);
    expect(ok).toBe(true);
    expect(engine.getHudSnapshot().gems).toBe(gemsBefore - REPOSITION_GEM_COST);
  });

  it("blocks (and spends nothing) when Gems are insufficient after the free use is spent", () => {
    updateSave({ gold: 100_000, gems: REPOSITION_GEM_COST - 1, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    engine.placeTower(TOWER_SLOTS[1]!.id, "INFERNO");
    engine.repositionTower(TOWER_SLOTS[0]!.id, TOWER_SLOTS[2]!.id); // spends the free one

    const gemsBefore = engine.getHudSnapshot().gems;
    const ok = engine.repositionTower(TOWER_SLOTS[2]!.id, TOWER_SLOTS[3]!.id);
    expect(ok).toBe(false);
    expect(engine.getHudSnapshot().gems).toBe(gemsBefore);
  });

  it("the free reposition resets the NEXT calendar day, and does not accumulate across multiple skipped days", () => {
    const engine = setupTwoTowers();
    engine.repositionTower(TOWER_SLOTS[0]!.id, TOWER_SLOTS[2]!.id);
    expect(engine.getHudSnapshot().repositionFreeAvailable).toBe(false);

    // Still the same day — still not free.
    vi.setSystemTime(DAY0 + DAY_DURATION_MS - 1);
    expect(engine.getHudSnapshot().repositionFreeAvailable).toBe(false);

    // A new day (even several days later) grants exactly ONE free use again — never more than one, however many days were skipped.
    vi.setSystemTime(DAY0 + DAY_DURATION_MS * 5);
    expect(engine.getHudSnapshot().repositionFreeAvailable).toBe(true);
    engine.repositionTower(TOWER_SLOTS[2]!.id, TOWER_SLOTS[3]!.id);
    expect(engine.getHudSnapshot().repositionFreeAvailable).toBe(false);
  });

  it("survives reload/save-load: a brand-new GameEngine instance reading the same save still sees the free use as spent for that same day", () => {
    updateSave({ gold: 100_000, gems: 100_000, towerLoadout: [] });
    const first = new GameEngine();
    first.startRun();
    first.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    first.placeTower(TOWER_SLOTS[1]!.id, "INFERNO");
    first.repositionTower(TOWER_SLOTS[0]!.id, TOWER_SLOTS[2]!.id);

    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.getHudSnapshot().repositionFreeAvailable).toBe(false);
  });

  it("rejects an unknown destination slot id, and a no-op fromSlotId===toSlotId, without spending anything", () => {
    const engine = setupTwoTowers();
    const gemsBefore = engine.getHudSnapshot().gems;

    expect(engine.repositionTower(TOWER_SLOTS[0]!.id, "not-a-real-slot")).toBe(false);
    expect(engine.repositionTower(TOWER_SLOTS[0]!.id, TOWER_SLOTS[0]!.id)).toBe(false);
    expect(engine.getHudSnapshot().repositionFreeAvailable).toBe(true);
    expect(engine.getHudSnapshot().gems).toBe(gemsBefore);
  });
});
