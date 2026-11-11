import { beforeEach, describe, expect, it } from "vitest";
import { brightnessFactors, cycleMapBrightness, getMapBrightness, setMapBrightness } from "./mapBrightness";

describe("mapBrightness", () => {
  beforeEach(() => setMapBrightness("DARK"));

  it("cycles Sombrio → Normal → Claro → Sombrio", () => {
    expect(getMapBrightness()).toBe("DARK");
    expect(cycleMapBrightness()).toBe("NORMAL");
    expect(cycleMapBrightness()).toBe("BRIGHT");
    expect(cycleMapBrightness()).toBe("DARK");
  });

  it("brighter levels weaken the grade, the night and the mist", () => {
    const d = brightnessFactors("DARK");
    const n = brightnessFactors("NORMAL");
    const b = brightnessFactors("BRIGHT");
    expect(d.grade).toBeGreaterThan(n.grade);
    expect(n.grade).toBeGreaterThan(b.grade);
    expect(d.night).toBeGreaterThan(n.night);
    expect(n.night).toBeGreaterThan(b.night);
    expect(b.grade).toBe(0);
  });

  it("persists the choice", () => {
    setMapBrightness("BRIGHT");
    expect(localStorage.getItem("hordenova.map.brightness.v1")).toBe("BRIGHT");
  });
});
