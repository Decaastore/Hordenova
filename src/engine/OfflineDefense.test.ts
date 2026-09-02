import { describe, expect, it } from "vitest";
import { computeOfflineCapacityMs, MAX_OFFLINE_CAPACITY_MS, simulateOfflineDefense } from "./OfflineDefense";
import type { TowerLoadoutEntry } from "@/entities/Tower";

const STRONG_BUILD: TowerLoadoutEntry[] = [
  { slotId: "slot-1", type: "IRONWOOD", level: 25 },
  { slotId: "slot-2", type: "INFERNO", level: 25 },
  { slotId: "slot-3", type: "FROSTBORN", level: 20 },
  { slotId: "slot-4", type: "STORMCALLER", level: 20 },
];

const WEAK_BUILD: TowerLoadoutEntry[] = [{ slotId: "slot-1", type: "IRONWOOD", level: 1 }];

describe("OfflineDefense", () => {
  it("caps capacity at MAX_OFFLINE_CAPACITY_MS regardless of how long the player was away", () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const capacity = computeOfflineCapacityMs(0, oneDayMs);
    expect(capacity).toBe(MAX_OFFLINE_CAPACITY_MS);
  });

  it("never accrues capacity purely from active playtime (no elapsed real time -> zero capacity)", () => {
    const now = 1_000_000;
    expect(computeOfflineCapacityMs(now, now)).toBe(0);
  });

  it("clamps negative deltas (lastPlayedAt in the future) to zero instead of going negative", () => {
    expect(computeOfflineCapacityMs(2000, 1000)).toBe(0);
  });

  it("a strong build clears multiple phases within a full capacity window", () => {
    const result = simulateOfflineDefense({
      startingWave: 20,
      towerLoadout: STRONG_BUILD,
      capacityMs: MAX_OFFLINE_CAPACITY_MS,
    });

    expect(result.phasesCleared).toBeGreaterThan(0);
    expect(result.endingWave).toBeGreaterThan(20);
    expect(result.resourcesEarned).toBeGreaterThan(0);
  });

  it("a weak build does NOT advance dozens of phases artificially — offline never substitutes for a real build", () => {
    const result = simulateOfflineDefense({
      startingWave: 20,
      towerLoadout: WEAK_BUILD,
      capacityMs: MAX_OFFLINE_CAPACITY_MS,
    });

    expect(result.phasesCleared).toBeLessThan(5);
    expect(result.stoppedReason).toBe("BUILD_TOO_WEAK");
  });

  it("stops with RAN_OUT_OF_CAPACITY when capacity, not build strength, is the limiting factor", () => {
    const result = simulateOfflineDefense({
      startingWave: 1,
      towerLoadout: STRONG_BUILD,
      capacityMs: 5_000, // shorter than even Wave 1's inflated offline cost
    });

    expect(result.phasesCleared).toBe(0);
    expect(result.stoppedReason).toBe("RAN_OUT_OF_CAPACITY");
  });

  it("zero capacity clears zero phases", () => {
    const result = simulateOfflineDefense({ startingWave: 5, towerLoadout: STRONG_BUILD, capacityMs: 0 });
    expect(result.phasesCleared).toBe(0);
    expect(result.endingWave).toBe(5);
  });
});
