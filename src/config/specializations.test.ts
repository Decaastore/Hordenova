import { describe, expect, it } from "vitest";
import {
  applySpecializationToSpecial,
  getSpecializationUpgradeCost,
  specializationEffectScale,
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

  // INFINITE BALANCE OVERHAUL — the level track has no cap (Gold must
  // always have a sink) AND the combat effect itself never stops growing
  // either (see the diminishing-returns describe block below) — the old
  // "level uncapped, effect capped at 5" split is gone entirely.
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
    tower.specializationLevel = 5;
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

  /**
   * BALANCEAMENTO DEFINITIVO audit finding — real-GameEngine simulation at
   * wave 1595 found a 12x IRONWOOD_EXECUTIONER build's boss-kill margin at
   * ~1508x (vs. ~54x for BREAKER and ~22x for VANGUARD at the identical
   * level/specLevel/masteryLevel investment) — trivializing every boss fight
   * far beyond the "fácil demais" (>30x) contract line. Root cause: this was
   * the ONLY specialization path in the file combining TWO of its own
   * fields (critMultiplier AND bossDamageMultiplier) that both scale
   * continuously and UNBOUNDED with the same diminishing-returns `lvl` —
   * multiplying together on every hit against a boss/mini-boss, so the
   * path's boss-specific power grew roughly QUADRATICALLY in `lvl` instead
   * of linearly like every other path's own single unbounded field. Every
   * other path in this file caps at most one field (a probability/fraction)
   * and leaves exactly ONE companion field genuinely unbounded — this test
   * pins EXECUTIONER to that same one-bounded/one-unbounded shape: critMultiplier
   * stays the sole unbounded field (matching e.g. BREAKER's own shape),
   * bossDamageMultiplier's specialization-driven bonus now saturates. This
   * does NOT touch specializationEffectScale/SPECIALIZATION_EFFECT_EXPONENT
   * (frozen) — only how this one path's own two fields consume `lvl`.
   */
  it("BALANCE FIX: IRONWOOD_EXECUTIONER's bossDamageMultiplier saturates at very high specialization levels — critMultiplier stays the sole unbounded companion field", () => {
    const base = getTowerSpecialAtLevel("IRONWOOD", 60);
    if (base.type !== "IRONWOOD") throw new Error("unreachable");

    const at = (level: number) => {
      const r = applySpecializationToSpecial(base, "IRONWOOD_EXECUTIONER", level);
      if (r.type !== "IRONWOOD") throw new Error("unreachable");
      return r;
    };

    const low = at(20);
    const mid = at(800); // ~ the specLevel a maximally-reinvesting build reaches by wave ~1595
    const extreme = at(100_000);

    // critMultiplier: the deliberately unbounded companion field — keeps
    // growing forever, exactly like every other path's own unbounded field.
    expect(mid.critMultiplier).toBeGreaterThan(low.critMultiplier);
    expect(extreme.critMultiplier).toBeGreaterThan(mid.critMultiplier);

    // bossDamageMultiplier: now saturates (mirrors how BREAKER's own
    // armor-penetration field is capped) instead of compounding with
    // critMultiplier forever — level 800 and level 100,000 land at the
    // exact same saturated value.
    expect(mid.bossDamageMultiplier).toBeLessThanOrEqual(3.6);
    expect(extreme.bossDamageMultiplier).toBe(mid.bossDamageMultiplier);
  });

  /**
   * BALANCEAMENTO DEFINITIVO second-pass audit — the one-bounded/one-unbounded
   * SHAPE fix above (previous test) removed the runaway EXPONENTIAL bug, but
   * a real-GameEngine sweep across waves 100-5000 (isolated 12/12 builds,
   * level=30, specLevel=round(wave/2), masteryLevel=round(wave/3)) found the
   * tuned CONSTANTS still made EXECUTIONER's boss-kill margin ~80-108x —
   * 3-9x above its own IRONWOOD_BREAKER sibling (same shape, same `lvl`
   * input, same test bias), with the gap widening every wave tested (never
   * saturating within the tested range). Root cause: critMultiplier's
   * coefficient (0.15) was ~3.75x BREAKER's own (0.04) and bossDamageMultiplier's
   * cap (2.0, i.e. a flat +300% boss multiplier) was far bigger than any
   * sibling's bounded field — so even though neither field is individually
   * unbounded-times-unbounded anymore, the combination still consumed far
   * more of the shared power budget than any other IRONWOOD path.
   *
   * Fix (magnitude only, not shape): critMultiplier's coefficient now matches
   * BREAKER's own (0.04) exactly, so the two paths' marginal crit growth
   * rate is identical and their margin RATIO stays flat across waves instead
   * of drifting apart forever (~1.35x, measured stable from wave 100 to
   * 5000, vs. the old 3.18x->6.27x drift). EXECUTIONER's boss-killer identity
   * now comes entirely from the capped bossDamageMultiplier field (0.75 cap,
   * down from 2.0) — a real, permanent, boss-specific edge, but sized to sit
   * alongside its siblings' own budgets instead of dwarfing them.
   */
  it("BALANCE FIX 2: IRONWOOD_EXECUTIONER's crit coefficient now matches BREAKER's own (0.04) — the boss-killer edge comes from the (smaller) capped field, not from out-scaling siblings", () => {
    const base = getTowerSpecialAtLevel("IRONWOOD", 30);
    if (base.type !== "IRONWOOD") throw new Error("unreachable");
    const level = 500;
    const lvl = specializationEffectScale(level);

    const r = applySpecializationToSpecial(base, "IRONWOOD_EXECUTIONER", level);
    if (r.type !== "IRONWOOD") throw new Error("unreachable");

    expect(r.critMultiplier).toBeCloseTo(base.critMultiplier + lvl * 0.04, 2);
    expect(r.bossDamageMultiplier).toBeCloseTo((base.bossDamageMultiplier || 1) + Math.min(0.75, lvl * 0.1), 2);
    // The bounded companion field is meaningfully smaller than the old 2.0
    // cap — this is the actual budget fix (the shape was already correct).
    expect(r.bossDamageMultiplier - (base.bossDamageMultiplier || 1)).toBeLessThanOrEqual(0.75);
  });

  it("STORMCALLER_ARCANE_SURGE adds flat magic damage that keeps growing with specialization level, with no cap", () => {
    const base = getTowerSpecialAtLevel("STORMCALLER", 10);
    const lvl1 = applySpecializationToSpecial(base, "STORMCALLER_ARCANE_SURGE", 1) as { bonusFlatDamage?: number };
    const lvl5 = applySpecializationToSpecial(base, "STORMCALLER_ARCANE_SURGE", 5) as { bonusFlatDamage?: number };
    const lvl1000 = applySpecializationToSpecial(base, "STORMCALLER_ARCANE_SURGE", 1000) as { bonusFlatDamage?: number };
    expect(lvl1.bonusFlatDamage).toBeGreaterThan(0);
    expect(lvl5.bonusFlatDamage!).toBeGreaterThan(lvl1.bonusFlatDamage!);
    expect(lvl1000.bonusFlatDamage!).toBeGreaterThan(lvl5.bonusFlatDamage!);
  });

  it("specializationEffectScale is a strictly increasing, diminishing-returns function of level: never flat, always finite, never negative", () => {
    const levels = [0, 1, 2, 3, 4, 5, 10, 25, 50, 100, 1000, 10_000, 1_000_000];
    let previousScale = -Infinity;
    let previousMarginal = Infinity;
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i]!;
      const scale = specializationEffectScale(level);
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(0);
      expect(scale).toBeGreaterThan(previousScale); // strictly increasing forever, never flat/capped
      if (i > 0) {
        // Marginal gain per level shrinks as level grows — genuine diminishing returns, not a runaway curve.
        const marginal = (scale - previousScale) / (level - levels[i - 1]!);
        expect(marginal).toBeLessThanOrEqual(previousMarginal + 1e-9);
        previousMarginal = marginal;
      }
      previousScale = scale;
    }
  });

  it("low specialization levels track the raw level almost exactly (early-game tuning preserved), while very high levels grow far slower than the raw level (diminishing returns actually bites)", () => {
    expect(specializationEffectScale(1)).toBeCloseTo(1, 1);
    expect(specializationEffectScale(3)).toBeCloseTo(3, 0);
    // At level 1,000,000 the scale must be many orders of magnitude below the raw level.
    expect(specializationEffectScale(1_000_000)).toBeLessThan(10_000);
  });

  /**
   * INFINITE BALANCE OVERHAUL — mandatory permanent regression test: no
   * specialization branch's combat effect may ever be flat/identical beyond
   * some level (that was the OLD, now-removed, hard cap at level 5) — every
   * branch must keep producing a strictly larger number forever, however
   * slowly, AND every numeric field must stay finite no matter how extreme
   * the level. This is the single most important invariant of the infinite-
   * progression fix and must never regress back to a disguised cap.
   */
  describe("Specialization combat effect grows FOREVER with diminishing returns — never flat, never capped, never overflows", () => {
    const ALL_DEFS = Object.values(SPECIALIZATIONS_BY_TOWER).flat();

    it("every specialization's effect keeps strictly increasing at extreme levels — never identical to its effect at a lower level", () => {
      for (const def of ALL_DEFS) {
        const base = getTowerSpecialAtLevel(def.towerType, 20);
        const at1000 = applySpecializationToSpecial(base, def.id, 1000);
        const at1M = applySpecializationToSpecial(base, def.id, 1_000_000);
        expect(at1M).not.toEqual(at1000);
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
