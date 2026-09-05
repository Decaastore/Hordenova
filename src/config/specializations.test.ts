import { describe, expect, it } from "vitest";
import {
  applySpecializationToSpecial,
  getSpecializationUpgradeCost,
  SPECIALIZATION_EFFECT_LEVEL_CAP,
  SPECIALIZATIONS_BY_TOWER,
  SPECIALIZATION_UNLOCK_TOWER_LEVEL,
} from "./specializations";
import { getTowerSpecialAtLevel, TOWER_TYPES } from "./towerStats";
import { canChooseSpecialization, canUpgradeSpecialization, chooseSpecialization, createTowerInstance } from "@/entities/Tower";

describe("Specialization / Upgrade Slot (Progression 2.0 spec section 5/6)", () => {
  it("every tower type ships at least 3 named specialization paths", () => {
    for (const type of TOWER_TYPES) {
      expect(SPECIALIZATIONS_BY_TOWER[type].length).toBeGreaterThanOrEqual(3);
      for (const def of SPECIALIZATIONS_BY_TOWER[type]) expect(def.towerType).toBe(type);
    }
  });

  it("a tower below the unlock level cannot choose a specialization", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, SPECIALIZATION_UNLOCK_TOWER_LEVEL - 1);
    expect(canChooseSpecialization(tower)).toBe(false);
  });

  it("a tower at the unlock level CAN choose, and choosing sets specializationLevel to 1", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, SPECIALIZATION_UNLOCK_TOWER_LEVEL);
    expect(canChooseSpecialization(tower)).toBe(true);
    const applied = chooseSpecialization(tower, "IRONWOOD_EXECUTIONER");
    expect(applied).toBe(true);
    expect(tower.specializationId).toBe("IRONWOOD_EXECUTIONER");
    expect(tower.specializationLevel).toBe(1);
    expect(canChooseSpecialization(tower)).toBe(false); // permanent — no re-spec this pass
  });

  it("rejects a specialization id that belongs to a DIFFERENT tower type", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, SPECIALIZATION_UNLOCK_TOWER_LEVEL);
    const applied = chooseSpecialization(tower, "INFERNO_WILDFIRE" as never);
    expect(applied).toBe(false);
    expect(tower.specializationId).toBeNull();
  });

  // CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — the level track itself is
  // now genuinely uncapped (Gold must always have a sink); it's only the
  // combat EFFECT (exercised further below) that stops growing at
  // SPECIALIZATION_EFFECT_LEVEL_CAP. See this file's own top doc comment.
  it("upgrade cost climbs with specialization level FOREVER — never returns null, never stops growing, even far past the old cap", () => {
    const levels = [0, 1, 2, 3, 4, 5, 10, 100, 2000, 10_000, 1_000_000];
    let previous = 0;
    for (const level of levels) {
      const cost = getSpecializationUpgradeCost("IRONWOOD", level);
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThan(previous);
      previous = cost;
    }
  });

  it("canUpgradeSpecialization is false with no specialization chosen, but stays true FOREVER once chosen — no level ever caps it", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, SPECIALIZATION_UNLOCK_TOWER_LEVEL);
    expect(canUpgradeSpecialization(tower)).toBe(false);
    chooseSpecialization(tower, "IRONWOOD_EXECUTIONER");
    expect(canUpgradeSpecialization(tower)).toBe(true);
    tower.specializationLevel = SPECIALIZATION_EFFECT_LEVEL_CAP;
    expect(canUpgradeSpecialization(tower)).toBe(true);
    tower.specializationLevel = 1_000_000;
    expect(canUpgradeSpecialization(tower)).toBe(true);
  });

  it("applySpecializationToSpecial is a NO-OP (returns the same values) when no specialization is chosen — existing level-driven behavior is untouched", () => {
    const base = getTowerSpecialAtLevel("IRONWOOD", 20);
    const result = applySpecializationToSpecial(base, null, 0);
    expect(result).toEqual(base);
  });

  it("a chosen specialization actually changes combat-relevant fields beyond the level baseline", () => {
    const base = getTowerSpecialAtLevel("IRONWOOD", 10);
    if (base.type !== "IRONWOOD") throw new Error("unreachable");
    const specialized = applySpecializationToSpecial(base, "IRONWOOD_EXECUTIONER", 3);
    if (specialized.type !== "IRONWOOD") throw new Error("unreachable");
    expect(specialized.critMultiplier).toBeGreaterThan(base.critMultiplier);
    expect(specialized.bossDamageMultiplier).toBeGreaterThan(base.bossDamageMultiplier);
  });

  it("STORMCALLER_ARCANE_SURGE adds flat magic damage that scales with specialization level, up to the effect cap", () => {
    const base = getTowerSpecialAtLevel("STORMCALLER", 10);
    const lvl1 = applySpecializationToSpecial(base, "STORMCALLER_ARCANE_SURGE", 1) as { bonusFlatDamage?: number };
    const lvl5 = applySpecializationToSpecial(base, "STORMCALLER_ARCANE_SURGE", SPECIALIZATION_EFFECT_LEVEL_CAP) as { bonusFlatDamage?: number };
    expect(lvl1.bonusFlatDamage).toBeGreaterThan(0);
    expect(lvl5.bonusFlatDamage!).toBeGreaterThan(lvl1.bonusFlatDamage!);
  });

  /**
   * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — mandatory permanent
   * regression test: specializationLevel is uncapped for Gold-spending
   * purposes, but NO branch's combat effect may keep growing past
   * SPECIALIZATION_EFFECT_LEVEL_CAP ("Gold -> infinite progression ->
   * CONTROLLED power", never "-> infinite power"). This is the single most
   * important invariant of the Gold-sink fix and must never regress.
   */
  describe("Specialization combat effect has a SOFT CAP ON POWER — level can grow forever, effect cannot", () => {
    const ALL_DEFS = Object.values(SPECIALIZATIONS_BY_TOWER).flat();

    it("every specialization's effect at the cap is IDENTICAL to its effect at any level far beyond the cap", () => {
      for (const def of ALL_DEFS) {
        const base = getTowerSpecialAtLevel(def.towerType, 20);
        const atCap = applySpecializationToSpecial(base, def.id, SPECIALIZATION_EFFECT_LEVEL_CAP);
        for (const beyond of [SPECIALIZATION_EFFECT_LEVEL_CAP + 1, 100, 10_000, 1_000_000]) {
          expect(applySpecializationToSpecial(base, def.id, beyond)).toEqual(atCap);
        }
      }
    });

    it("every numeric field ever produced stays finite at extreme specialization levels — no overflow", () => {
      for (const def of ALL_DEFS) {
        const base = getTowerSpecialAtLevel(def.towerType, 20);
        const result = applySpecializationToSpecial(base, def.id, 100_000_000);
        for (const value of Object.values(result)) {
          if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
        }
      }
    });
  });
});
