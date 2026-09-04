import { describe, expect, it } from "vitest";
import { getPrestigeTier, getPrestigeUpgradeCost } from "./prestige";

describe("prestige (Master Implementation Pass spec section 7-8 — Profile Prestige Gem sink)", () => {
  it("level 1 is genuinely accessible (a few Gems), never a wall", () => {
    expect(getPrestigeUpgradeCost(0)).toBeGreaterThan(0);
    expect(getPrestigeUpgradeCost(0)).toBeLessThan(10);
  });

  it("cost strictly increases with level (real recurring sink, not a one-time purchase)", () => {
    let previous = 0;
    for (let level = 0; level < 200; level++) {
      const cost = getPrestigeUpgradeCost(level);
      expect(cost).toBeGreaterThan(previous);
      previous = cost;
    }
  });

  it("never returns Infinity/NaN at any level a save could ever reach (spec section 47)", () => {
    for (const level of [0, 100, 5000, 50_000, 1_000_000]) {
      const cost = getPrestigeUpgradeCost(level);
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThan(0);
    }
  });

  it("tiers cycle through names every 10 levels and never wrap/break at extreme levels", () => {
    expect(getPrestigeTier(0)).toMatchObject({ tier: 0, nameKey: "INITIATE", cycle: 0 });
    expect(getPrestigeTier(9)).toMatchObject({ tier: 0, nameKey: "INITIATE", cycle: 0 });
    expect(getPrestigeTier(10)).toMatchObject({ tier: 1, nameKey: "ADEPT", cycle: 0 });
    // 10 names -> tier 10 cycles back to INITIATE, but with cycle=1 so it's distinguishable.
    expect(getPrestigeTier(100)).toMatchObject({ tier: 10, nameKey: "INITIATE", cycle: 1 });
    const extreme = getPrestigeTier(1_000_000);
    expect(Number.isFinite(extreme.tier)).toBe(true);
    expect(Number.isFinite(extreme.cycle)).toBe(true);
  });
});
