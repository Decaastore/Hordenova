import { describe, expect, it } from "vitest";
import { CombatFx } from "./combatFx";
import { TOWER_TYPES } from "@/config/towerStats";

describe("combat effects", () => {
  it("every tower's impact lights the map, and everything fades away on its own", () => {
    const fx = new CombatFx();
    for (const t of TOWER_TYPES) fx.impact(t, { x: 0, y: 0 }, { x: 100, y: 50 }, [{ x: 140, y: 80 }], false);
    expect(fx.lights().length).toBeGreaterThanOrEqual(TOWER_TYPES.length);
    for (let i = 0; i < 600; i++) fx.update(16); // ~10 s
    expect(fx.lights()).toHaveLength(0);
    expect((fx as unknown as { particles: unknown[] }).particles).toHaveLength(0);
  });

  it("never holds more particles than its budget, however heavy the fight", () => {
    const fx = new CombatFx();
    for (let i = 0; i < 400; i++) fx.impact("INFERNO", { x: 0, y: 0 }, { x: 10, y: 10 }, [], true);
    expect((fx as unknown as { particles: unknown[] }).particles.length).toBeLessThanOrEqual(1400);
  });
});
