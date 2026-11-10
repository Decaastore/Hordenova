import { describe, expect, it } from "vitest";
import {
  adaptAfterWave,
  ADAPTATION_MAX_RESIST,
  ADAPTATION_START_WAVE,
  createHordeAdaptation,
  multipliersFromShares,
  sanitizeHordeAdaptation,
  strongestResistance,
  weakness,
} from "./hordeAdaptation";

describe("A Horda que aprende", () => {
  it("a balanced defense is never penalised", () => {
    const m = multipliersFromShares({ IRONWOOD: 25, INFERNO: 25, FROSTBORN: 25, STORMCALLER: 25 });
    expect(Object.values(m).every((v) => v === 1)).toBe(true);
  });

  it("leaning on one element makes the horde resist it and grow weak to the least used one", () => {
    const m = multipliersFromShares({ IRONWOOD: 70, INFERNO: 15, FROSTBORN: 10, STORMCALLER: 5 });
    expect(m.IRONWOOD).toBeLessThan(1);
    expect(m.STORMCALLER).toBeGreaterThan(1);
    expect(m.INFERNO).toBe(1);
    expect(m.FROSTBORN).toBe(1);
  });

  it("resistance is capped, so no element ever stops working", () => {
    const m = multipliersFromShares({ IRONWOOD: 100, INFERNO: 0, FROSTBORN: 0, STORMCALLER: 0 });
    expect(m.IRONWOOD).toBeCloseTo(1 - ADAPTATION_MAX_RESIST);
  });

  it("stays plain before the start wave, then adapts gradually and forgets when the defense changes", () => {
    let a = createHordeAdaptation();
    const fire = { IRONWOOD: 0, INFERNO: 100, FROSTBORN: 0, STORMCALLER: 0 };
    a = adaptAfterWave(a, fire, ADAPTATION_START_WAVE - 5);
    expect(strongestResistance(a)).toBeNull();
    a = adaptAfterWave(a, fire, ADAPTATION_START_WAVE);
    expect(strongestResistance(a)?.type).toBe("INFERNO");
    const ice = { IRONWOOD: 0, INFERNO: 0, FROSTBORN: 100, STORMCALLER: 0 };
    for (let w = 0; w < 12; w++) a = adaptAfterWave(a, ice, ADAPTATION_START_WAVE + 1 + w);
    expect(strongestResistance(a)?.type).toBe("FROSTBORN");
    expect(weakness(a)).not.toBeNull();
  });

  it("an empty wave changes nothing, and garbage saves heal to a plain horde", () => {
    const a = createHordeAdaptation();
    expect(adaptAfterWave(a, { IRONWOOD: 0, INFERNO: 0, FROSTBORN: 0, STORMCALLER: 0 }, 50)).toBe(a);
    expect(sanitizeHordeAdaptation({ memory: { IRONWOOD: "x" }, multipliers: null }).multipliers.IRONWOOD).toBe(1);
  });
});
