import { describe, expect, it } from "vitest";
import {
  applySpecializationToSpecial,
  getSpecializationUpgradeCost,
  MAX_SPECIALIZATION_LEVEL,
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

  it("upgrade cost climbs with specialization level and returns null at MAX_SPECIALIZATION_LEVEL", () => {
    const costs = Array.from({ length: MAX_SPECIALIZATION_LEVEL }, (_, i) => getSpecializationUpgradeCost("IRONWOOD", i));
    for (let i = 1; i < costs.length; i++) expect(costs[i]!).toBeGreaterThan(costs[i - 1]!);
    expect(getSpecializationUpgradeCost("IRONWOOD", MAX_SPECIALIZATION_LEVEL)).toBeNull();
  });

  it("canUpgradeSpecialization is false with no specialization chosen, true up to the cap", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, SPECIALIZATION_UNLOCK_TOWER_LEVEL);
    expect(canUpgradeSpecialization(tower)).toBe(false);
    chooseSpecialization(tower, "IRONWOOD_EXECUTIONER");
    expect(canUpgradeSpecialization(tower)).toBe(true);
    tower.specializationLevel = MAX_SPECIALIZATION_LEVEL;
    expect(canUpgradeSpecialization(tower)).toBe(false);
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

  it("STORMCALLER_ARCANE_SURGE adds flat magic damage that scales with specialization level", () => {
    const base = getTowerSpecialAtLevel("STORMCALLER", 10);
    const lvl1 = applySpecializationToSpecial(base, "STORMCALLER_ARCANE_SURGE", 1) as { bonusFlatDamage?: number };
    const lvl5 = applySpecializationToSpecial(base, "STORMCALLER_ARCANE_SURGE", 5) as { bonusFlatDamage?: number };
    expect(lvl1.bonusFlatDamage).toBeGreaterThan(0);
    expect(lvl5.bonusFlatDamage!).toBeGreaterThan(lvl1.bonusFlatDamage!);
  });
});
