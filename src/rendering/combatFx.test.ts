import { describe, expect, it } from "vitest";
import { CombatFx, MAX_PARTICLES } from "./combatFx";
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
    expect((fx as unknown as { particles: unknown[] }).particles.length).toBeLessThanOrEqual(MAX_PARTICLES);
  });
});

describe("fire and ice specials", () => {
  it("the meteor lands, explodes and leaves a burning field; the frost wave raises ice that shatters — then everything clears", () => {
    const fx = new CombatFx();
    const shakes: number[] = [];
    fx.onShake = (m) => shakes.push(m);
    fx.firestorm({ x: 300, y: 300 }, 70, 1);
    fx.frostNova({ x: 600, y: 300 }, 180, 1);
    expect(shakes.length).toBe(1); // the frost wave's thump
    for (let i = 0; i < 30; i++) fx.update(16); // ~0.5 s: the meteor has hit
    expect(shakes.length).toBe(2);
    const kinds = new Set((fx as unknown as { particles: { kind: string }[] }).particles.map((p) => p.kind));
    expect(kinds.has("fire")).toBe(true);
    expect(kinds.has("spike")).toBe(true);
    for (let i = 0; i < 800; i++) fx.update(16);
    expect((fx as unknown as { particles: unknown[] }).particles).toHaveLength(0);
  });
});
