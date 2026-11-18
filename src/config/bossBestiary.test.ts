import { describe, expect, it } from "vitest";
import { ALL_BOSSES, bossBestiaryStats, bossStars, sanitizeBossKills } from "./bossBestiary";

describe("boss bestiary", () => {
  it("stars at 1, 3 and 10 defeats", () => {
    expect([0, 1, 2, 3, 9, 10].map(bossStars)).toEqual([0, 1, 1, 2, 2, 3]);
  });
  it("lists every main and mini boss once", () => {
    const ids = ALL_BOSSES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ALL_BOSSES.some((b) => b.isMainBoss)).toBe(true);
    expect(ALL_BOSSES.some((b) => !b.isMainBoss)).toBe(true);
  });
  it("sanitizes and counts", () => {
    const id = ALL_BOSSES[0]!.id;
    const kills = sanitizeBossKills({ [id]: 3.9, nope: 4, [ALL_BOSSES[1]!.id]: -1 });
    expect(kills).toEqual({ [id]: 3 });
    expect(bossBestiaryStats(kills)).toEqual({ total: 3, met: 1, mastered: 1 });
  });
});
