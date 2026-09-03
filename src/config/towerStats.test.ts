import { describe, expect, it } from "vitest";
import { getTowerVisualStage, MAX_TOWER_LEVEL, TOWER_VISUAL_STAGE_COUNT } from "./towerStats";

describe("Tower Visual Evolution stages (Progression 2.0 spec section 9)", () => {
  it("level 1 is stage 1, MAX_TOWER_LEVEL is the final stage", () => {
    expect(getTowerVisualStage(1)).toBe(1);
    expect(getTowerVisualStage(MAX_TOWER_LEVEL)).toBe(TOWER_VISUAL_STAGE_COUNT);
  });

  it("stage is non-decreasing as level rises — never a downgrade from leveling up", () => {
    let prevStage = getTowerVisualStage(1);
    for (let level = 2; level <= MAX_TOWER_LEVEL; level++) {
      const stage = getTowerVisualStage(level);
      expect(stage).toBeGreaterThanOrEqual(prevStage);
      prevStage = stage;
    }
  });

  it("ships more than one stage — real evolution, not a single flat look", () => {
    expect(TOWER_VISUAL_STAGE_COUNT).toBeGreaterThanOrEqual(5);
  });

  it("clamps out-of-range levels instead of throwing", () => {
    expect(getTowerVisualStage(0)).toBe(1);
    expect(getTowerVisualStage(-5)).toBe(1);
    expect(getTowerVisualStage(999)).toBe(TOWER_VISUAL_STAGE_COUNT);
  });
});
