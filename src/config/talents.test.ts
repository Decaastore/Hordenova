import { describe, expect, it } from "vitest";
import { canRaiseTalent, sanitizeTalentRanks, talentBonus, talentPointsEarned, talentPointsFree, TALENTS } from "./talents";

describe("talents", () => {
  it("one point every 10 waves of the Season record", () => {
    expect(talentPointsEarned(9)).toBe(0);
    expect(talentPointsEarned(10)).toBe(1);
    expect(talentPointsEarned(305)).toBe(30);
  });

  it("there are more ranks than a deep Season gives points", () => {
    const totalRanks = TALENTS.reduce((s, t) => s + t.maxRank, 0);
    expect(totalRanks).toBeGreaterThan(talentPointsEarned(300));
  });

  it("a talent opens only after the one before it in its path", () => {
    expect(canRaiseTalent({}, "W_HASTE", 100)).toBe(false);
    expect(canRaiseTalent({}, "W_BLADES", 100)).toBe(true);
    expect(canRaiseTalent({ W_BLADES: 1 }, "W_HASTE", 100)).toBe(true);
    expect(canRaiseTalent({ W_BLADES: 3 }, "W_BLADES", 100)).toBe(false);
    expect(canRaiseTalent({ W_BLADES: 1 }, "W_HASTE", 10)).toBe(false);
  });

  it("adds up the bonus per rank", () => {
    const b = talentBonus({ W_BLADES: 3, W_HASTE: 1, W_HUNTER: 1, W_CRIT: 1, W_CARNAGE: 1, G_LOOT: 2 });
    expect(b.damagePct).toBe(12);
    expect(b.killGoldPct).toBe(4);
  });

  it("sanitizes broken saves: limits, broken paths and too many points", () => {
    expect(sanitizeTalentRanks({ W_BLADES: 9, W_HASTE: 2, NOPE: 3 }, 1000)).toEqual({ W_BLADES: 3, W_HASTE: 2 });
    expect(sanitizeTalentRanks({ W_HASTE: 2 }, 1000)).toEqual({});
    const r = sanitizeTalentRanks({ W_BLADES: 3, W_HASTE: 3 }, 40);
    expect(talentPointsFree(r, 40)).toBe(0);
    expect(r.W_BLADES).toBe(3);
    expect(r.W_HASTE).toBe(1);
  });
});
