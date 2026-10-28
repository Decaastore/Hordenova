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
    expect(layer.activeCount).toBeLessThanOrEqual(8);
  });

  it("only a few magics play their full version at once — later ones while the screen is busy play the short reduced version", () => {
    const layer = new SpecialVfxLayer();
    for (let i = 0; i < 6; i++) layer.spawn(cast("FROSTBORN"));
    const casts = (layer as unknown as { casts: { reduced: boolean; totalMs: number }[] }).casts;
    expect(casts.filter((c) => !c.reduced)).toHaveLength(3);
    expect(casts.filter((c) => c.reduced).every((c) => c.totalMs < casts[0]!.totalMs)).toBe(true);
  });

  it("no magic lingers on the map for more than ~1.3s", () => {
    const layer = new SpecialVfxLayer();
    for (const type of ["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"] as const) layer.spawn(cast(type));
    layer.update(1350);
    expect(layer.activeCount).toBe(0);
  });
});
