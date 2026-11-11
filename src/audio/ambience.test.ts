import { afterEach, describe, expect, it } from "vitest";
import { ambienceBedFor, thunderDue } from "./ambience";
import { lightningStrikeAt } from "@/rendering/ambientLight";

const w = window as unknown as { __hordenovaWeather?: number };

describe("ambience", () => {
  afterEach(() => {
    delete w.__hordenovaWeather;
  });

  it("gives every place a fitting bed", () => {
    expect(ambienceBedFor("ANCIENT_FOREST")).toBe("forest");
    expect(ambienceBedFor("VOLCANIC_WASTES")).toBe("volcanic");
    expect(ambienceBedFor("ABYSS")).toBe("cave");
    expect(ambienceBedFor("LEVIATHAN_COAST")).toBe("coast");
    expect(ambienceBedFor("FROZEN_TUNDRA")).toBe("wind");
    expect(ambienceBedFor("SOMETHING_NEW")).toBe("wind");
  });

  it("thunder follows each lightning strike once, only where it rains", () => {
    w.__hordenovaWeather = 1;
    const strike = lightningStrikeAt(50_000)!;
    const after = strike.atMs + 100;
    expect(thunderDue("ANCIENT_FOREST", after, -1)).toBe(strike.cycle);
    expect(thunderDue("ANCIENT_FOREST", after, strike.cycle)).toBeNull();
    expect(thunderDue("ANCIENT_FOREST", strike.atMs - 10, -1)).toBeNull();
    expect(thunderDue("VOLCANIC_WASTES", after, -1)).toBeNull();
  });

  it("no lightning (so no thunder) while the rain is light", () => {
    w.__hordenovaWeather = 0.3;
    expect(lightningStrikeAt(50_000)).toBeNull();
    expect(thunderDue("ANCIENT_FOREST", 50_000, -1)).toBeNull();
  });
});
