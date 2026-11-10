import { describe, expect, it } from "vitest";
import {
  advanceRebuild,
  builtBuildings,
  CITY_BUILDINGS,
  CITY_REBUILD_WAVES,
  cityGoldShare,
  createCityState,
  igniteBuildings,
  nextBuilding,
  sanitizeCityState,
} from "./city";

describe("O Castelo vira cidade", () => {
  it("buildings rise in order as the Season's best wave grows", () => {
    expect(builtBuildings(0)).toHaveLength(0);
    expect(builtBuildings(CITY_BUILDINGS[2]!.unlockWave).map((b) => b.id)).toEqual(["HOUSES", "FARM", "MARKET"]);
    expect(nextBuilding(CITY_BUILDINGS[2]!.unlockWave)?.id).toBe("SMITHY");
    expect(nextBuilding(10_000)).toBeNull();
    for (let i = 1; i < CITY_BUILDINGS.length; i++) expect(CITY_BUILDINGS[i]!.unlockWave).toBeGreaterThan(CITY_BUILDINGS[i - 1]!.unlockWave);
  });

  it("a full city pays a modest share of each wave's gold", () => {
    const full = cityGoldShare(10_000, createCityState());
    expect(full).toBeGreaterThan(0.05);
    expect(full).toBeLessThanOrEqual(0.15);
  });

  it("a breach burns a standing building, which pays nothing until enough clean waves rebuild it", () => {
    const state = createCityState();
    const wave = 60;
    const before = cityGoldShare(wave, state);
    const lit = igniteBuildings(wave, state, 1);
    expect(lit).toHaveLength(1);
    expect(cityGoldShare(wave, state)).toBeLessThan(before);
    for (let i = 0; i < CITY_REBUILD_WAVES - 1; i++) expect(advanceRebuild(state)).toEqual([]);
    expect(advanceRebuild(state)).toEqual(lit);
    expect(cityGoldShare(wave, state)).toBeCloseTo(before);
  });

  it("which building burns follows a fixed rotation, and nothing burns in an empty city", () => {
    const a = createCityState();
    const b = createCityState();
    expect(igniteBuildings(100, a, 3)).toEqual(igniteBuildings(100, b, 3));
    expect(igniteBuildings(0, createCityState(), 2)).toEqual([]);
  });

  it("old or broken saves heal to a calm city", () => {
    expect(sanitizeCityState(undefined)).toEqual(createCityState());
    expect(sanitizeCityState({ burning: { FARM: 99, NOPE: 2 }, firesStarted: -3 }).burning).toEqual({ FARM: CITY_REBUILD_WAVES });
  });
});
