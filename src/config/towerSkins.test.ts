import { describe, expect, it } from "vitest";
import { getSkinsForTower, getTowerSkinDefinition, TOWER_SKINS } from "./towerSkins";
import { TOWER_TYPES, getTowerLevelStats, getTowerSpecialAtLevel } from "./towerStats";
import { canEquipSkin, canPurchaseSkin, createTowerInstance, equipSkin, getTowerStats } from "@/entities/Tower";

const OWNED = (ids: string[]) => new Set(ids);

describe("Tower Skin architecture (Progression 2.0 spec section 10/11, CORREÇÃO DE REQUISITOS Gems-only)", () => {
  it("every tower type has at least one skin", () => {
    for (const type of TOWER_TYPES) expect(getSkinsForTower(type).length).toBeGreaterThan(0);
  });

  it("every skin has a positive Gems cost — never free, never Gold", () => {
    for (const skin of TOWER_SKINS) expect(skin.gemCost).toBeGreaterThan(0);
  });

  it("equipping an owned skin never changes damage/attackSpeed/range/special behavior", () => {
    const skin = getSkinsForTower("IRONWOOD")[0]!;
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, skin.unlockLevel);
    const statsBefore = getTowerStats(tower);
    const specialBefore = getTowerSpecialAtLevel(tower.type, tower.level);

    const applied = equipSkin(tower, skin.id, OWNED([skin.id]));
    expect(applied).toBe(true);
    expect(tower.equippedSkinId).toBe(skin.id);

    const statsAfter = getTowerStats(tower);
    const specialAfter = getTowerSpecialAtLevel(tower.type, tower.level);
    expect(statsAfter.damage).toBeCloseTo(statsBefore.damage, 5);
    expect(statsAfter.attackSpeed).toBeCloseTo(statsBefore.attackSpeed, 5);
    expect(statsAfter.range).toBeCloseTo(statsBefore.range, 5);
    // getTowerStats/getTowerSpecialAtLevel take only (type, level) — a skin
    // id is architecturally NOT one of their inputs, so this is really a
    // compile-time guarantee, but assert the runtime values agree too.
    expect(statsAfter).toEqual(getTowerLevelStats(tower.type, tower.level));
    expect(specialAfter).toEqual(specialBefore);
  });

  it("a skin cannot be equipped if not owned, even at/above its unlockLevel", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 30);
    const skin = getSkinsForTower("IRONWOOD")[0]!;
    expect(canEquipSkin(tower, skin.id, OWNED([]))).toBe(false);
    expect(equipSkin(tower, skin.id, OWNED([]))).toBe(false);
    expect(tower.equippedSkinId).toBeNull();
  });

  it("a skin cannot be purchased below its unlockLevel", () => {
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 1);
    const skin = getSkinsForTower("IRONWOOD")[0]!;
    expect(skin.unlockLevel).toBeGreaterThan(1);
    expect(canPurchaseSkin(tower, skin.id, OWNED([]))).toBe(false);
  });

  it("a skin cannot be purchased twice (already owned)", () => {
    const skin = getSkinsForTower("IRONWOOD")[0]!;
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, skin.unlockLevel);
    expect(canPurchaseSkin(tower, skin.id, OWNED([skin.id]))).toBe(false);
  });

  it("a skin cannot be equipped on the WRONG tower type even if owned", () => {
    const ironwoodTower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 30);
    const infernoSkin = getSkinsForTower("INFERNO")[0]!;
    expect(equipSkin(ironwoodTower, infernoSkin.id, OWNED([infernoSkin.id]))).toBe(false);
  });

  it("passing null clears back to the default look, always succeeding", () => {
    const skin = getSkinsForTower("IRONWOOD")[0]!;
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 30);
    equipSkin(tower, skin.id, OWNED([skin.id]));
    expect(tower.equippedSkinId).not.toBeNull();
    expect(equipSkin(tower, null, OWNED([skin.id]))).toBe(true);
    expect(tower.equippedSkinId).toBeNull();
  });

  it("an owned skin stays equippable even after the tower's level resets to 0 (Season reset)", () => {
    const skin = getSkinsForTower("IRONWOOD")[0]!;
    const resetTower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 1);
    expect(canEquipSkin(resetTower, skin.id, OWNED([skin.id]))).toBe(true);
    expect(equipSkin(resetTower, skin.id, OWNED([skin.id]))).toBe(true);
  });

  it("getTowerSkinDefinition returns null for an unknown id, never throws", () => {
    expect(getTowerSkinDefinition("not-a-real-skin")).toBeNull();
  });

  it("every skin's paletteOverride only touches the 4 cosmetic theme fields", () => {
    for (const skin of TOWER_SKINS) {
      const keys = Object.keys(skin.paletteOverride);
      for (const key of keys) expect(["primary", "secondary", "accent", "glow"]).toContain(key);
    }
  });
});
