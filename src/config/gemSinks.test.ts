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

  // INFINITE BALANCE OVERHAUL — tower_mastery here is the one-time Gems
  // unlock only (CONVENIENCE, uncapped:false — same shape as
  // specialization_unlock). Every level after that is a Gold sink (see
  // goldSinks.ts's "mastery" entry) whose combat effect DOES grow, with
  // diminishing returns, funded entirely by Gold — never Gems. The
  // NEVER-P2W CONTRACT holds because Gems only ever buy the one-time
  // access, never a recurring power purchase.
  it("tower_mastery's Gems cost is the one-time CONVENIENCE unlock, not a recurring power purchase", () => {
    const mastery = GEM_SINKS.find((s) => s.id === "tower_mastery");
    expect(mastery).toBeDefined();
    expect(mastery!.category).toBe("CONVENIENCE");
    expect(mastery!.uncapped).toBe(false);
  });

  it("every registered Gem sink is CONVENIENCE or COSMETIC_PRESTIGE — no combat-power exception exists anymore", () => {
    for (const sink of GEM_SINKS) {
      expect(["CONVENIENCE", "COSMETIC_PRESTIGE"]).toContain(sink.category);
    }
  });
});
