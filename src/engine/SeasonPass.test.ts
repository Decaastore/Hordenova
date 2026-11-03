import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import { claimAllFreePassLevels, claimFreePassLevel, getPassView } from "./SeasonPassService";
import { seasonClock } from "./SeasonClock";
import { freeRewardForLevel, PASS_LEVELS, PASS_XP, PASS_XP_PER_LEVEL } from "@/config/seasonPass";

const season = () => seasonClock.getCurrentSeasonWindow().seasonNumber;

describe("Season Pass", () => {
  beforeEach(() => window.localStorage.clear());

  it("playing earns pass XP: clearing waves counts and is saved with the run", () => {
    const entry = (slotId: string) => ({ slotId, type: "IRONWOOD" as const, level: 40, specializationId: null, specializationLevel: 0, equippedSkinId: null, masteryLevel: 0, equippedItemInstanceIds: [null, null, null] });
    updateSave({ currentWave: 2, gold: 0, towerLoadout: [entry("slot-1"), entry("slot-2")] as never, mapLayoutId: null });
    const engine = new GameEngine();
    engine.startRun();
    for (let i = 0; i < 6000 && (loadSave().seasonPass?.xp ?? 0) < 3; i++) engine.update(100);
    expect(loadSave().seasonPass!.xp).toBeGreaterThanOrEqual(3 * PASS_XP.WAVE_CLEARED);
    expect(loadSave().seasonPass!.seasonNumber).toBe(season());
  });

  it("free levels are claimable once reached, pay their reward once, and claim-all takes every reached level", () => {
    updateSave({ seasonPass: { seasonNumber: season(), xp: PASS_XP_PER_LEVEL * 10 + 5, claimedFree: [] }, gemShards: 0, freeGems: 0 });
    const view = getPassView();
    expect(view.level).toBe(10);
    expect(view.xpIntoLevel).toBe(5);
    expect(view.claimable).toHaveLength(10);

    expect(claimFreePassLevel(11)).toBeNull(); // not reached
    const after = claimFreePassLevel(5)!;
    expect(after.gemShards).toBe(freeRewardForLevel(5).gemShards);
    expect(claimFreePassLevel(5)).toBeNull(); // only once

    const all = claimAllFreePassLevels();
    let shards = 0;
    let gems = 0;
    for (let l = 1; l <= 10; l++) {
      shards += freeRewardForLevel(l).gemShards;
      gems += freeRewardForLevel(l).freeGems;
    }
    expect(all.gemShards).toBe(shards);
    expect(all.freeGems).toBe(gems);
    expect(getPassView().claimable).toHaveLength(0);
  });

  it("a new Season starts the pass over; the level is capped at the last tier", () => {
    updateSave({ seasonPass: { seasonNumber: season() - 1, xp: 999_999, claimedFree: [1, 2, 3] } });
    expect(getPassView().level).toBe(0);
    updateSave({ seasonPass: { seasonNumber: season(), xp: 999_999, claimedFree: [] } });
    expect(getPassView().level).toBe(PASS_LEVELS);
  });
});
