import { describe, expect, it } from "vitest";
import {
  getEndgameBossHpMultiplierBonus,
  getEndgameCycleLapCount,
  getMilestoneBonus,
  getPhaseForWave,
  getWaveTag,
  isMainBossWave,
  isMiniBossWaveInPhase,
  PHASES,
} from "./phaseConfig";

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

  /**
   * CORREÇÃO DE REQUISITOS (BOSS STALL FIX) — past wave 130, the game no
   * longer tiles ONLY the last phase (Abyss/abyssal-maw, the single hardest
   * boss) forever — it rotates through every main boss instead, one
   * 20-wave block each. This is the confirmed fix for the real permanent
   * wall found around wave ~270-300 (see phaseConfig.ts's own doc comment).
   */
  it("post-130 endgame rotates through EVERY main boss, in phase order, one 20-wave block each — never just the last phase forever", () => {
    const last = PHASES[PHASES.length - 1]!;
    const endgameStart = last.endWave + 1;

    for (let i = 0; i < PHASES.length; i++) {
      const blockStart = endgameStart + i * 20;
      const phase = getPhaseForWave(blockStart);
      expect(phase.mainBossId).toBe(PHASES[i]!.mainBossId);
      expect(phase.startWave).toBe(blockStart);
      expect(phase.endWave).toBe(blockStart + 19);
      expect(isMainBossWave(blockStart + 19)).toBe(true);
    }

    // A full lap later, the rotation is back at the FIRST phase's boss —
    // proof it's a genuine rotation, not another single-phase tiling.
    const oneLapLater = endgameStart + PHASES.length * 20;
    expect(getPhaseForWave(oneLapLater).mainBossId).toBe(PHASES[0]!.mainBossId);

    // The exact real-world stall point from the diagnosis (wave ~270-300)
    // must NOT be abyssal-maw anymore.
    expect(getPhaseForWave(280).mainBossId).not.toBe(last.mainBossId);
  });

  it("every endgame block keeps the same mini-boss (+7/+14) and wave-tag (+11 SWARM/+17 ELITE) rhythm every hand-authored 20-wave phase already uses", () => {
    const last = PHASES[PHASES.length - 1]!;
    const blockStart = last.endWave + 1;
    const phase = getPhaseForWave(blockStart);
    expect(phase.miniBossWaves).toEqual([blockStart + 7, blockStart + 14]);
    expect(getWaveTag(blockStart + 11)).toBe("SWARM");
    expect(getWaveTag(blockStart + 17)).toBe("ELITE");
  });

  it("getEndgameCycleLapCount is 0 for every hand-authored wave and the entire first rotation lap, then increases every full lap after that", () => {
    const last = PHASES[PHASES.length - 1]!;
    const endgameStart = last.endWave + 1;
    expect(getEndgameCycleLapCount(last.endWave)).toBe(0);
    expect(getEndgameCycleLapCount(endgameStart)).toBe(0);
    const oneLapLater = endgameStart + PHASES.length * 20;
    expect(getEndgameCycleLapCount(oneLapLater)).toBe(1);
    const twoLapsLater = endgameStart + PHASES.length * 20 * 2;
    expect(getEndgameCycleLapCount(twoLapsLater)).toBe(2);
  });

  it("getEndgameBossHpMultiplierBonus is exactly 1 before the endgame rotation, grows slowly across laps, and never overflows even at an absurd wave number", () => {
    const last = PHASES[PHASES.length - 1]!;
    const endgameStart = last.endWave + 1;
    expect(getEndgameBossHpMultiplierBonus(1)).toBe(1);
    expect(getEndgameBossHpMultiplierBonus(last.endWave)).toBe(1);
    expect(getEndgameBossHpMultiplierBonus(endgameStart)).toBe(1); // first lap — no bonus yet

    let previous = 1;
    for (const laps of [1, 2, 5, 20]) {
      const wave = endgameStart + laps * PHASES.length * 20;
      const bonus = getEndgameBossHpMultiplierBonus(wave);
      expect(bonus).toBeGreaterThan(previous);
      previous = bonus;
    }

    const absurdWave = endgameStart + 1_000_000 * PHASES.length * 20;
    expect(Number.isFinite(getEndgameBossHpMultiplierBonus(absurdWave))).toBe(true);
  });

  it("milestone bonuses only apply to their exact configured wave", () => {
    expect(getMilestoneBonus(30)).toBeGreaterThan(0);
    expect(getMilestoneBonus(31)).toBe(0);
  });
});
