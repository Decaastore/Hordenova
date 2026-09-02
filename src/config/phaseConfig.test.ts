import { describe, expect, it } from "vitest";
import { getMilestoneBonus, getPhaseForWave, getWaveTag, isMainBossWave, isMiniBossWaveInPhase, PHASES } from "./phaseConfig";

describe("phaseConfig", () => {
  it("assigns every wave from 1 to the last phase's endWave to some phase, in order, with no gaps", () => {
    for (let wave = 1; wave <= PHASES[PHASES.length - 1]!.endWave; wave++) {
      const phase = getPhaseForWave(wave);
      expect(wave).toBeGreaterThanOrEqual(phase.startWave);
      expect(wave).toBeLessThanOrEqual(phase.endWave);
    }
  });

  it("each phase's main boss wave is exactly its endWave", () => {
    for (const phase of PHASES) {
      expect(isMainBossWave(phase.endWave)).toBe(true);
      expect(isMainBossWave(phase.endWave - 1)).toBe(false);
    }
  });

  it("each phase's mini-boss waves fall strictly inside the phase and never collide with the main boss wave", () => {
    for (const phase of PHASES) {
      for (const miniWave of phase.miniBossWaves) {
        expect(miniWave).toBeGreaterThanOrEqual(phase.startWave);
        expect(miniWave).toBeLessThan(phase.endWave);
        expect(isMiniBossWaveInPhase(miniWave)).toBe(true);
      }
    }
  });

  it("cycles the last phase (Abyss) indefinitely past its own endWave, preserving the same rhythm", () => {
    const last = PHASES[PHASES.length - 1]!;
    const cycleLength = last.endWave - last.startWave + 1;

    const secondCycleWave = last.endWave + cycleLength;
    const phase = getPhaseForWave(secondCycleWave);
    expect(phase.id).toBe(last.id);
    expect(phase.biomeId).toBe(last.biomeId);
    expect(isMainBossWave(secondCycleWave)).toBe(true);

    const secondCycleMiniWave = last.miniBossWaves[0]! + cycleLength;
    expect(isMiniBossWaveInPhase(secondCycleMiniWave)).toBe(true);
  });

  it("wave tags (ELITE/SWARM) also shift correctly into later Abyss cycles", () => {
    const last = PHASES[PHASES.length - 1]!;
    const cycleLength = last.endWave - last.startWave + 1;
    const [taggedWave, tag] = Object.entries(last.waveTags)[0]!;
    const shiftedWave = Number(taggedWave) + cycleLength;
    expect(getWaveTag(shiftedWave)).toBe(tag);
  });

  it("milestone bonuses only apply to their exact configured wave", () => {
    expect(getMilestoneBonus(30)).toBeGreaterThan(0);
    expect(getMilestoneBonus(31)).toBe(0);
  });
});
