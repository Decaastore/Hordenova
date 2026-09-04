import { describe, expect, it } from "vitest";
import { ENEMY_PATH, TOWER_SLOTS, MIN_TOWER_SPACING, MIN_TOWER_TO_CASTLE_DISTANCE, PATH_DEFINITION, isTowerPositionValid } from "./mapWhisperingWoods";
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

describe("MIN_TOWER_SPACING structural rule (AUDITORIA E CORREÇÃO GERAL spec sections 50-55)", () => {
  it("no two tower slots sit closer together than MIN_TOWER_SPACING — the 'torres grudadas' bug this fixes", () => {
    for (let i = 0; i < TOWER_SLOTS.length; i++) {
      for (let j = i + 1; j < TOWER_SLOTS.length; j++) {
        const a = TOWER_SLOTS[i]!;
        const b = TOWER_SLOTS[j]!;
        const distance = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
        expect(distance, `${a.id} and ${b.id} are only ${distance.toFixed(1)} units apart`).toBeGreaterThanOrEqual(
          MIN_TOWER_SPACING,
        );
      }
    }
  });

  it("no slot sits closer to the castle gate than MIN_TOWER_TO_CASTLE_DISTANCE — the last tower before the castle, never on top of it", () => {
    const gate = PATH_DEFINITION.end;
    for (const slot of TOWER_SLOTS) {
      const distanceToGate = Math.hypot(slot.position.x - gate.x, slot.position.y - gate.y);
      expect(distanceToGate, `${slot.id} is only ${distanceToGate.toFixed(1)} units from the castle gate`).toBeGreaterThanOrEqual(
        MIN_TOWER_TO_CASTLE_DISTANCE,
      );
    }
  });

  it("positions are deterministic — the exact same 12 slots every time, never randomized across reloads", () => {
    const snapshotA = TOWER_SLOTS.map((s) => `${s.id}:${s.position.x},${s.position.y}`);
    const snapshotB = TOWER_SLOTS.map((s) => `${s.id}:${s.position.x},${s.position.y}`);
    expect(snapshotA).toEqual(snapshotB);
  });

  describe("isTowerPositionValid", () => {
    it("every real TOWER_SLOTS position validates as valid against every OTHER slot", () => {
      const positions = TOWER_SLOTS.map((s) => s.position);
      for (const slot of TOWER_SLOTS) {
        const others = positions.filter((p) => p !== slot.position);
        expect(isTowerPositionValid(slot.position, others)).toBeNull();
      }
    });

    it("rejects a position too close to an existing tower", () => {
      // y=20 is well clear of the real path (which sits at y>=120 everywhere) — isolates the spacing check.
      const existing = [{ x: 500, y: 20 }];
      const tooClose = { x: 500 + MIN_TOWER_SPACING / 2, y: 20 };
      expect(isTowerPositionValid(tooClose, existing)).toBe("TOO_CLOSE_TO_ANOTHER_TOWER");
    });

    it("accepts a position far enough from every existing tower", () => {
      const existing = [{ x: 500, y: 20 }];
      const farEnough = { x: 500 + MIN_TOWER_SPACING + 50, y: 20 };
      expect(isTowerPositionValid(farEnough, existing)).toBeNull();
    });

    it("rejects a position sitting on the path", () => {
      const onPath = ENEMY_PATH[Math.floor(ENEMY_PATH.length / 2)]!;
      expect(isTowerPositionValid(onPath, [])).toBe("ON_THE_PATH");
    });

    it("rejects a position too close to the castle gate", () => {
      const gate = PATH_DEFINITION.end;
      expect(isTowerPositionValid(gate, [])).toBe("TOO_CLOSE_TO_CASTLE_GATE");
    });

    it("rejects an out-of-bounds position", () => {
      expect(isTowerPositionValid({ x: -50, y: 100 }, [])).toBe("OUT_OF_BOUNDS");
      expect(isTowerPositionValid({ x: 999_999, y: 100 }, [])).toBe("OUT_OF_BOUNDS");
    });
  });
});
