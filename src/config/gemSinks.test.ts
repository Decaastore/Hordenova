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

  // CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — the NEVER-P2W CONTRACT
  // used to carry one deliberate exception (tower_mastery, because Mastery
  // used to grant a real damage/attack-speed/range multiplier). Mastery no
  // longer grants any combat stat (see config/towerMastery.ts), so the
  // exception category was removed entirely — every sink must now be an
  // ordinary CONVENIENCE or COSMETIC_PRESTIGE purchase, with no exceptions.
  it("tower_mastery is an ordinary COSMETIC_PRESTIGE sink — the old COMBAT_POWER_MASTERY_EXCEPTION category no longer exists", () => {
    const mastery = GEM_SINKS.find((s) => s.id === "tower_mastery");
    expect(mastery).toBeDefined();
    expect(mastery!.category).toBe("COSMETIC_PRESTIGE");
  });

  it("every registered Gem sink is CONVENIENCE or COSMETIC_PRESTIGE — no combat-power exception exists anymore", () => {
    for (const sink of GEM_SINKS) {
      expect(["CONVENIENCE", "COSMETIC_PRESTIGE"]).toContain(sink.category);
    }
  });
});
