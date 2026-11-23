import { describe, expect, it } from "vitest";
import { DUEL_TOWER_SKINS, PACK_TOWER_SKINS, PRESTIGE_TOWER_SKINS, TOWER_SKINS } from "@/config/towerSkins";
import { skinShotSignature } from "./skinShotFx";

const ALL = [...TOWER_SKINS, ...PRESTIGE_TOWER_SKINS, ...DUEL_TOWER_SKINS, ...PACK_TOWER_SKINS];

describe("skin shot signatures", () => {
  it("every skin has its own shot trail and impact", () => {
    for (const s of ALL) expect(skinShotSignature(s.id), s.id).not.toBeNull();
  });

  it("no two skins of the same tower share both trail and impact", () => {
    const seen = new Map<string, string>();
    for (const s of ALL) {
      const sig = skinShotSignature(s.id)!;
      const key = `${s.towerType}|${sig.trail}|${sig.impact}`;
      expect(seen.get(key), `${s.id} repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, s.id);
    }
  });

  it("bundle skins use trails, impacts and auras no other skin uses, and none of them repeat among themselves", () => {
    const others = ALL.filter((s) => s.tier !== "PACK");
    const otherTrails = new Set(others.map((s) => skinShotSignature(s.id)!.trail));
    const otherImpacts = new Set(others.map((s) => skinShotSignature(s.id)!.impact));
    const otherAuras = new Set(others.map((s) => s.particleStyle.behavior));
    const packImpacts = new Set<string>();
    const packAuras = new Set<string>();
    const packTrails = new Set<string>();
    for (const s of PACK_TOWER_SKINS) {
      const sig = skinShotSignature(s.id)!;
      expect(otherTrails.has(sig.trail), s.id).toBe(false);
      expect(otherImpacts.has(sig.impact), s.id).toBe(false);
      expect(otherAuras.has(s.particleStyle.behavior), s.id).toBe(false);
      packTrails.add(sig.trail);
      packImpacts.add(sig.impact);
      packAuras.add(s.particleStyle.behavior);
    }
    expect(packTrails.size).toBe(PACK_TOWER_SKINS.length);
    expect(packImpacts.size).toBe(PACK_TOWER_SKINS.length);
    expect(packAuras.size).toBe(PACK_TOWER_SKINS.length);
  });
});
