import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import { MISSION_POOL, MISSION_REWARD_SHARDS, MISSIONS_PER_DAY, missionsForDay } from "@/config/dailyMissions";
import { DAY_DURATION_MS, getCurrentDayIndex } from "./DailyClock";

const entry = (slotId: string, level: number) => ({ slotId, type: "IRONWOOD" as const, level, specializationId: null, specializationLevel: 0, equippedSkinId: null, masteryLevel: 0, equippedItemInstanceIds: [null, null, null] });

/** A day whose missions include `kind`. */
function dayWith(kind: string): number {
  const today = getCurrentDayIndex();
  for (let d = today; d < today + 60; d++) if (missionsForDay(d).some((m) => m.kind === kind)) return d;
  throw new Error("no day found");
}

describe("daily missions", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("three distinct missions a day, the same for everyone on that day, and they change between days", () => {
    const day = getCurrentDayIndex();
    const a = missionsForDay(day);
    expect(a).toHaveLength(MISSIONS_PER_DAY);
    expect(new Set(a.map((m) => m.kind)).size).toBe(MISSIONS_PER_DAY);
    expect(missionsForDay(day)).toEqual(a);
    const seen = new Set<string>();
    for (let d = day; d < day + 30; d++) for (const m of missionsForDay(d)) seen.add(m.kind);
    expect(seen.size).toBe(MISSION_POOL.length);
  });

  it("killing enemies counts toward the kill mission; a finished mission pays Shards and Gold once; progress survives a reload", () => {
    const day = dayWith("KILL_ENEMIES");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + (day - getCurrentDayIndex()) * DAY_DURATION_MS));
    updateSave({ currentWave: 5, gold: 0, towerLoadout: [entry("slot-1", 40), entry("slot-2", 40)] as never, mapLayoutId: null });
    const engine = new GameEngine();
    engine.startRun();
    const index = engine.getDailyMissions().findIndex((m) => m.kind === "KILL_ENEMIES");
    for (let i = 0; i < 4000 && engine.getDailyMissions()[index]!.progress < 20; i++) engine.update(100);
    const progress = engine.getDailyMissions()[index]!.progress;
    expect(progress).toBeGreaterThanOrEqual(20);
    expect(engine.claimDailyMission(index)).toBe(false); // not finished yet

    // reload keeps the progress (it's saved with the run)
    (engine as unknown as { persist: () => void }).persist();
    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.getDailyMissions()[index]!.progress).toBe(progress);

    // finish it and claim
    const internals = reloaded as unknown as { trackMission: (k: string, n: number) => void };
    internals.trackMission("KILL_ENEMIES", 10_000);
    const before = reloaded.getHudSnapshot();
    expect(before.missionsClaimable).toBeGreaterThanOrEqual(1);
    expect(reloaded.claimDailyMission(index)).toBe(true);
    const after = reloaded.getHudSnapshot();
    expect(after.gemShards).toBe(before.gemShards + MISSION_REWARD_SHARDS);
    expect(after.gold).toBe(before.gold + reloaded.getDailyMissions()[index]!.rewardGold);
    expect(reloaded.claimDailyMission(index)).toBe(false);
    expect(loadSave().dailyMissions!.claimed[index]).toBe(true);
  });

  it("a new day brings fresh missions with no leftover progress", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const engine = new GameEngine();
    const internals = engine as unknown as { trackMission: (k: string, n: number) => void };
    for (const m of MISSION_POOL) internals.trackMission(m.kind, 5);
    expect(engine.getDailyMissions().every((m) => m.progress > 0)).toBe(true);
    vi.setSystemTime(new Date(Date.now() + DAY_DURATION_MS));
    expect(engine.getDailyMissions().every((m) => m.progress === 0 && !m.claimed)).toBe(true);
  });
});
