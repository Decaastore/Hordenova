import { describe, expect, it } from "vitest";
import type { MergeableCastle } from "./eternal";
import { claimableMilestones, contractsForWeek, depthOfWave, mergeCastles, milestoneReward, romanDepth, rollWeek, createEternalState, weekIndex, sanitizeEternalState } from "./eternal";

describe("Eternal mode rules", () => {
  it("a depth every 100 waves", () => {
    expect([1, 100, 101, 200, 201, 1001].map(depthOfWave)).toEqual([0, 0, 1, 1, 2, 10]);
    expect([1, 2, 4, 9, 10].map(romanDepth)).toEqual(["I", "II", "IV", "IX", "X"]);
  });

  it("milestones every 50 waves, each paid once", () => {
    expect(claimableMilestones(49, 0)).toEqual([]);
    expect(claimableMilestones(160, 0)).toEqual([1, 2, 3]);
    expect(claimableMilestones(160, 2)).toEqual([3]);
    expect(milestoneReward(3).marks).toBeGreaterThan(milestoneReward(1).marks);
  });

  it("three distinct contracts per week, the same for everyone that week, changing next week", () => {
    const a = contractsForWeek(2900);
    expect(a).toHaveLength(3);
    expect(new Set(a.map((c) => c.kind)).size).toBe(3);
    expect(contractsForWeek(2900)).toEqual(a);
    const weeks = Array.from({ length: 6 }, (_, i) => contractsForWeek(2900 + i).map((c) => c.kind).join());
    expect(new Set(weeks).size).toBeGreaterThan(1);
  });

  it("a new week clears contract progress but keeps the marks", () => {
    const now = Date.UTC(2026, 10, 11);
    const s = { ...createEternalState(now), marks: 300, progress: { x: 5 }, claimed: ["x"] };
    const next = rollWeek(s, now + 8 * 24 * 3600 * 1000);
    expect(next.week).toBe(weekIndex(now) + 1);
    expect(next.marks).toBe(300);
    expect(next.progress).toEqual({});
    expect(next.claimed).toEqual([]);
    expect(sanitizeEternalState({ marks: -5, progress: { a: 3, b: "x" } }, now).marks).toBe(0);
  });

  it("the Season castle joins the Eternal one: higher record keeps its map, best level per tower type, gold added", () => {
    const season: MergeableCastle = {
      seasonBestWave: 180,
      gold: 1000,
      castleHpBonus: 10,
      towerLoadout: [
        { slotId: "a", type: "IRONWOOD" as const, level: 40 },
        { slotId: "b", type: "INFERNO" as const, level: 12 },
      ],
      towerMasteryLevels: { IRONWOOD: 5 },
      towerManaLevels: {},
    };
    const eternal: MergeableCastle = {
      seasonBestWave: 120,
      gold: 500,
      castleHpBonus: 20,
      towerLoadout: [
        { slotId: "z", type: "INFERNO" as const, level: 30 },
        { slotId: "y", type: "FROSTBORN" as const, level: 25 },
      ],
      towerMasteryLevels: { IRONWOOD: 2, INFERNO: 4 },
      towerManaLevels: { FROSTBORN: 3 },
    };
    const merged = mergeCastles(season, eternal);
    expect(merged.seasonBestWave).toBe(180);
    expect(merged.gold).toBe(1500);
    expect(merged.castleHpBonus).toBe(20);
    expect(merged.towerLoadout.map((t) => t.slotId)).toEqual(["a", "b"]);
    expect(merged.towerLoadout.find((t) => t.type === "INFERNO")!.level).toBe(30);
    expect(merged.towerMasteryLevels).toEqual({ IRONWOOD: 5, INFERNO: 4 });
    expect(merged.towerManaLevels).toEqual({ FROSTBORN: 3 });
    expect(mergeCastles(season, null)).toEqual(season);
  });
});
