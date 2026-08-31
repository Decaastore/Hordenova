import { describe, expect, it } from "vitest";
import { ENEMY_PATH, TOWER_SLOTS } from "./mapWhisperingWoods";
import { distanceToPolyline } from "@/utils/geometry";
import { getTowerLevelStats, TOWER_TYPES } from "@/config/towerStats";

/**
 * The single most important gameplay guarantee in this phase (spec:
 * "EVERY BUILDABLE TOWER POSITION MUST BE FUNCTIONAL AT LEVEL 1"):
 * every tower slot must be within Level-1 range of the enemy path, for
 * EVERY tower type — including the shortest-range one (Inferno).
 */
describe("tower slot placement vs. Level 1 range", () => {
  it("has at least 8 slots (spec asks for ~8-12)", () => {
    expect(TOWER_SLOTS.length).toBeGreaterThanOrEqual(8);
    expect(TOWER_SLOTS.length).toBeLessThanOrEqual(12);
  });

  it.each(TOWER_SLOTS.map((slot) => [slot.id, slot] as const))(
    "%s is within Level 1 range of every tower type",
    (_id, slot) => {
      const distanceToPath = distanceToPolyline(slot.position, ENEMY_PATH);

      for (const type of TOWER_TYPES) {
        const level1 = getTowerLevelStats(type, 1);
        expect(
          distanceToPath,
          `${slot.id} is ${distanceToPath.toFixed(1)} units from the path, ` +
            `but ${type} Level 1 range is only ${level1.range}`,
        ).toBeLessThanOrEqual(level1.range);
      }
    },
  );

  it("keeps some variety of close/medium/far slots (positioning still matters)", () => {
    const categories = new Set(TOWER_SLOTS.map((slot) => slot.distanceCategory));
    expect(categories.has("CLOSE")).toBe(true);
    expect(categories.has("MEDIUM")).toBe(true);
    expect(categories.has("FAR")).toBe(true);
  });

  it("no slot sits exactly on the path (would look broken)", () => {
    for (const slot of TOWER_SLOTS) {
      const distanceToPath = distanceToPolyline(slot.position, ENEMY_PATH);
      expect(distanceToPath).toBeGreaterThan(15);
    }
  });
});
