import { describe, expect, it } from "vitest";
import { getSkinsForTower, getTowerSkinDefinition, TOWER_SKIN_TIER_PRICES, TOWER_SKINS } from "./towerSkins";
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

  describe("commercial tiers (HORDENOVA Season/Progression v1.0)", () => {
    it("the three approved price points exist exactly: 120 / 350 / 800 Gems", () => {
      expect(TOWER_SKIN_TIER_PRICES.ENTRY).toBe(120);
      expect(TOWER_SKIN_TIER_PRICES.INTERMEDIATE).toBe(350);
      expect(TOWER_SKIN_TIER_PRICES.PREMIUM).toBe(800);
    });

    it("every skin's gemCost matches exactly its own tier's price", () => {
      for (const skin of TOWER_SKINS) {
        expect(skin.gemCost).toBe(TOWER_SKIN_TIER_PRICES[skin.tier]);
      }
    });
  });

  describe("TOWER SKIN SYSTEM v2 — every tower gets 1 reformulated + 4 new premium skins", () => {
    it("every tower type has exactly 5 commercial skins", () => {
      for (const type of TOWER_TYPES) expect(getSkinsForTower(type).length).toBe(5);
    });

    it("every skin id is unique across the whole commercial catalog", () => {
      const ids = TOWER_SKINS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("every skin has a non-empty material/coreShape/weaponDetail/projectileStyle and a valid particleStyle", () => {
      for (const skin of TOWER_SKINS) {
        expect(skin.material.length).toBeGreaterThan(0);
        expect(skin.coreShape.length).toBeGreaterThan(0);
        expect(skin.weaponDetail.length).toBeGreaterThan(0);
        expect(skin.projectileStyle.length).toBeGreaterThan(0);
        expect(skin.particleStyle.color.length).toBeGreaterThan(0);
        expect(skin.particleStyle.behavior.length).toBeGreaterThan(0);
      }
    });

    it("no skin is a plain recolor of another skin on the same tower — coreShape and weaponDetail are unique within a tower type", () => {
      for (const type of TOWER_TYPES) {
        const skins = getSkinsForTower(type);
        expect(new Set(skins.map((s) => s.coreShape)).size).toBe(skins.length);
        expect(new Set(skins.map((s) => s.weaponDetail)).size).toBe(skins.length);
      }
    });

    it("every skin has its own cosmetic attribute, explicitly cosmetic and never a gameplay field", () => {
      for (const skin of TOWER_SKINS) {
        expect(skin.cosmeticAttribute.i18nKey.length).toBeGreaterThan(0);
        // Compile-time guarantee reinforced at runtime: cosmeticAttribute is
        // never one of the keys getTowerLevelStats/getTowerSpecialAtLevel
        // read, and this object has no `damage`/`range`/`attackSpeed` field.
        expect(skin.cosmeticAttribute).not.toHaveProperty("damage");
        expect(skin.cosmeticAttribute).not.toHaveProperty("range");
        expect(skin.cosmeticAttribute).not.toHaveProperty("attackSpeed");
      }
    });

    it("equipping any commercial skin (not just the first) never changes damage/attackSpeed/range", () => {
      for (const skin of TOWER_SKINS) {
        const tower = createTowerInstance("slot-1", skin.towerType, { x: 0, y: 0 }, skin.unlockLevel);
        const before = getTowerStats(tower);
        expect(equipSkin(tower, skin.id, OWNED([skin.id]))).toBe(true);
        const after = getTowerStats(tower);
        expect(after).toEqual(before);
      }
    });
  });
});
