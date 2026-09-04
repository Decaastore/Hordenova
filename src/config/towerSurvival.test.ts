import { describe, expect, it } from "vitest";
import { TOWER_SURVIVAL, getTowerSurvivalDefinition } from "./towerSurvival";
import { TOWER_TYPES } from "./towerStats";

describe("towerSurvival (Master Implementation Pass spec section 12) — real, DIFFERENT defensive identities", () => {
  it("every tower type has a distinct survival profile — never a universal HP/Armor pair copy-pasted four times", () => {
    const profiles = TOWER_TYPES.map((t) => JSON.stringify(TOWER_SURVIVAL[t]));
    expect(new Set(profiles).size).toBe(TOWER_TYPES.length);
  });

  it("IRONWOOD is the bruiser: highest maxHp AND real armor", () => {
    const ironwood = getTowerSurvivalDefinition("IRONWOOD");
    for (const type of TOWER_TYPES) {
      if (type === "IRONWOOD") continue;
      expect(ironwood.maxHp).toBeGreaterThanOrEqual(getTowerSurvivalDefinition(type).maxHp);
    }
    expect(ironwood.armor).toBeGreaterThan(0.2);
  });

  it("FROSTBORN is the only tower type with a real shield identity", () => {
    expect(getTowerSurvivalDefinition("FROSTBORN").maxShield).toBeGreaterThan(0);
    for (const type of TOWER_TYPES) {
      if (type === "FROSTBORN") continue;
      expect(getTowerSurvivalDefinition(type).maxShield).toBe(0);
    }
  });

  it("STORMCALLER has the lowest maxHp but the highest (or tied-highest) hpRegenPerSecond — fragile but resilient", () => {
    const stormcaller = getTowerSurvivalDefinition("STORMCALLER");
    for (const type of TOWER_TYPES) {
      if (type === "STORMCALLER") continue;
      expect(stormcaller.maxHp).toBeLessThanOrEqual(getTowerSurvivalDefinition(type).maxHp);
      expect(stormcaller.hpRegenPerSecond).toBeGreaterThanOrEqual(getTowerSurvivalDefinition(type).hpRegenPerSecond);
    }
  });

  it("every armor/shield value stays within [0,1] / non-negative — no nonsensical config", () => {
    for (const type of TOWER_TYPES) {
      const def = getTowerSurvivalDefinition(type);
      expect(def.armor).toBeGreaterThanOrEqual(0);
      expect(def.armor).toBeLessThanOrEqual(1);
      expect(def.maxHp).toBeGreaterThan(0);
      expect(def.maxShield).toBeGreaterThanOrEqual(0);
    }
  });
});
