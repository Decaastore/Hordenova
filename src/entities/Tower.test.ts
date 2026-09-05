import { describe, expect, it } from "vitest";
import {
  applySiegeDamage,
  canRespecSpecialization,
  chooseSpecialization,
  createTowerInstance,
  getTowerStats,
  resetTowerSurvival,
  respecSpecialization,
  tickTowerSurvivalRegen,
} from "./Tower";
import { getTowerSurvivalDefinition } from "@/config/towerSurvival";
import { TOWER_TYPES } from "@/config/towerStats";
import { getSpecializationsForTower } from "@/config/specializations";

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

/**
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — mandatory permanent
 * regression test: increasing masteryLevel must NEVER change a tower's
 * combat stats. An earlier version of getTowerStats applied a Mastery
 * bonus multiplier here; that mechanic has been removed entirely (see
 * config/towerMastery.ts's doc comment) and this test exists specifically
 * to prevent it — or anything like it — from silently coming back.
 */
describe("Tower — Mastery grants ZERO combat power (SEASON COMPETITIVA regression guard)", () => {
  it("masteryLevel = 0 and masteryLevel = N produce EXACTLY the same damage/attackSpeed/range for every tower type, at every level", () => {
    for (const type of TOWER_TYPES) {
      for (const level of [1, 15, 30]) {
        const baseline = createTowerInstance("slot-1", type, { x: 0, y: 0 }, level, null, 0, null, 0);
        for (const masteryLevel of [1, 5, 50, 500, 1_000_000]) {
          const withMastery = createTowerInstance("slot-1", type, { x: 0, y: 0 }, level, null, 0, null, masteryLevel);
          expect(getTowerStats(withMastery)).toEqual(getTowerStats(baseline));
        }
      }
    }
  });

  it("a tower's stats are unaffected by masteryLevel even while mutated in place (no other hidden power path)", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 10, null, 0, null, 0);
    const before = getTowerStats(tower);
    tower.masteryLevel = 999;
    const after = getTowerStats(tower);
    expect(after).toEqual(before);
  });
});

describe("Tower — Specialization Respec Token (CORREÇÃO DE REQUISITOS)", () => {
  it("cannot respec a tower with no specialization chosen, even with tokens available", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 10, null, 0, null, 5);
    expect(canRespecSpecialization(tower, 0)).toBe(false);
  });

  it("cannot respec without an available token", () => {
    const specId = getSpecializationsForTower("IRONWOOD")[0]!.id;
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 10, specId, 1, null, 4);
    // masteryLevel 4 earns 0 tokens (interval is 5) — nothing available.
    expect(canRespecSpecialization(tower, 0)).toBe(false);
  });

  it("respecSpecialization resets specializationId/Level to unchosen, and touches nothing else", () => {
    const specId = getSpecializationsForTower("IRONWOOD")[0]!.id;
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 12, specId, 3, null, 5);
    expect(canRespecSpecialization(tower, 0)).toBe(true);

    const levelBefore = tower.level;
    const masteryBefore = tower.masteryLevel;
    const hpBefore = tower.hp;

    respecSpecialization(tower);

    expect(tower.specializationId).toBeNull();
    expect(tower.specializationLevel).toBe(0);
    // Permanent/unrelated progression is completely untouched.
    expect(tower.level).toBe(levelBefore);
    expect(tower.masteryLevel).toBe(masteryBefore);
    expect(tower.hp).toBe(hpBefore);
  });

  it("chooseSpecialization still works normally after a respec — the player can pick a different path", () => {
    const options = getSpecializationsForTower("IRONWOOD");
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 12, options[0]!.id, 2, null, 5);
    respecSpecialization(tower);
    expect(chooseSpecialization(tower, options[1]!.id)).toBe(true);
    expect(tower.specializationId).toBe(options[1]!.id);
    expect(tower.specializationLevel).toBe(1);
  });
});
