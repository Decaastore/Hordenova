import { describe, expect, it } from "vitest";
import { ENRAGE_SHIELD_DAMAGE_REDUCTION, getEnragedShieldReduction } from "./enrageShield";

describe("Enrage Shield — getEnragedShieldReduction (SHIELD DURANTE O MODO ENFURECIDO)", () => {
  it("returns 0 for a normal (non-boss) enemy, enraged flag or not", () => {
    expect(getEnragedShieldReduction(false, false, false)).toBe(0);
    expect(getEnragedShieldReduction(false, false, true)).toBe(0);
  });

  it("returns 0 for a Boss that is NOT Enraged", () => {
    expect(getEnragedShieldReduction(true, true, false)).toBe(0);
  });

  it("returns 0 for a Mini-Boss that is NOT Enraged", () => {
    expect(getEnragedShieldReduction(true, false, false)).toBe(0);
  });

  it("returns exactly 0.30 for an Enraged main Boss", () => {
    expect(getEnragedShieldReduction(true, true, true)).toBe(0.3);
    expect(getEnragedShieldReduction(true, true, true)).toBe(ENRAGE_SHIELD_DAMAGE_REDUCTION.MAIN_BOSS);
  });

  it("returns exactly 0.20 for an Enraged Mini-Boss", () => {
    expect(getEnragedShieldReduction(true, false, true)).toBe(0.2);
    expect(getEnragedShieldReduction(true, false, true)).toBe(ENRAGE_SHIELD_DAMAGE_REDUCTION.MINI_BOSS);
  });
});
