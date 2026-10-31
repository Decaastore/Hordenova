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

  it("on the real game screen the run pauses in DEPLOY with every tower (level and all) off the map, waiting to be placed", () => {
    const engine = engineOnVolcanoWith(6, true);
    const hud = engine.getHudSnapshot();
    expect(hud.phase).toBe("DEPLOY");
    expect(engine.getMapLayout().id).toBe("VOLCANIC_WASTES");
    expect(getActiveMapLayout().id).toBe("VOLCANIC_WASTES");
    // nothing is placed for the player
    expect(engine.getRenderSnapshot().towers).toHaveLength(0);
    expect(hud.towerCount).toBe(0);
    expect(hud.deployBench.map((t) => t.level).sort((a, b) => a - b)).toEqual([10, 11, 12, 13, 14, 15]);
    // Paused: time doesn't move while the player places.
    engine.update(5000);
    expect(engine.getRenderSnapshot().enemies).toHaveLength(0);
    expect(loadSave().mapLayoutId).toBe("VOLCANIC_WASTES");
  });

  it("each tower is placed once, on a free site the player picks; the phase can't start until all are placed", () => {
    const engine = engineOnVolcanoWith(3, true);
    const sites = getMapLayout("VOLCANIC_WASTES").sites;
    const [first, second, third] = engine.getHudSnapshot().deployBench;
    const gemsBefore = engine.getHudSnapshot().purchasedGems + engine.getHudSnapshot().freeGems;

    expect(engine.deployPlaceTower(first!.id, sites[4]!.id)).toBe(true);
    const placed = engine.getRenderSnapshot().towers[0]!;
    expect(placed.slotId).toBe(sites[4]!.id);
    expect(placed.position).toEqual(sites[4]!.position);
    expect(placed.siteTrait).toBe(sites[4]!.trait);
    expect(placed.level).toBe(first!.level);
    // a site holds one tower; a placed tower is no longer on the bench
    expect(engine.deployPlaceTower(second!.id, sites[4]!.id)).toBe(false);
    expect(engine.deployPlaceTower(first!.id, sites[5]!.id)).toBe(false);
    expect(engine.deployPlaceTower(placed.id, sites[5]!.id)).toBe(false);

    engine.confirmDeployment();
    expect(engine.getHudSnapshot().phase).toBe("DEPLOY");

    expect(engine.deployPlaceTower(second!.id, sites[0]!.id)).toBe(true);
    expect(engine.deployPlaceTower(third!.id, sites[9]!.id)).toBe(true);
    expect(engine.getHudSnapshot().deployBench).toHaveLength(0);
    expect(engine.getHudSnapshot().purchasedGems + engine.getHudSnapshot().freeGems).toBe(gemsBefore);
    engine.confirmDeployment();
    expect(engine.getHudSnapshot().phase).not.toBe("DEPLOY");
    expect(engine.getRenderSnapshot().towers).toHaveLength(3);
  });

  it("after placing, moving a tower is the regular reposition: the day's free move, then it costs Gems", () => {
    const engine = engineOnVolcanoWith(2, true);
    const sites = getMapLayout("VOLCANIC_WASTES").sites;
    const bench = engine.getHudSnapshot().deployBench;
    engine.deployPlaceTower(bench[0]!.id, sites[1]!.id);
    engine.deployPlaceTower(bench[1]!.id, sites[3]!.id);
    expect(engine.getRepositionPrice()).toEqual({ free: 0, purchased: 0 });
    expect(engine.repositionTower(sites[1]!.id, sites[6]!.id)).toBe(true);
    // the free move is spent: the next one needs a currency and enough Gems
    expect(engine.getRepositionPrice().free + engine.getRepositionPrice().purchased).toBeGreaterThan(0);
    expect(engine.repositionTower(sites[6]!.id, sites[8]!.id)).toBe(false);
    expect(engine.getRenderSnapshot().towers.find((t) => t.slotId === sites[6]!.id)).toBeDefined();
  });

  it("a reload in the middle of placing keeps both the placed and the waiting towers", () => {
    const engine = engineOnVolcanoWith(4, true);
    const sites = getMapLayout("VOLCANIC_WASTES").sites;
    const bench = engine.getHudSnapshot().deployBench;
    engine.deployPlaceTower(bench[0]!.id, sites[2]!.id);
    engine.deployPlaceTower(bench[1]!.id, sites[7]!.id);

    const saved = loadSave().towerLoadout;
    expect(saved).toHaveLength(4);
    expect(saved.filter((e) => e.slotId === "")).toHaveLength(2);

    const reloaded = new GameEngine();
    reloaded.enableDeployPause(true);
    reloaded.startRun();
    expect(reloaded.getHudSnapshot().phase).toBe("DEPLOY");
    expect(reloaded.getRenderSnapshot().towers.map((t) => t.slotId).sort()).toEqual([sites[2]!.id, sites[7]!.id].sort());
    expect(reloaded.getHudSnapshot().deployBench).toHaveLength(2);
  });

  it("the tower cap counts the towers still waiting to be placed", () => {
    updateSave({ currentWave: VOLCANO_FIRST_WAVE, gold: 1_000_000, towerLoadout: loadout(MAX_TOWERS_ON_MAP), mapLayoutId: null, lastPlayedAt: null });
    const engine = new GameEngine();
    engine.enableDeployPause(true);
    engine.startRun();
    expect(engine.getAvailableSlotIds()).toEqual([]);
    expect(engine.placeTower(getMapLayout("VOLCANIC_WASTES").sites[0]!.id, "IRONWOOD")).toBe(false);
  });

  it("headless engines (offline progress, simulations — no player to ask) place the towers themselves and keep playing", () => {
    const engine = engineOnVolcanoWith(4, false);
    expect(engine.getHudSnapshot().phase).not.toBe("DEPLOY");
    expect(engine.getMapLayout().id).toBe("VOLCANIC_WASTES");
    const towers = engine.getRenderSnapshot().towers;
    expect(towers).toHaveLength(4);
    expect(engine.getHudSnapshot().deployBench).toHaveLength(0);
    const sites = getMapLayout("VOLCANIC_WASTES").sites;
    for (const t of towers) expect(sites.find((s) => s.id === t.slotId)?.position).toEqual(t.position);
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
