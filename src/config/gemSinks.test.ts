import { describe, expect, it } from "vitest";
import { GEM_SINKS, hasUncappedGemSink } from "./gemSinks";

describe("gemSinks (Master Implementation Pass spec section 7/8/46)", () => {
  it("Profile Prestige is registered as the uncapped, implemented, non-P2W sink (Gem Economy Invariant)", () => {
    const prestige = GEM_SINKS.find((s) => s.id === "profile_prestige");
    expect(prestige).toBeDefined();
    expect(prestige!.uncapped).toBe(true);
    expect(prestige!.implemented).toBe(true);
    expect(prestige!.category).toBe("COSMETIC_PRESTIGE");
  });

  it("hasUncappedGemSink is true", () => {
    expect(hasUncappedGemSink()).toBe(true);
  });

  it("inventory expansion is honestly marked not-yet-implemented, never silently claimed as a working purchase flow", () => {
    const expansion = GEM_SINKS.find((s) => s.id === "inventory_expansion");
    expect(expansion!.implemented).toBe(false);
  });

  it("every sink has a unique id", () => {
    const ids = GEM_SINKS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
