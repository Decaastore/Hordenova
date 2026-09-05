import { describe, expect, it } from "vitest";
import { GOLD_SINKS, hasUncappedGoldSink } from "./goldSinks";
import { hasUncappedGemSink } from "./gemSinks";

/**
 * CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE) — Tower Mastery moved from
 * Gold to Gems (see gemSinks.ts's own doc comment for the deliberate,
 * explicit exception this represents). Gold is now Season-scoped and every
 * remaining Gold sink is finite, so hasUncappedGoldSink() is correctly
 * false — the Gem economy is what carries the "always somewhere to spend"
 * invariant now.
 */
describe("goldSinks (Master Implementation Pass spec section 6/45, CORREÇÃO DE REQUISITOS)", () => {
  it("Tower Mastery is NOT a Gold sink anymore — it moved to gemSinks.ts", () => {
    expect(GOLD_SINKS.find((s) => s.id === "tower_mastery")).toBeUndefined();
  });

  it("hasUncappedGoldSink is honestly false — every remaining Gold sink (Tower Level, Specialization) is finite", () => {
    expect(hasUncappedGoldSink()).toBe(false);
  });

  it("the overall economy still has SOME uncapped sink overall — Gems carry that invariant now, not Gold", () => {
    expect(hasUncappedGemSink()).toBe(true);
  });

  it("every sink has a unique id", () => {
    const ids = GOLD_SINKS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
