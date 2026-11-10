import { afterEach, describe, expect, it } from "vitest";
import { DAY_LENGTH_MS, rgbOf, skyFor, timeOfDay } from "./ambientLight";

describe("day/night cycle", () => {
  afterEach(() => {
    delete (window as unknown as { __hordenovaTimeOfDay?: number }).__hordenovaTimeOfDay;
  });

  it("is full day for the first half, deep night later, and always within 0..1", () => {
    expect(timeOfDay(DAY_LENGTH_MS * 0.2).night).toBe(0);
    expect(timeOfDay(DAY_LENGTH_MS * 0.7).night).toBe(1);
    for (let f = 0; f < 1; f += 0.01) {
      const t = timeOfDay(DAY_LENGTH_MS * f);
      expect(t.night).toBeGreaterThanOrEqual(0);
      expect(t.night).toBeLessThanOrEqual(1);
      expect(t.golden).toBeLessThanOrEqual(1);
    }
    // dusk is golden, noon is not
    expect(timeOfDay(DAY_LENGTH_MS * 0.53).golden).toBeGreaterThan(0.5);
    expect(timeOfDay(DAY_LENGTH_MS * 0.25).golden).toBe(0);
  });

  it("the night never gets so dark that creatures are hard to see", () => {
    for (const biome of ["ANCIENT_FOREST", "CURSED_DESERT", "ABYSS", "VOLCANIC_WASTES", "UNKNOWN"]) {
      expect(skyFor(biome).nightAlpha).toBeLessThanOrEqual(0.7);
    }
  });

  it("reads tower glow colors", () => {
    expect(rgbOf("rgba(157,255,106,0.55)")).toEqual([157, 255, 106]);
    expect(rgbOf("#ff6a2e")).toEqual([255, 106, 46]);
  });
});
