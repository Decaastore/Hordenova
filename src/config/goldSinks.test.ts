import { describe, expect, it } from "vitest";
import { GOLD_SINKS, hasUncappedGoldSink } from "./goldSinks";
import { hasUncappedGemSink } from "./gemSinks";

/**
 * INFINITE BALANCE OVERHAUL — Mastery's per-LEVEL cost moved back to Gold
 * (registered here as "mastery"), mirroring Specialization's shape exactly:
 * a one-time Gems unlock (gemSinks.ts's "tower_mastery", now uncapped:false)
 * followed by an uncapped Gold track whose combat effect keeps growing
 * forever with diminishing returns (see towerMastery.ts's masteryEffectScale)
 * instead of stopping at a hard cap.
 */
describe("goldSinks (Master Implementation Pass spec section 6/45, CORREÇÃO DE REQUISITOS)", () => {
  it("Mastery IS a Gold sink — its per-level cost, not its one-time Gems unlock", () => {
    expect(GOLD_SINKS.find((s) => s.id === "mastery")?.uncapped).toBe(true);
  });

  it("hasUncappedGoldSink is true — both Specialization and Mastery are genuinely uncapped Gold sinks whose effect never stops growing", () => {
    expect(hasUncappedGoldSink()).toBe(true);
    expect(GOLD_SINKS.find((s) => s.id === "specialization")?.uncapped).toBe(true);
    expect(GOLD_SINKS.find((s) => s.id === "mastery")?.uncapped).toBe(true);
    expect(GOLD_SINKS.find((s) => s.id === "tower_level")?.uncapped).toBe(false);
  });

  it("the overall economy also still has an uncapped Gem sink (Profile Prestige)", () => {
    expect(hasUncappedGemSink()).toBe(true);
  });

  it("every sink has a unique id", () => {
    const ids = GOLD_SINKS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
