import { describe, expect, it } from "vitest";
import { DROP_TABLES, rollDropTable, totalWeightPercent } from "./dropTables";

describe("dropTables", () => {
  it("every table's weights sum to exactly 100 — spec section 11: displayed chances must be mathematically real", () => {
    for (const table of Object.values(DROP_TABLES)) {
      expect(totalWeightPercent(table)).toBeCloseTo(100, 5);
    }
  });

  it("rollDropTable is a pure function of its rng: a fixed sequence always resolves to the expected item", () => {
    const table = DROP_TABLES["hollow-warden"]!;
    // Just past cumulative 55 (warden_fragment) -> lands in mosswood_charm's [55,80) band.
    expect(rollDropTable(table, () => 0.56)).toBe("mosswood_charm");
    // Near the very top -> the extremely-rare last entry.
    expect(rollDropTable(table, () => 0.9995)).toBe("crown_of_the_hollow_king");
    // roll=0 always lands in the first entry.
    expect(rollDropTable(table, () => 0)).toBe("warden_fragment");
  });

  it("never returns undefined even at the theoretical top edge (roll approaches 1)", () => {
    const table = DROP_TABLES["hollow-warden"]!;
    expect(rollDropTable(table, () => 0.999999999)).toBe("crown_of_the_hollow_king");
  });

  it("over many rolls, the empirical distribution roughly matches the declared weights (statistical sanity, not exact)", () => {
    const table = DROP_TABLES["hollow-warden"]!;
    const counts: Record<string, number> = {};
    const N = 20_000;
    let seed = 42;
    const rng = () => {
      // Deterministic PRNG so this test never flakes across runs.
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < N; i++) {
      const item = rollDropTable(table, rng);
      counts[item] = (counts[item] ?? 0) + 1;
    }
    const commonRate = (counts["warden_fragment"] ?? 0) / N;
    expect(commonRate).toBeGreaterThan(0.5);
    expect(commonRate).toBeLessThan(0.6);
  });
});
