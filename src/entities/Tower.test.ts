import { describe, expect, it } from "vitest";
import { applySiegeDamage, createTowerInstance, resetTowerSurvival, tickTowerSurvivalRegen } from "./Tower";
import { getTowerSurvivalDefinition } from "@/config/towerSurvival";

describe("Tower — survival (Master Implementation Pass spec section 12-13)", () => {
  it("a freshly-created tower starts at full HP/shield for its type", () => {
    const tower = createTowerInstance("slot-1", "FROSTBORN", { x: 0, y: 0 });
    const def = getTowerSurvivalDefinition("FROSTBORN");
    expect(tower.hp).toBe(def.maxHp);
    expect(tower.maxHp).toBe(def.maxHp);
    expect(tower.shieldHp).toBe(def.maxShield);
  });

  it("applySiegeDamage drains shield BEFORE touching HP (FROSTBORN)", () => {
    const tower = createTowerInstance("slot-1", "FROSTBORN", { x: 0, y: 0 });
    const def = getTowerSurvivalDefinition("FROSTBORN");
    const result = applySiegeDamage(tower, def.maxShield * 0.5, 1000);
    expect(tower.shieldHp).toBeCloseTo(def.maxShield * 0.5, 5);
    expect(tower.hp).toBe(def.maxHp); // HP untouched — shield absorbed it all
    expect(result.damageToHp).toBe(0);
    expect(result.towerJustDisabled).toBe(false);
  });

  it("applySiegeDamage overflow past the shield hits HP, reduced by armor (IRONWOOD, no shield)", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 });
    const def = getTowerSurvivalDefinition("IRONWOOD");
    const raw = 100;
    const result = applySiegeDamage(tower, raw, 1000);
    expect(result.damageToHp).toBeCloseTo(raw * (1 - def.armor), 5);
    expect(tower.hp).toBeCloseTo(def.maxHp - raw * (1 - def.armor), 5);
  });

  it("HP reaching exactly 0 disables the tower for the given duration, and never goes negative", () => {
    const tower = createTowerInstance("slot-1", "STORMCALLER", { x: 0, y: 0 });
    const def = getTowerSurvivalDefinition("STORMCALLER");
    const result = applySiegeDamage(tower, def.maxHp * 10, 2500); // massive overkill hit
    expect(tower.hp).toBe(0);
    expect(result.towerJustDisabled).toBe(true);
    expect(tower.disabledRemainingMs).toBe(2500);
  });

  it("towerJustDisabled only fires once — a second hit on an already-0-HP tower doesn't re-report it", () => {
    const tower = createTowerInstance("slot-1", "STORMCALLER", { x: 0, y: 0 });
    const def = getTowerSurvivalDefinition("STORMCALLER");
    applySiegeDamage(tower, def.maxHp * 10, 2500);
    const second = applySiegeDamage(tower, 50, 2500);
    expect(second.towerJustDisabled).toBe(false);
  });

  it("tickTowerSurvivalRegen restores HP and shield over time, never past their max", () => {
    const tower = createTowerInstance("slot-1", "FROSTBORN", { x: 0, y: 0 });
    const def = getTowerSurvivalDefinition("FROSTBORN");
    applySiegeDamage(tower, def.maxShield + def.maxHp * 0.5, 1000); // drains shield fully + some HP
    const hpAfterHit = tower.hp;

    tickTowerSurvivalRegen(tower, 1000); // 1 real second
    expect(tower.shieldHp).toBeCloseTo(def.shieldRegenPerSecond, 5);
    expect(tower.hp).toBeCloseTo(hpAfterHit + def.hpRegenPerSecond, 5);

    // Regen for a very long time never exceeds the max.
    tickTowerSurvivalRegen(tower, 999_999_000);
    expect(tower.shieldHp).toBe(def.maxShield);
    expect(tower.hp).toBe(def.maxHp);
  });

  it("resetTowerSurvival restores a damaged tower to full — the same 'fresh attempt' treatment Castle HP gets", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 });
    applySiegeDamage(tower, 99999, 1000);
    expect(tower.hp).toBe(0);
    resetTowerSurvival(tower);
    const def = getTowerSurvivalDefinition("IRONWOOD");
    expect(tower.hp).toBe(def.maxHp);
    expect(tower.shieldHp).toBe(def.maxShield);
  });
});
