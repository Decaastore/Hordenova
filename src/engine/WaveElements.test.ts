import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import {
  BLESSING_MULT,
  ELEMENT_FIRST_WAVE,
  ELEMENT_RESIST_MULT,
  ELEMENT_STRONG_MULT,
  counterOf,
  elementMultipliers,
  waveElementFor,
} from "@/config/waveElements";

describe("Elemento da onda", () => {
  it("each element is beaten by exactly one tower and resisted by its own", () => {
    const fire = elementMultipliers("FIRE");
    expect(fire.FROSTBORN).toBe(ELEMENT_STRONG_MULT);
    expect(fire.INFERNO).toBe(ELEMENT_RESIST_MULT);
    expect(fire.IRONWOOD).toBe(1);
    expect(fire.STORMCALLER).toBe(1);
    expect(counterOf("NATURE")).toBe("FIRE");
    expect(counterOf("STORM")).toBe("NATURE");
    expect(counterOf("ICE")).toBe("STORM");
    expect(counterOf("FIRE")).toBe("ICE");
  });

  it("no element on the first waves or on boss waves; otherwise always the same one for a wave", () => {
    for (let w = 1; w < ELEMENT_FIRST_WAVE; w++) expect(waveElementFor(w)).toBeNull();
    expect(waveElementFor(40, true)).toBeNull();
    expect(waveElementFor(37)).toBe(waveElementFor(37));
    const seen = new Set(Array.from({ length: 200 }, (_, i) => waveElementFor(ELEMENT_FIRST_WAVE + i)));
    expect(seen.size).toBe(4);
  });

  it("no element means no change", () => {
    expect(Object.values(elementMultipliers(null)).every((v) => v === 1)).toBe(true);
  });
});

describe("Bênção elemental", () => {
  beforeEach(() => window.localStorage.clear());

  it("can't be chosen until it is offered, then blesses that element's towers", () => {
    updateSave({ currentWave: 1, gold: 100 });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.chooseBlessing("FIRE")).toBe(false);
    (engine as unknown as { finishWave(w: number): void }).finishWave(5);
    expect(engine.getHudSnapshot().blessingOffered).toBe(true);
    const before = (engine as unknown as { combatMultipliers(): Record<string, number> }).combatMultipliers();
    expect(engine.chooseBlessing("FIRE")).toBe(true);
    expect(engine.getHudSnapshot().blessingOffered).toBe(false);
    expect(engine.getHudSnapshot().blessing?.element).toBe("FIRE");
    const after = (engine as unknown as { combatMultipliers(): Record<string, number> }).combatMultipliers();
    expect(after.INFERNO).toBeCloseTo(before.INFERNO! * BLESSING_MULT, 6);
    expect(after.FROSTBORN).toBeCloseTo(before.FROSTBORN!, 6);
  });
});
