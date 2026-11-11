import { describe, expect, it } from "vitest";
import { chargeAfterWave, createRiftState, MAX_RIFT_CHARGES, riftReward, riftRewardPct, sanitizeRiftState, withHordeExtra } from "./rifts";

describe("rifts", () => {
  it("a charge every 10 waves, capped", () => {
    let s = createRiftState();
    s = chargeAfterWave(s, 9);
    expect(s.charges).toBe(0);
    for (const w of [10, 20, 30, 40, 50]) s = chargeAfterWave(s, w);
    expect(s.charges).toBe(MAX_RIFT_CHARGES);
  });

  it("more curses, bigger reward", () => {
    expect(riftRewardPct([])).toBe(0);
    expect(riftRewardPct(["HASTE", "TOUGH", "HORDE", "FRAGILE"])).toBe(130);
    const light = riftReward(["HASTE"], 200);
    const heavy = riftReward(["HASTE", "TOUGH", "HORDE", "FRAGILE"], 200);
    expect(heavy.shards).toBeGreaterThan(light.shards);
    expect(heavy.gold).toBeGreaterThan(light.gold);
    expect(heavy.itemRolls).toBe(3);
    expect(light.itemRolls).toBe(1);
  });

  it("the horde curse adds half again as many enemies", () => {
    const q = Array.from({ length: 10 }, () => "CRAWLER" as const);
    expect(withHordeExtra(q)).toHaveLength(15);
  });

  it("sanitizes broken saves", () => {
    expect(sanitizeRiftState(null)).toEqual(createRiftState());
    expect(sanitizeRiftState({ charges: 99, armed: ["HASTE", "NOPE", "HASTE"], active: { wave: 12.7, mods: ["TOUGH"] } })).toEqual({
      charges: MAX_RIFT_CHARGES,
      armed: ["HASTE"],
      active: { wave: 12, mods: ["TOUGH"] },
    });
  });
});
