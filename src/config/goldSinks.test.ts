import { describe, expect, it } from "vitest";
import { GOLD_SINKS, hasUncappedGoldSink } from "./goldSinks";
import { hasUncappedGemSink } from "./gemSinks";

/**
 * FASE 6 (currency division) — Mastery is registered here as "mastery" and
 * is entirely Gold-funded now, its one-time unlock included (see
 * config/towerMastery.ts's getMasteryUnlockGoldCost) — it no longer has any
 * Gems-funded step at all, unlike Specialization, which still keeps a
 * Gems-funded path unlock/change (config/specializations.ts). Mastery's
 * per-level effect keeps growing forever with diminishing returns (see
 * towerMastery.ts's masteryEffectScale) instead of stopping at a hard cap.
 */
describe("goldSinks (Master Implementation Pass spec section 6/45, FASE 6)", () => {
  it("Mastery IS a Gold sink — unlock AND every level", () => {
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
