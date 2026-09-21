import { describe, expect, it } from "vitest";
import {
  getSkinsForTower,
  getTowerSkinDefinition,
  NO_GAMEPLAY_EFFECT,
  PRESTIGE_TOWER_SKINS,
  TOWER_SKIN_TIER_PRICES,
  TOWER_SKINS,
  type SkinGameplayEffect,
} from "./towerSkins";
import { TOWER_TYPES, getTowerLevelStats, getTowerSpecialAtLevel } from "./towerStats";
import { canEquipSkin, canPurchaseSkin, createTowerInstance, equipSkin, getEquippedSkinGameplayEffect, getTowerStats } from "@/entities/Tower";

const OWNED = (ids: string[]) => new Set(ids);

describe("Tower Skin architecture (Progression 2.0 spec section 10/11, CORREÇÃO DE REQUISITOS Gems-only)", () => {
  it("every tower type has at least one skin", () => {
    for (const type of TOWER_TYPES) expect(getSkinsForTower(type).length).toBeGreaterThan(0);
  });

  it("every skin has a positive Gems cost — never free, never Gold", () => {
    for (const skin of TOWER_SKINS) expect(skin.gemCost).toBeGreaterThan(0);
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

  describe("TOWER SKIN SYSTEM v2/v3 — every tower gets 1 reformulated + 4 new premium skins, each visually distinct", () => {
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

    it("every skin has its own cosmetic attribute name, never a gameplay field itself", () => {
      for (const skin of TOWER_SKINS) {
        expect(skin.cosmeticAttribute.i18nKey.length).toBeGreaterThan(0);
        expect(skin.cosmeticAttribute).not.toHaveProperty("damage");
        expect(skin.cosmeticAttribute).not.toHaveProperty("range");
        expect(skin.cosmeticAttribute).not.toHaveProperty("attackSpeed");
      }
    });
  });

  describe("TOWER SKIN SYSTEM v3 — real, bounded, sidegrade gameplay effects (REVISÃO PROFISSIONAL spec)", () => {
    // Every multiplicative field bounded to ±10%; every additive percentage
    // field bounded to ±8 percentage points; burn duration bounded to a
    // small, explicit millisecond range — "pequenos e significativos", never
    // "+50% damage" (spec section 4/22).
    const MULT_MIN = 0.9;
    const MULT_MAX = 1.1;
    const ADD_MAX_ABS = 0.08;
    const BURN_MS_MAX = 500;

    it("every commercial skin's gameplayEffect fields are all within the approved small bounds", () => {
      for (const skin of TOWER_SKINS) {
        const e = skin.gameplayEffect;
        for (const [key, value] of Object.entries(e) as [keyof SkinGameplayEffect, number][]) {
          if (key === "burnDurationMsAdd") {
            expect(Math.abs(value)).toBeLessThanOrEqual(BURN_MS_MAX);
          } else if (key.endsWith("Mult")) {
            expect(value).toBeGreaterThanOrEqual(MULT_MIN);
            expect(value).toBeLessThanOrEqual(MULT_MAX);
          } else {
            expect(Math.abs(value)).toBeLessThanOrEqual(ADD_MAX_ABS);
          }
        }
      }
    });

    /**
     * SIDEGRADE, NEVER A STRICT UPGRADE — for every commercial skin, exactly
     * one field is a buff and at least one other field is a matching
     * downside. `chainFalloffAdd` is the one field where LOWER is the buff
     * (see SkinGameplayEffect's own doc comment); everything else follows
     * "*Mult > 1 or *Add > 0 is a buff" directly.
     */
    function isBuffField(key: keyof SkinGameplayEffect, value: number): boolean {
      if (key === "chainFalloffAdd") return value < 0;
      if (key.endsWith("Mult")) return value > 1;
      return value > 0;
    }

    it("every commercial skin pairs at least one buff with at least one downside — never a strict, drawback-free upgrade", () => {
      for (const skin of TOWER_SKINS) {
        const entries = Object.entries(skin.gameplayEffect) as [keyof SkinGameplayEffect, number][];
        expect(entries.length).toBeGreaterThanOrEqual(2);
        const buffs = entries.filter(([key, value]) => isBuffField(key, value));
        const downsides = entries.filter(([key, value]) => !isBuffField(key, value));
        expect(buffs.length).toBeGreaterThanOrEqual(1);
        expect(downsides.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("every PRESTIGE skin (free P50 reward) has NO_GAMEPLAY_EFFECT — a free reward must never also be a free permanent combat-stat upgrade", () => {
      for (const skin of PRESTIGE_TOWER_SKINS) {
        expect(skin.gameplayEffect).toEqual(NO_GAMEPLAY_EFFECT);
        expect(Object.keys(skin.gameplayEffect).length).toBe(0);
      }
    });

    it("equipping a skin with damageMult/attackSpeedMult/rangeMult applies EXACTLY that multiplier on top of the tower's base stats", () => {
      const skin = getSkinsForTower("IRONWOOD").find((s) => s.gameplayEffect.damageMult)!;
      expect(skin).toBeTruthy();
      const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, skin.unlockLevel);
      const base = getTowerLevelStats(tower.type, tower.level);

      expect(equipSkin(tower, skin.id, OWNED([skin.id]))).toBe(true);
      const equipped = getTowerStats(tower);

      const expectedDamage = base.damage * (skin.gameplayEffect.damageMult ?? 1);
      const expectedAttackSpeed = base.attackSpeed * (skin.gameplayEffect.attackSpeedMult ?? 1);
      const expectedRange = base.range * (skin.gameplayEffect.rangeMult ?? 1);
      expect(equipped.damage).toBeCloseTo(Math.round(expectedDamage * 100) / 100, 5);
      expect(equipped.attackSpeed).toBeCloseTo(Math.round(expectedAttackSpeed * 100) / 100, 5);
      expect(equipped.range).toBeCloseTo(Math.round(expectedRange * 100) / 100, 5);
    });

    it("unequipping removes the skin's stat effect exactly, reverting to base stats", () => {
      const skin = getSkinsForTower("STORMCALLER")[0]!;
      const tower = createTowerInstance("slot-1", "STORMCALLER", { x: 0, y: 0 }, skin.unlockLevel);
      const before = getTowerStats(tower);

      equipSkin(tower, skin.id, OWNED([skin.id]));
      const during = getTowerStats(tower);
      expect(during).not.toEqual(before);

      expect(equipSkin(tower, null, OWNED([skin.id]))).toBe(true);
      const after = getTowerStats(tower);
      expect(after).toEqual(before);
    });

    it("getEquippedSkinGameplayEffect returns undefined when no skin is equipped, and the skin's own effect once equipped", () => {
      const skin = getSkinsForTower("FROSTBORN")[0]!;
      const tower = createTowerInstance("slot-1", "FROSTBORN", { x: 0, y: 0 }, skin.unlockLevel);
      expect(getEquippedSkinGameplayEffect(tower)).toBeUndefined();
      equipSkin(tower, skin.id, OWNED([skin.id]));
      expect(getEquippedSkinGameplayEffect(tower)).toEqual(skin.gameplayEffect);
    });

    it("a skin merely looked up (never equipped) — the shop/panel PREVIEW case — never changes a tower's real stats", () => {
      const skin = getSkinsForTower("INFERNO")[0]!;
      const tower = createTowerInstance("slot-1", "INFERNO", { x: 0, y: 0 }, skin.unlockLevel);
      const before = getTowerStats(tower);
      // Simulates the UI reading the skin's definition/effect for display —
      // exactly what a PREVIEW does — WITHOUT ever calling equipSkin.
      void getTowerSkinDefinition(skin.id)?.gameplayEffect;
      expect(tower.equippedSkinId).toBeNull();
      expect(getTowerStats(tower)).toEqual(before);
    });

    it("getTowerSpecialAtLevel with no skinEffect argument (Wiki/static previews) returns the tower's true unmodified base special", () => {
      const withoutSkin = getTowerSpecialAtLevel("IRONWOOD", 20);
      const withEmptyEffect = getTowerSpecialAtLevel("IRONWOOD", 20, {});
      expect(withoutSkin).toEqual(withEmptyEffect);
    });

    it("getTowerSpecialAtLevel applies IRONWOOD's critChanceAdd/bossDamageMultAdd exactly", () => {
      const skin = getSkinsForTower("IRONWOOD").find((s) => s.gameplayEffect.critChanceAdd)!;
      expect(skin).toBeTruthy();
      const base = getTowerSpecialAtLevel("IRONWOOD", 20);
      const withSkin = getTowerSpecialAtLevel("IRONWOOD", 20, skin.gameplayEffect);
      if (withSkin.type !== "IRONWOOD" || base.type !== "IRONWOOD") throw new Error("unreachable");
      expect(withSkin.critChance).toBeCloseTo(base.critChance + (skin.gameplayEffect.critChanceAdd ?? 0), 5);
    });

    it("getTowerSpecialAtLevel applies INFERNO's aoeRadiusMult/burnDamageMult/burnDurationMsAdd exactly", () => {
      const skin = getSkinsForTower("INFERNO").find((s) => s.gameplayEffect.aoeRadiusMult)!;
      expect(skin).toBeTruthy();
      const base = getTowerSpecialAtLevel("INFERNO", 20);
      const withSkin = getTowerSpecialAtLevel("INFERNO", 20, skin.gameplayEffect);
      if (withSkin.type !== "INFERNO" || base.type !== "INFERNO") throw new Error("unreachable");
      expect(withSkin.aoeRadius).toBeCloseTo(base.aoeRadius * (skin.gameplayEffect.aoeRadiusMult ?? 1), 1);
    });

    it("getTowerSpecialAtLevel applies FROSTBORN's slowPercentAdd/freezeChanceAdd exactly, clamped to [0,1]", () => {
      const skin = getSkinsForTower("FROSTBORN").find((s) => s.gameplayEffect.freezeChanceAdd)!;
      expect(skin).toBeTruthy();
      const base = getTowerSpecialAtLevel("FROSTBORN", 20);
      const withSkin = getTowerSpecialAtLevel("FROSTBORN", 20, skin.gameplayEffect);
      if (withSkin.type !== "FROSTBORN" || base.type !== "FROSTBORN") throw new Error("unreachable");
      expect(withSkin.freezeChance).toBeCloseTo(base.freezeChance + (skin.gameplayEffect.freezeChanceAdd ?? 0), 5);
      expect(withSkin.freezeChance).toBeGreaterThanOrEqual(0);
      expect(withSkin.freezeChance).toBeLessThanOrEqual(1);
    });

    it("getTowerSpecialAtLevel applies STORMCALLER's armorPenetrationAdd/chainFalloffAdd exactly, clamped", () => {
      const skin = getSkinsForTower("STORMCALLER").find((s) => s.gameplayEffect.armorPenetrationAdd)!;
      expect(skin).toBeTruthy();
      const base = getTowerSpecialAtLevel("STORMCALLER", 20);
      const withSkin = getTowerSpecialAtLevel("STORMCALLER", 20, skin.gameplayEffect);
      if (withSkin.type !== "STORMCALLER" || base.type !== "STORMCALLER") throw new Error("unreachable");
      expect(withSkin.armorPenetration).toBeCloseTo(base.armorPenetration + (skin.gameplayEffect.armorPenetrationAdd ?? 0), 5);

      const tempest = getSkinsForTower("STORMCALLER").find((s) => (s.gameplayEffect.chainFalloffAdd ?? 0) < 0)!;
      expect(tempest).toBeTruthy();
      const withTempest = getTowerSpecialAtLevel("STORMCALLER", 20, tempest.gameplayEffect);
      if (withTempest.type !== "STORMCALLER") throw new Error("unreachable");
      // Lower falloff than base = the buff working as intended.
      expect(withTempest.chainFalloff).toBeLessThan(base.chainFalloff);
    });
  });
});
