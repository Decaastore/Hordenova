import { describe, expect, it } from "vitest";
import { DUEL_TOWER_SKINS, PACK_TOWER_SKINS, PRESTIGE_TOWER_SKINS, RANKED_TOWER_SKINS, TOWER_SKINS } from "@/config/towerSkins";
import { skinShotSignature } from "./skinShotFx";

const ALL = [...TOWER_SKINS, ...PRESTIGE_TOWER_SKINS, ...DUEL_TOWER_SKINS, ...PACK_TOWER_SKINS, ...RANKED_TOWER_SKINS];

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

describe("ranking-prize skin signatures", () => {
  it("each ranking skin has its own trail, impact and aura — shared with no other skin at all", () => {
    const others = [...TOWER_SKINS, ...PRESTIGE_TOWER_SKINS, ...DUEL_TOWER_SKINS, ...PACK_TOWER_SKINS];
    const used = {
      trail: new Set(others.map((s) => skinShotSignature(s.id)!.trail)),
      impact: new Set(others.map((s) => skinShotSignature(s.id)!.impact)),
      aura: new Set(others.map((s) => s.particleStyle.behavior)),
    };
    const mine = { trail: new Set<string>(), impact: new Set<string>(), aura: new Set<string>() };
    for (const s of RANKED_TOWER_SKINS) {
      const sig = skinShotSignature(s.id)!;
      expect(sig, s.id).toBeTruthy();
      expect(used.trail.has(sig.trail), s.id).toBe(false);
      expect(used.impact.has(sig.impact), s.id).toBe(false);
      expect(used.aura.has(s.particleStyle.behavior), s.id).toBe(false);
      mine.trail.add(sig.trail);
      mine.impact.add(sig.impact);
      mine.aura.add(s.particleStyle.behavior);
    }
    expect(mine.trail.size).toBe(RANKED_TOWER_SKINS.length);
    expect(mine.impact.size).toBe(RANKED_TOWER_SKINS.length);
    expect(mine.aura.size).toBe(RANKED_TOWER_SKINS.length);
  });
});
