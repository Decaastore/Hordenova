import { describe, expect, it } from "vitest";
import {
  getBossDefinitionById,
  getMainBossForWave,
  getMiniBossForWave,
  getMiniBossIdForWave,
  MAIN_BOSSES,
  MINI_BOSSES,
} from "./bossConfig";
import { PHASES } from "./phaseConfig";

/**
 * 10-biome expansion — invariant coverage for the boss data layer (no
 * prior test file existed for bossConfig.ts at all). Confirms every new
 * phase's main/mini boss ids resolve to real definitions, and that the
 * new PhaseDefinition.miniBossId pinning mechanism actually overrides the
 * global MINI_BOSS_ROSTER rotation for its own phase without touching any
 * hand-authored phase that leaves it unset.
 */
describe("bossConfig", () => {
  it("every PhaseDefinition.mainBossId resolves to a real MAIN_BOSSES entry flagged isMainBoss", () => {
    for (const phase of PHASES) {
      const boss = MAIN_BOSSES[phase.mainBossId];
      expect(boss, `${phase.id}.mainBossId=${phase.mainBossId}`).toBeDefined();
      expect(boss!.isMainBoss).toBe(true);
    }
  });

  it("every PhaseDefinition.miniBossId (when set) resolves to a real MINI_BOSSES entry flagged !isMainBoss", () => {
    for (const phase of PHASES) {
      if (!phase.miniBossId) continue;
      const boss = MINI_BOSSES[phase.miniBossId];
      expect(boss, `${phase.id}.miniBossId=${phase.miniBossId}`).toBeDefined();
      expect(boss!.isMainBoss).toBe(false);
    }
  });

  it("the 10-biome expansion phases all pin their own mini-boss (never left to the global rotation)", () => {
    const expansionPhaseIds = [
      "DWARVEN_UNDERCITY",
      "COLOSSUS_GRAVEYARD",
      "FLOATING_ISLES",
      "LOST_SUN_TEMPLE",
      "CRYSTAL_SEA",
      "ABYSSAL_FORTRESS",
      "ASHEN_VALLEY",
      "MOON_GARDENS",
      "DEFILED_CATHEDRAL",
      "LEVIATHAN_COAST",
    ];
    for (const id of expansionPhaseIds) {
      const phase = PHASES.find((p) => p.id === id)!;
      expect(phase.miniBossId, id).toBeDefined();
    }
  });

  it("getMiniBossIdForWave returns the phase's pinned mini-boss for every mini-boss wave in a 10-biome-expansion phase", () => {
    const dwarvenPhase = PHASES.find((p) => p.id === "DWARVEN_UNDERCITY")!;
    for (const wave of dwarvenPhase.miniBossWaves) {
      expect(getMiniBossIdForWave(wave)).toBe(dwarvenPhase.miniBossId);
    }
  });

  it("getMiniBossIdForWave still falls back to the global roster rotation for a hand-authored phase that leaves miniBossId unset", () => {
    const ancientForest = PHASES.find((p) => p.id === "ANCIENT_FOREST")!;
    expect(ancientForest.miniBossId).toBeUndefined();
    for (const wave of ancientForest.miniBossWaves) {
      const id = getMiniBossIdForWave(wave);
      expect(MINI_BOSSES[id]).toBeDefined();
    }
  });

  it("getMainBossForWave / getMiniBossForWave resolve real definitions for a representative wave in every 10-biome-expansion phase", () => {
    for (const phase of PHASES) {
      if (!phase.miniBossId) continue;
      expect(getMainBossForWave(phase.endWave).id).toBe(phase.mainBossId);
      expect(getMiniBossForWave(phase.miniBossWaves[0]!).id).toBe(phase.miniBossId);
    }
  });

  it("every new main boss's hpMultiplierVsBrute is strictly greater than the previous phase's (continues the existing difficulty curve, no regression)", () => {
    let previous = 0;
    for (const phase of PHASES) {
      const boss = MAIN_BOSSES[phase.mainBossId]!;
      expect(boss.hpMultiplierVsBrute).toBeGreaterThan(previous);
      previous = boss.hpMultiplierVsBrute;
    }
  });

  it("getBossDefinitionById resolves every boss from either roster, and null for an unknown id", () => {
    for (const id of Object.keys(MAIN_BOSSES)) expect(getBossDefinitionById(id)?.id).toBe(id);
    for (const id of Object.keys(MINI_BOSSES)) expect(getBossDefinitionById(id)?.id).toBe(id);
    expect(getBossDefinitionById("not-a-real-boss")).toBeNull();
  });

  it("every boss (existing + 10-biome expansion) has a finite, positive hpMultiplierVsBrute/speed/goldReward and a valid dropTableId shape", () => {
    for (const boss of [...Object.values(MAIN_BOSSES), ...Object.values(MINI_BOSSES)]) {
      expect(Number.isFinite(boss.hpMultiplierVsBrute)).toBe(true);
      expect(boss.hpMultiplierVsBrute).toBeGreaterThan(0);
      expect(Number.isFinite(boss.speed)).toBe(true);
      expect(boss.speed).toBeGreaterThan(0);
      expect(Number.isFinite(boss.goldReward)).toBe(true);
      expect(boss.goldReward).toBeGreaterThan(0);
      expect(boss.dropTableId === null || typeof boss.dropTableId === "string").toBe(true);
    }
  });
});
