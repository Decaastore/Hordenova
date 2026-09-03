import { PATH_VISUAL_WIDTH, WORLD_SIZE } from "@/config/gameBalance";
import { offsetFromSegment, type Vector2 } from "@/utils/geometry";

/**
 * WHISPERING WOODS — first map.
 *
 * Composition rebuild: a compact 3-lane serpentine that fills most of the
 * 1000x600 canvas (instead of one loose S-curve with large empty
 * rectangles), so the road reads as the dominant feature and towers can
 * cluster into a real defensive line between lanes — classic tower-defense
 * structure (path -> build zones flanking it -> base), not scattered
 * decorative dots.
 *
 * Tower slots are NOT hand-picked coordinates. Each slot is defined as an
 * exact perpendicular offset from a specific path segment
 * (segmentIndex, t, distance, side), computed by `offsetFromSegment`. This
 * guarantees every slot's distance to the path is a known, deliberately
 * chosen value instead of an eyeballed guess. `towerPositions.test.ts`
 * verifies every slot is in range of every tower's Level 1 range.
 */

export const ENEMY_PATH: readonly Vector2[] = [
  { x: 0, y: 120 }, // VOID PORTAL (entry) — lane 1 start
  { x: 800, y: 120 }, // lane 1 end
  { x: 800, y: 300 }, // turn down into lane 2
  { x: 150, y: 300 }, // lane 2 end
  { x: 150, y: 480 }, // turn down into lane 3
  { x: 1000, y: 480 }, // LAST BASTION (exit) — lane 3 end
];

/**
 * PathDefinition (Progression 2.0 spec section 24-27 — flagged CRITICAL
 * PRIORITY): a formal wrapper around the ONE array both the renderer and
 * enemy movement already share. Auditing this codebase found no actual
 * duplication bug — rendering/CanvasRenderer.tsx's `drawPath(ctx,
 * ENEMY_PATH, ...)` and entities/Enemy.ts's movement (`getPointAtDistance(
 * ENEMY_PATH, ...)`) already both import this exact same `ENEMY_PATH`
 * constant, so the drawn curve and the traversed curve are, by
 * construction, the same object reference — not just numerically equal
 * data that happened to match.
 *
 * This wrapper exists so that guarantee is DOCUMENTED and NAMED (matching
 * the spec's "PathDefinition" concept) instead of being an implicit
 * consequence of two files importing the same constant, and so any future
 * path-related calculation has one obvious place to attach to instead of
 * re-deriving its own copy. `data/PathDefinition.test.ts` asserts the
 * identity (`===`) that makes this true, so any future refactor that
 * accidentally forks the path (a hardcoded array literal somewhere, a
 * cloned copy) fails CI immediately instead of silently drifting.
 */
export interface PathDefinition {
  /** The exact same array reference used by both drawing and movement — see this module's doc comment. */
  readonly centerline: readonly Vector2[];
  readonly start: Vector2;
  readonly end: Vector2;
  /** World units — matches gameBalance.ts's PATH_VISUAL_WIDTH, the road's rendered width. */
  readonly width: number;
}

export const PATH_DEFINITION: PathDefinition = {
  centerline: ENEMY_PATH,
  start: ENEMY_PATH[0]!,
  end: ENEMY_PATH[ENEMY_PATH.length - 1]!,
  width: PATH_VISUAL_WIDTH,
};

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

// Slots cluster into the two gaps between lanes (close, dual-lane-range
// "overlap" positions included) plus a couple flanking each turn, so
// several placements matter for the same stretch of road — real
// positioning decisions instead of one obviously-best spot per lane.
const SLOT_SEEDS: readonly SlotSeed[] = [
  { id: "slot-1", segmentIndex: 0, t: 0.12, distanceFromPath: 40, side: 1, distanceCategory: "CLOSE" },
  { id: "slot-2", segmentIndex: 0, t: 0.35, distanceFromPath: 75, side: 1, distanceCategory: "FAR" },
  // 45 used to place this right where the road's soft edge sits, since
  // Stormcaller's wide stone plinth reaches further from its anchor than
  // the other towers' bases — pushed out to keep every tower's footprint
  // clear of the path regardless of which type occupies the slot.
  { id: "slot-3", segmentIndex: 0, t: 0.65, distanceFromPath: 65, side: -1, distanceCategory: "CLOSE" },
  { id: "slot-4", segmentIndex: 1, t: 0.5, distanceFromPath: 55, side: 1, distanceCategory: "MEDIUM" },
  { id: "slot-5", segmentIndex: 2, t: 0.2, distanceFromPath: 80, side: 1, distanceCategory: "FAR" },
  { id: "slot-6", segmentIndex: 2, t: 0.5, distanceFromPath: 40, side: -1, distanceCategory: "CLOSE" },
  { id: "slot-7", segmentIndex: 2, t: 0.8, distanceFromPath: 85, side: 1, distanceCategory: "FAR" },
  { id: "slot-8", segmentIndex: 3, t: 0.5, distanceFromPath: 50, side: -1, distanceCategory: "MEDIUM" },
  { id: "slot-9", segmentIndex: 4, t: 0.15, distanceFromPath: 45, side: -1, distanceCategory: "CLOSE" },
  { id: "slot-10", segmentIndex: 4, t: 0.4, distanceFromPath: 80, side: -1, distanceCategory: "FAR" },
  { id: "slot-11", segmentIndex: 4, t: 0.65, distanceFromPath: 40, side: 1, distanceCategory: "CLOSE" },
  { id: "slot-12", segmentIndex: 4, t: 0.88, distanceFromPath: 55, side: -1, distanceCategory: "MEDIUM" },
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
