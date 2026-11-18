import { describe, expect, it } from "vitest";
import { PHASES } from "./phaseConfig";
import { canHuntPhase, huntStatWave, planHunt, sanitizeHuntMeta } from "./hunt";

describe("hunt (replay a beaten phase, harder)", () => {
  it("only phases already cleared by the Season castle can be hunted", () => {
    const first = PHASES[0]!;
    expect(canHuntPhase(first, first.endWave - 1)).toBe(false);
    expect(canHuntPhase(first, first.endWave)).toBe(true);
    expect(planHunt(1, PHASES[0]!.endWave, 40)).toBeNull();
  });
  it("creatures use the Season castle's current strength, never below the phase", () => {
    const run = planHunt(0, 200, 180)!;
    expect(run.startWave).toBe(PHASES[0]!.startWave);
    expect(run.endWave).toBe(PHASES[0]!.endWave);
    expect(huntStatWave(run, 5)).toBe(180);
    const low = planHunt(1, 60, 10)!;
    expect(huntStatWave(low, 33)).toBe(33);
  });
  it("sanitizes the stored meta", () => {
    const m = sanitizeHuntMeta({ wins: { [PHASES[0]!.id]: 2.5, NOPE: 3 }, active: { phaseIndex: 0, powerWave: 90, won: true } });
    expect(m.wins).toEqual({ [PHASES[0]!.id]: 2 });
    expect(m.active).toEqual({ phaseIndex: 0, startWave: 1, endWave: PHASES[0]!.endWave, powerWave: 90, won: true });
    expect(sanitizeHuntMeta("junk")).toEqual({ active: null, wins: {} });
  });
});
