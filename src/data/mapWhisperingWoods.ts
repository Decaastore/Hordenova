import { PATH_VISUAL_WIDTH, WORLD_SIZE } from "@/config/gameBalance";
import { buildCatmullRomSpline, distanceToPolyline, offsetFromSegment, type Vector2 } from "@/utils/geometry";

/**
 * WHISPERING WOODS — first map.
 *
 * Composition: entrance (VOID PORTAL) -> a 3-lane serpentine field of
 * battle -> a final defense corridor -> LAST BASTION (the castle gate),
 * so the route reads as a real journey toward one destination rather than
 * a loose loop that happens to end near a structure. Tower slots cluster
 * into the two gaps between lanes (path -> build zones flanking it ->
 * base), classic tower-defense structure, not scattered decorative dots.
 *
 * PATH SYSTEM — single source of truth (see PathDefinition below).
 * `PATH_CONTROL_POINTS` are a SPARSE, sharp-corner route description —
 * only used to (a) generate the actual walked/drawn curve once, and (b)
 * anchor tower slots via `offsetFromSegment`. Nothing walks or draws
 * these control points directly; per-segment sharp corners in a set of
 * only 6 points would make MapRenderer's road cut each turn differently
 * from a naive re-smoothing done independently at render time — which is
 * exactly the bug this architecture fixes (see PathDefinition's doc
 * comment). `ENEMY_PATH` — the dense, already-curved polyline both the
 * renderer and enemy movement consume — is derived from the control
 * points exactly ONCE, right here, via the shared
 * `buildCatmullRomSpline` (utils/geometry.ts). There is no second
 * smoothing pass anywhere else in the codebase.
 */

const PATH_CONTROL_POINTS: readonly Vector2[] = [
  { x: 0, y: 120 }, // VOID PORTAL (entry) — lane 1 start
  { x: 800, y: 120 }, // lane 1 end
  { x: 800, y: 300 }, // turn down into lane 2
  { x: 150, y: 300 }, // lane 2 end
  { x: 150, y: 480 }, // turn down into the final defense corridor
  { x: 1000, y: 480 }, // LAST BASTION (castle gate) — corridor end
];

/**
 * The actual path — a dense, pre-curved polyline sampled from
 * PATH_CONTROL_POINTS via Catmull-Rom (14 samples/segment is dense enough
 * that walking its straight sub-segments, exactly like the sparse
 * version, reads as a smooth curve both on screen and to the naked eye of
 * enemy movement). THIS is what both `entities/Enemy.ts`'s
 * `getPointAtDistance` and `rendering/MapRenderer.ts`'s `drawPath` walk —
 * see PathDefinition below for why that single-source guarantee matters.
 */
export const ENEMY_PATH: readonly Vector2[] = buildCatmullRomSpline(PATH_CONTROL_POINTS, 14);

/**
 * PathDefinition — single source of truth for the route (Path spec,
 * flagged CRITICAL PRIORITY: "PATH VISUAL = PATH REAL DE MOVIMENTAÇÃO.
 * Não pode haver duas versões.").
 *
 * ROOT CAUSE this fixes: MapRenderer used to hold its OWN private
 * Catmull-Rom smoothing (`buildSmoothedPath`/`catmullRom`), applied only
 * at render time, purely for visual polish — while enemy movement walked
 * the sparse, sharp-corner control points directly via
 * `getPointAtDistance`. Both ultimately read the same 6 waypoints, so on
 * paper they were "the same path" — but a Catmull-Rom spline through a
 * sharp 90-degree turn does NOT pass through that corner the way a
 * straight-segment walk does: it visibly cuts the corner. The result was
 * a road drawn as a smooth curve while enemies still walked the sharp
 * angle underneath it — at every turn, the enemy's true position could
 * sit outside the curve MapRenderer had drawn as "the road", i.e.
 * exactly the reported "inimigos saem do mapa nas curvas" bug.
 *
 * The fix: smoothing happens ONCE, here, producing `ENEMY_PATH` — a
 * concrete, already-curved dense polyline. `entities/Enemy.ts` walks it
 * with the exact same straight-sub-segment `getPointAtDistance` as
 * before (no behavior change needed there — a dense polyline IS a curve
 * for movement purposes), and `rendering/MapRenderer.ts`'s `drawPath` now
 * builds its road ribbon directly around this SAME array — no private
 * re-smoothing left in that file at all. There is structurally only one
 * curve in the game now, not two independently-computed approximations
 * of the same route.
 */
export interface PathDefinition {
  /** The sparse, sharp-corner route description the actual curve was generated from — kept for tooling/slot placement, never walked or drawn directly. */
  readonly controlPoints: readonly Vector2[];
  /** The dense, pre-curved polyline — THE path. The exact same array reference used by both drawing and movement. */
  readonly centerline: readonly Vector2[];
  readonly start: Vector2;
  readonly end: Vector2;
  /** World units — matches gameBalance.ts's PATH_VISUAL_WIDTH, the road's rendered (and minimum-safe) width. */
  readonly width: number;
}

export const PATH_DEFINITION: PathDefinition = {
  controlPoints: PATH_CONTROL_POINTS,
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
// segmentIndex here refers to PATH_CONTROL_POINTS' 5 segments (the sparse
// route), NOT the dense ENEMY_PATH — slot placement only needs a rough
// perpendicular anchor, not the exact walked curve.
//
// slot-9..slot-12 sit on the FINAL segment (the defense corridor leading
// to the castle gate). Their t values are deliberately capped well below
// 1.0 (max 0.68) so the LAST slot still leaves a real, visually and
// tactically clear gap before the gate — "last line of defense before the
// castle", never on top of it (Map spec section 14).
// AUDITORIA E CORREÇÃO GERAL spec sections 50-52 — MIN_TOWER_SPACING
// (see the exported constant + isTowerPositionValid below). Four pairs
// originally converged on the same "gap between lanes" corner from
// different segments/sides and ended up far closer together than intended
// (slot-2/slot-7 as close as 20 units apart — visibly "grudadas"): fixed by
// nudging only the offending seeds' `t` (position along their own lane)
// further from the shared corner, never touching `distanceFromPath`/`side`
// (which is what the Level-1-range and CLOSE/MEDIUM/FAR-variety tests key
// off), so every other existing guarantee about this map stays intact.
const SLOT_SEEDS: readonly SlotSeed[] = [
  { id: "slot-1", segmentIndex: 0, t: 0.12, distanceFromPath: 40, side: 1, distanceCategory: "CLOSE" },
  { id: "slot-2", segmentIndex: 0, t: 0.35, distanceFromPath: 75, side: 1, distanceCategory: "FAR" },
  // 45 used to place this right where the road's soft edge sits, since
  // Stormcaller's wide stone plinth reaches further from its anchor than
  // the other towers' bases — pushed out to keep every tower's footprint
  // clear of the path regardless of which type occupies the slot.
  { id: "slot-3", segmentIndex: 0, t: 0.65, distanceFromPath: 65, side: -1, distanceCategory: "CLOSE" },
  { id: "slot-4", segmentIndex: 1, t: 0.5, distanceFromPath: 55, side: 1, distanceCategory: "MEDIUM" },
  // t nudged from 0.2 to 0.35 — was converging on the lane-1/lane-2 corner
  // right next to slot-4 (75.7 units apart); still the same FAR gap-between
  // -lanes placement, just further along its own lane.
  { id: "slot-5", segmentIndex: 2, t: 0.35, distanceFromPath: 80, side: 1, distanceCategory: "FAR" },
  { id: "slot-6", segmentIndex: 2, t: 0.5, distanceFromPath: 40, side: -1, distanceCategory: "CLOSE" },
  // t nudged from 0.8 to 0.55 — was landing within 20 units of slot-2
  // (both anchored to the same gap between lane 1 and lane 2).
  { id: "slot-7", segmentIndex: 2, t: 0.55, distanceFromPath: 85, side: 1, distanceCategory: "FAR" },
  { id: "slot-8", segmentIndex: 3, t: 0.5, distanceFromPath: 50, side: -1, distanceCategory: "MEDIUM" },
  // t nudged from 0.12 to 0.2 — was converging on the lane-2/corridor
  // corner right next to slot-8 (68.8 units apart).
  { id: "slot-9", segmentIndex: 4, t: 0.2, distanceFromPath: 45, side: -1, distanceCategory: "CLOSE" },
  // t nudged from 0.32 to 0.5 — was landing within 80 units of slot-6
  // (a different segment/side that happens to fold back nearby in world
  // space). Still comfortably before slot-11/slot-12 further up the corridor.
  { id: "slot-10", segmentIndex: 4, t: 0.5, distanceFromPath: 80, side: -1, distanceCategory: "FAR" },
  { id: "slot-11", segmentIndex: 4, t: 0.5, distanceFromPath: 40, side: 1, distanceCategory: "CLOSE" },
  // The LAST tower slot — pulled back from the old t=0.88 (which sat
  // ~30 world units from the castle set-piece, effectively on top of the
  // gate) to t=0.68, a comfortable ~150+ unit clearance from the gate
  // while still reading as the final, most-forward defensive position.
  { id: "slot-12", segmentIndex: 4, t: 0.68, distanceFromPath: 55, side: -1, distanceCategory: "MEDIUM" },
];

/**
 * AUDITORIA E CORREÇÃO GERAL spec sections 50-52 — the structural rule
 * itself. No two tower slots may sit closer than this together (accounts
 * for a tower's own visual footprint — base/platform/shadow/idle VFX —
 * being roughly 60-80 units across at the largest, per rendering/
 * EntityRenderer.ts's tower silhouettes), and no slot may sit closer than
 * this to the castle gate (the "last tower before the castle" clearance —
 * spec section 53).
 */
export const MIN_TOWER_SPACING = 90;
export const MIN_TOWER_TO_CASTLE_DISTANCE = 120;

/**
 * AUDITORIA E CORREÇÃO GERAL spec section 52 — genuine structural
 * validation, not just a design-time assertion: checks spacing against
 * every OTHER already-placed tower, minimum distance to the enemy path
 * (a slot sitting exactly on the road would look broken), the castle gate,
 * and the map's own bounds. Returns the specific reason a position fails,
 * or null when it's valid — usable both by this map's own test suite
 * (validating every hand-authored TOWER_SLOTS entry satisfies its own
 * rule) and by any future freeform/procedural placement without
 * duplicating the rule a second time.
 */
export function isTowerPositionValid(
  position: Vector2,
  existingPositions: readonly Vector2[],
  path: readonly Vector2[] = ENEMY_PATH,
  castleGate: Vector2 = PATH_DEFINITION.end,
): string | null {
  if (position.x < 0 || position.x > WORLD_SIZE.width || position.y < 0 || position.y > WORLD_SIZE.height) {
    return "OUT_OF_BOUNDS";
  }
  const distanceToGate = Math.hypot(position.x - castleGate.x, position.y - castleGate.y);
  if (distanceToGate < MIN_TOWER_TO_CASTLE_DISTANCE) return "TOO_CLOSE_TO_CASTLE_GATE";
  const distanceToPath = distanceToPolyline(position, path);
  if (distanceToPath <= 15) return "ON_THE_PATH";
  for (const other of existingPositions) {
    if (other === position) continue;
    const distance = Math.hypot(position.x - other.x, position.y - other.y);
    if (distance < MIN_TOWER_SPACING) return "TOO_CLOSE_TO_ANOTHER_TOWER";
  }
  return null;
}

export const TOWER_SLOTS: readonly TowerSlotDefinition[] = SLOT_SEEDS.map((seed) => {
  const a = PATH_CONTROL_POINTS[seed.segmentIndex]!;
  const b = PATH_CONTROL_POINTS[seed.segmentIndex + 1]!;
  return {
    id: seed.id,
    position: offsetFromSegment(a, b, seed.t, seed.distanceFromPath, seed.side),
    distanceCategory: seed.distanceCategory,
  };
});

export const MAP_WORLD_SIZE = WORLD_SIZE;
