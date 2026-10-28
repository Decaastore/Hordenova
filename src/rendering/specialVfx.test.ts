import { describe, expect, it } from "vitest";
import { SpecialVfxLayer } from "./specialVfx";
import type { TowerType } from "@/config/towerStats";

const cast = (type: TowerType) => ({
  type,
  towerPosition: { x: 100, y: 100 },
  from: { x: 100, y: 80 },
  to: { x: 180, y: 60 },
  chainTargets: [],
  radius: 80,
});

describe("SpecialVfxLayer — tower magic effects", () => {
  it("every tower type's magic spawns and then expires on its own (no effect lingers forever)", () => {
    const layer = new SpecialVfxLayer();
    for (const type of ["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"] as const) layer.spawn(cast(type));
    expect(layer.activeCount).toBe(4);
    layer.update(500);
    expect(layer.activeCount).toBeGreaterThan(0);
    layer.update(5000);
    expect(layer.activeCount).toBe(0);
  });

  it("the pool is bounded however many magics fire at once", () => {
    const layer = new SpecialVfxLayer();
    for (let i = 0; i < 100; i++) layer.spawn(cast("INFERNO"));
    expect(layer.activeCount).toBeLessThanOrEqual(12);
  });
});
