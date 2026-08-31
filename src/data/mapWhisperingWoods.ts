import { WORLD_SIZE } from "@/config/gameBalance";
import { offsetFromSegment, type Vector2 } from "@/utils/geometry";

/**
 * WHISPERING WOODS — first map.
 *
 * The enemy path is authored as waypoints; segments alternate between
 * horizontal and vertical runs to form a winding S-shaped road instead of
 * a straight line, per spec section 4-5.
 *
 * Tower slots are NOT hand-picked coordinates. Each slot is defined as an
 * exact perpendicular offset from a specific path segment
 * (segmentIndex, t, distance, side), computed by `offsetFromSegment`. This
 * guarantees every slot's distance to the path is a known, deliberately
 * chosen value instead of an eyeballed guess — which is exactly what
 * caused the "middle towers too far from the path" bug this map is meant
 * to avoid. `towerPositions.test.ts` verifies every slot is in range of
 * every tower's Level 1 range.
 */

export const ENEMY_PATH: readonly Vector2[] = [
  { x: 0, y: 300 }, // VOID PORTAL (entry)
  { x: 170, y: 300 },
  { x: 170, y: 110 },
  { x: 420, y: 110 },
  { x: 420, y: 430 },
  { x: 660, y: 430 },
  { x: 660, y: 170 },
  { x: 860, y: 170 },
  { x: 860, y: 300 },
  { x: 1000, y: 300 }, // LAST BASTION (exit)
];

export type SlotDistanceCategory = "CLOSE" | "MEDIUM" | "FAR";

export interface TowerSlotDefinition {
  id: string;
  position: Vector2;
  distanceCategory: SlotDistanceCategory;
}

interface SlotSeed {
  id: string;
  segmentIndex: number;
  t: number;
  distanceFromPath: number;
  side: 1 | -1;
  distanceCategory: SlotDistanceCategory;
}

const SLOT_SEEDS: readonly SlotSeed[] = [
  { id: "slot-1", segmentIndex: 0, t: 0.75, distanceFromPath: 75, side: 1, distanceCategory: "MEDIUM" },
  { id: "slot-2", segmentIndex: 1, t: 0.3, distanceFromPath: 95, side: -1, distanceCategory: "FAR" },
  { id: "slot-3", segmentIndex: 2, t: 0.3, distanceFromPath: 70, side: -1, distanceCategory: "MEDIUM" },
  { id: "slot-4", segmentIndex: 2, t: 0.7, distanceFromPath: 48, side: 1, distanceCategory: "CLOSE" },
  { id: "slot-5", segmentIndex: 3, t: 0.25, distanceFromPath: 45, side: 1, distanceCategory: "CLOSE" },
  { id: "slot-6", segmentIndex: 3, t: 0.5, distanceFromPath: 80, side: -1, distanceCategory: "MEDIUM" },
  { id: "slot-7", segmentIndex: 3, t: 0.75, distanceFromPath: 95, side: 1, distanceCategory: "FAR" },
  { id: "slot-8", segmentIndex: 4, t: 0.4, distanceFromPath: 65, side: 1, distanceCategory: "MEDIUM" },
  { id: "slot-9", segmentIndex: 5, t: 0.3, distanceFromPath: 90, side: 1, distanceCategory: "FAR" },
  { id: "slot-10", segmentIndex: 5, t: 0.65, distanceFromPath: 48, side: -1, distanceCategory: "CLOSE" },
  { id: "slot-11", segmentIndex: 6, t: 0.5, distanceFromPath: 72, side: -1, distanceCategory: "MEDIUM" },
  { id: "slot-12", segmentIndex: 7, t: 0.5, distanceFromPath: 85, side: -1, distanceCategory: "FAR" },
];

export const TOWER_SLOTS: readonly TowerSlotDefinition[] = SLOT_SEEDS.map((seed) => {
  const a = ENEMY_PATH[seed.segmentIndex]!;
  const b = ENEMY_PATH[seed.segmentIndex + 1]!;
  return {
    id: seed.id,
    position: offsetFromSegment(a, b, seed.t, seed.distanceFromPath, seed.side),
    distanceCategory: seed.distanceCategory,
  };
});

export const MAP_WORLD_SIZE = WORLD_SIZE;
