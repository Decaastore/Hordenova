import { describe, expect, it } from "vitest";
import { GOLD_SINKS, hasUncappedGoldSink } from "./goldSinks";

describe("goldSinks (Master Implementation Pass spec section 6/45)", () => {
  it("Tower Mastery is registered as the uncapped sink (Gold Economy Invariant)", () => {
    const mastery = GOLD_SINKS.find((s) => s.id === "tower_mastery");
    expect(mastery).toBeDefined();
    expect(mastery!.uncapped).toBe(true);
  });

  it("hasUncappedGoldSink is true — Gold can never structurally run out of somewhere to go", () => {
    expect(hasUncappedGoldSink()).toBe(true);
  });

  it("every sink has a unique id", () => {
    const ids = GOLD_SINKS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
