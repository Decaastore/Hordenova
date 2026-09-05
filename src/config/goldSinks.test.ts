import { describe, expect, it } from "vitest";
import { GOLD_SINKS, hasUncappedGoldSink } from "./goldSinks";
import { hasUncappedGemSink } from "./gemSinks";

/**
 * CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE) — Tower Mastery moved from
 * Gold to Gems (see gemSinks.ts's own doc comment — CORREÇÃO DE REQUISITOS
 * SEASON COMPETITIVA later removed the combat-power exception this used to
 * represent; Mastery is now an ordinary cosmetic/prestige Gems purchase).
 *
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — for a while, both remaining
 * Gold sinks (Tower Level, Specialization) were finite, so Gold ran dry once
 * a build was fully maxed. Specialization's level cap was removed (its
 * combat EFFECT still caps at the same point it always did — see
 * SPECIALIZATION_EFFECT_LEVEL_CAP), so hasUncappedGoldSink() is true again.
 */
describe("goldSinks (Master Implementation Pass spec section 6/45, CORREÇÃO DE REQUISITOS)", () => {
  it("Tower Mastery is NOT a Gold sink anymore — it moved to gemSinks.ts", () => {
    expect(GOLD_SINKS.find((s) => s.id === "tower_mastery")).toBeUndefined();
  });

  it("hasUncappedGoldSink is true — Specialization is now a genuinely uncapped Gold sink (combat effect still capped)", () => {
    expect(hasUncappedGoldSink()).toBe(true);
    expect(GOLD_SINKS.find((s) => s.id === "specialization")?.uncapped).toBe(true);
    expect(GOLD_SINKS.find((s) => s.id === "tower_level")?.uncapped).toBe(false);
  });

  it("the overall economy also still has an uncapped Gem sink (Mastery/Prestige)", () => {
    expect(hasUncappedGemSink()).toBe(true);
  });

  it("every sink has a unique id", () => {
    const ids = GOLD_SINKS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
