import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import type { TowerLoadoutEntry } from "@/entities/Tower";
import { autoArrange, placementValue, roadCoverage } from "./MapDeployment";
import { getActiveMapLayout, getMapLayout, HIGH_GROUND_RANGE_MULT, MAX_TOWERS_ON_MAP, RUNE_ALTAR_DAMAGE_MULT, setActiveMapLayout } from "@/data/mapLayouts";
import { createTowerInstance, getTowerStats } from "@/entities/Tower";
import { createEnemyInstance, advanceEnemy } from "@/entities/Enemy";
import { PHASES } from "@/config/phaseConfig";
import { SEASON_EPOCH_MS } from "./SeasonClock";

const VOLCANO_FIRST_WAVE = PHASES.find((p) => p.biomeId === "VOLCANIC_WASTES")!.startWave + 1;

function loadout(count: number): TowerLoadoutEntry[] {
  const types = ["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"] as const;
  return getMapLayout("ANCIENT_FOREST")
    .sites.slice(0, count)
    .map((site, i) => ({
      slotId: site.id,
      type: types[i % 4]!,
      level: 10 + i,
      specializationId: null,
      specializationLevel: 0,
      equippedSkinId: null,
      masteryLevel: 0,
      equippedItemInstanceIds: [null, null, null],
    }));
}

describe("map deployment math", () => {
  it("coverage grows with range and is 0 far from the road", () => {
    const layout = getMapLayout("FROZEN_TUNDRA");
    const site = layout.sites[3]!;
    const small = roadCoverage(layout, site.position, 120).fraction;
    const big = roadCoverage(layout, site.position, 240).fraction;
    expect(big).toBeGreaterThan(small);
    expect(roadCoverage(layout, { x: -2000, y: -2000 }, 200).fraction).toBe(0);
  });

  it("site bonuses: high ground extends range, a rune altar raises damage", () => {
    const base = createTowerInstance("x", "IRONWOOD", { x: 0, y: 0 }, 20);
    const high = { ...base, siteTrait: "HIGH_GROUND" as const };
    const altar = { ...base, siteTrait: "RUNE_ALTAR" as const };
    expect(getTowerStats(high).range).toBeCloseTo(getTowerStats(base).range * HIGH_GROUND_RANGE_MULT, 1);
    expect(getTowerStats(altar).damage).toBeCloseTo(getTowerStats(base).damage * RUNE_ALTAR_DAMAGE_MULT, 1);
    expect(getTowerStats(altar).range).toBe(getTowerStats(base).range);
  });

  it("autoArrange gives every tower its own site, strongest tower on the best spot it can get", () => {
    const layout = getMapLayout("CURSED_DESERT");
    const towers = [1, 5, 30, 12, 8].map((lvl, i) => createTowerInstance(`t${i}`, "FROSTBORN", { x: 0, y: 0 }, lvl));
    const plan = autoArrange(towers, layout);
    expect(new Set(plan.values()).size).toBe(towers.length);
    const strongest = towers.find((t) => t.level === 30)!;
    const best = Math.max(...layout.sites.map((s) => placementValue(strongest, s, layout)));
    const chosen = layout.sites.find((s) => s.id === plan.get(strongest.id))!;
    expect(placementValue(strongest, chosen, layout)).toBeCloseTo(best, 6);
  });

  it("enemies cross every map in the same time", () => {
    const times: number[] = [];
    for (const id of ["ANCIENT_FOREST", "ABYSS", "CURSED_DESERT"]) {
      setActiveMapLayout(getMapLayout(id));
      const enemy = createEnemyInstance("CRAWLER", 1);
      let t = 0;
      while (!advanceEnemy(enemy, 50).reachedEnd && t < 600_000) t += 50;
      times.push(t);
    }
    setActiveMapLayout(getMapLayout("ANCIENT_FOREST"));
    for (const t of times) expect(Math.abs(t - times[0]!) / times[0]!).toBeLessThan(0.02);
  });
});

describe("moving onto a new map (real GameEngine)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(SEASON_EPOCH_MS + 1000);
  });
  afterEach(() => vi.useRealTimers());

  function engineOnVolcanoWith(count: number, pause: boolean): GameEngine {
    // A save from before per-map layouts: towers arranged on the original map, run now in phase 2.
    updateSave({ currentWave: VOLCANO_FIRST_WAVE, gold: 1000, towerLoadout: loadout(count), mapLayoutId: null, lastPlayedAt: null });
    const engine = new GameEngine();
    engine.enableDeployPause(pause);
    engine.startRun();
    return engine;
  }

  it("on the real game screen the run pauses in DEPLOY, every tower kept (level and all) on the new map's sites", () => {
    const engine = engineOnVolcanoWith(6, true);
    expect(engine.getHudSnapshot().phase).toBe("DEPLOY");
    expect(engine.getMapLayout().id).toBe("VOLCANIC_WASTES");
    expect(getActiveMapLayout().id).toBe("VOLCANIC_WASTES");
    const towers = engine.getRenderSnapshot().towers;
    expect(towers.map((t) => t.level).sort((a, b) => a - b)).toEqual([10, 11, 12, 13, 14, 15]);
    const sites = getMapLayout("VOLCANIC_WASTES").sites;
    for (const t of towers) {
      const site = sites.find((s) => s.id === t.slotId)!;
      expect(t.position).toEqual(site.position);
      expect(t.siteTrait).toBe(site.trait);
    }
    expect(new Set(towers.map((t) => t.slotId)).size).toBe(6);
    // Paused: time doesn't move while the player arranges.
    engine.update(5000);
    expect(engine.getRenderSnapshot().enemies).toHaveLength(0);
    expect(loadSave().mapLayoutId).toBe("VOLCANIC_WASTES");
  });

  it("during DEPLOY towers move and swap for free, then the phase starts", () => {
    const engine = engineOnVolcanoWith(3, true);
    const [a, b] = engine.getRenderSnapshot().towers;
    const aSite = a!.slotId;
    const bSite = b!.slotId;
    const gemsBefore = engine.getHudSnapshot().purchasedGems + engine.getHudSnapshot().freeGems;
    expect(engine.deployMoveTower(aSite, bSite)).toBe(true);
    expect(a!.slotId).toBe(bSite);
    expect(b!.slotId).toBe(aSite);
    const empty = getMapLayout("VOLCANIC_WASTES").sites.find((s) => !engine.getRenderSnapshot().towers.some((t) => t.slotId === s.id))!;
    expect(engine.deployMoveTower(bSite, empty.id)).toBe(true);
    expect(a!.slotId).toBe(empty.id);
    expect(engine.getHudSnapshot().purchasedGems + engine.getHudSnapshot().freeGems).toBe(gemsBefore);
    engine.confirmDeployment();
    expect(engine.getHudSnapshot().phase).not.toBe("DEPLOY");
    // free moves are DEPLOY-only
    expect(engine.deployMoveTower(a!.slotId, aSite)).toBe(false);
  });

  it("headless engines (tests, simulations) auto-arrange and keep playing", () => {
    const engine = engineOnVolcanoWith(4, false);
    expect(engine.getHudSnapshot().phase).not.toBe("DEPLOY");
    expect(engine.getMapLayout().id).toBe("VOLCANIC_WASTES");
    expect(engine.getRenderSnapshot().towers).toHaveLength(4);
  });

  it(`at most ${MAX_TOWERS_ON_MAP} towers can stand on a map — the extra sites are a choice, not more power`, () => {
    updateSave({ currentWave: 1, gold: 1_000_000, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    const sites = engine.getMapLayout().sites;
    for (const site of sites) engine.placeTower(site.id, "IRONWOOD");
    expect(engine.getRenderSnapshot().towers).toHaveLength(MAX_TOWERS_ON_MAP);
    expect(engine.getAvailableSlotIds()).toEqual([]);
  });
});
