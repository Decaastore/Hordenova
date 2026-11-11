import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, bestiaryStars, bestiaryStats, reachedAchievements, sanitizeBestiaryKills, type AchievementStats } from "./achievements";

const base: AchievementStats = { totalKills: 0, bossesDefeated: 0, miniBossesDefeated: 0, riftsCleared: 0, bestWave: 0, bestRarityFound: -1, goldStarCreatures: 0, creaturesMet: 0 };

describe("bestiary and achievements", () => {
  it("stars at 10, 100 and 1000 defeats", () => {
    expect([0, 9, 10, 99, 100, 999, 1000].map(bestiaryStars)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it("nothing is unlocked from zero; milestones unlock exactly at their target", () => {
    expect(reachedAchievements(base)).toEqual([]);
    const got = reachedAchievements({ ...base, totalKills: 10_000, bestWave: 150, bestRarityFound: 4 });
    expect(got).toEqual(expect.arrayContaining(["KILLS_100", "KILLS_10K", "WAVE_50", "WAVE_150", "FIND_EPIC", "FIND_LEGENDARY"]));
    expect(got).not.toContain("WAVE_300");
  });

  it("counts the bestiary and cleans broken saves", () => {
    const kills = sanitizeBestiaryKills({ CRAWLER: 1200, RUNNER: 5.7, NOPE: 3, BRUTE: -2 });
    expect(kills).toEqual({ CRAWLER: 1200, RUNNER: 5 });
    expect(bestiaryStats(kills)).toEqual({ total: 1205, met: 2, goldStars: 1 });
  });

  it("every achievement has a reachable target", () => {
    for (const a of ACHIEVEMENTS) expect(a.progress(base)[1]).toBeGreaterThan(0);
  });
});
