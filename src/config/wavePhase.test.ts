import { describe, expect, it } from "vitest";
import { isPhaseClosingWave, phaseEndWave, phaseNumberFromWave, phaseStartWave, waveInPhase, WAVES_PER_PHASE } from "./wavePhase";

describe("Fase/Onda display layer (config/wavePhase.ts) — unrelated to config/phaseConfig.ts's biome PhaseDefinition", () => {
  it("WAVES_PER_PHASE is exactly 10", () => {
    expect(WAVES_PER_PHASE).toBe(10);
  });

  const cases: readonly [number, number, number][] = [
    [1, 1, 1],
    [2, 1, 2],
    [10, 1, 10],
    [11, 2, 1],
    [20, 2, 10],
    [21, 3, 1],
    [991, 100, 1],
    [992, 100, 2],
    [993, 100, 3],
    [1000, 100, 10],
    [1001, 101, 1],
    [1002, 101, 2],
    [1010, 101, 10],
  ];

  it.each(cases)("globalWave %i -> Fase %i / Onda %i", (globalWave, expectedPhase, expectedOnda) => {
    expect(phaseNumberFromWave(globalWave)).toBe(expectedPhase);
    expect(waveInPhase(globalWave)).toBe(expectedOnda);
  });

  it("every Fase always spans exactly onda 1..10 — phaseStartWave/phaseEndWave round-trip for a wide range of phases", () => {
    for (const phase of [1, 2, 3, 99, 100, 101, 102, 5000]) {
      const start = phaseStartWave(phase);
      const end = phaseEndWave(phase);
      expect(end - start + 1).toBe(WAVES_PER_PHASE);
      expect(phaseNumberFromWave(start)).toBe(phase);
      expect(phaseNumberFromWave(end)).toBe(phase);
      expect(waveInPhase(start)).toBe(1);
      expect(waveInPhase(end)).toBe(WAVES_PER_PHASE);
      // Every onda in between round-trips too.
      for (let onda = 1; onda <= WAVES_PER_PHASE; onda++) {
        const globalWave = start + onda - 1;
        expect(phaseNumberFromWave(globalWave)).toBe(phase);
        expect(waveInPhase(globalWave)).toBe(onda);
      }
    }
  });

  it("consecutive phases tile perfectly — phase N's endWave + 1 is phase N+1's startWave, no gap or overlap", () => {
    for (const phase of [1, 2, 99, 100, 101]) {
      expect(phaseEndWave(phase) + 1).toBe(phaseStartWave(phase + 1));
    }
  });

  it("waveInPhase is always in [1, WAVES_PER_PHASE], never 0, for the first 500 waves", () => {
    for (let wave = 1; wave <= 500; wave++) {
      const onda = waveInPhase(wave);
      expect(onda).toBeGreaterThanOrEqual(1);
      expect(onda).toBeLessThanOrEqual(WAVES_PER_PHASE);
    }
  });

  it("isPhaseClosingWave is true only on onda 10 of each fase", () => {
    expect(isPhaseClosingWave(10)).toBe(true);
    expect(isPhaseClosingWave(1000)).toBe(true);
    expect(isPhaseClosingWave(1010)).toBe(true);
    expect(isPhaseClosingWave(9)).toBe(false);
    expect(isPhaseClosingWave(1001)).toBe(false);
  });

  it("this display layer never touches the real global wave used by every other formula — it's a pure, side-effect-free re-expression", () => {
    // phaseNumberFromWave/waveInPhase never mutate anything and always invert cleanly.
    const globalWave = 12345;
    const phase = phaseNumberFromWave(globalWave);
    const onda = waveInPhase(globalWave);
    expect(phaseStartWave(phase) + onda - 1).toBe(globalWave);
  });
});
