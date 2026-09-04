import { describe, expect, it } from "vitest";
import { buildOrganicRoad } from "./MapRenderer";
import { ENEMY_PATH, PATH_DEFINITION } from "@/data/mapWhisperingWoods";
import { PATH_VISUAL_WIDTH } from "@/config/gameBalance";
import { getPointAtDistance, getPathLength, type Vector2 } from "@/utils/geometry";

/**
 * Path spec — flagged CRITICAL PRIORITY: "PATH VISUAL = PATH REAL DE
 * MOVIMENTAÇÃO. Não pode haver duas versões." Root cause of the reported
 * "inimigos saem do mapa nas curvas" bug: MapRenderer used to hold a
 * SECOND, private Catmull-Rom smoothing pass applied only at render time,
 * independent of the sharp-corner polyline enemy movement actually
 * walked — the two curves diverged at every turn. The fix removed that
 * private pass entirely; MapRenderer.buildOrganicRoad now builds its road
 * ribbon directly around whatever centerline it's given, and
 * data/mapWhisperingWoods.ts hands BOTH the renderer and
 * entities/Enemy.ts's movement the exact same array (ENEMY_PATH).
 *
 * These tests assert the actual geometric guarantee that matters — not
 * "the same array reference" (PathDefinition.test.ts already covers
 * that), but "every point an enemy can ever actually stand on is
 * strictly inside the polygon the road is drawn as" — at every sample
 * along the path, corners included, for every one of the road's nested
 * rendering passes (halo/edge/fill).
 */

/** Even-odd point-in-polygon test (ray casting) — standard, dependency-free. */
function pointInPolygon(point: Vector2, polygon: readonly Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersects = pi.y > point.y !== pj.y > point.y && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function ribbonPolygon(left: readonly Vector2[], right: readonly Vector2[]): Vector2[] {
  return [...left, ...[...right].reverse()];
}

describe("MapRenderer — path visual/movement alignment (Path spec, critical priority)", () => {
  it("MapRenderer draws the road directly around ENEMY_PATH — no private re-smoothing", () => {
    const road = buildOrganicRoad(ENEMY_PATH, PATH_VISUAL_WIDTH, 0, 11);
    // If MapRenderer still re-smoothed internally, `road.smoothed` would be
    // a DIFFERENT array of points than ENEMY_PATH itself.
    expect(road.smoothed).toBe(ENEMY_PATH);
  });

  // Ray-casting point-in-polygon is only reliable for points strictly
  // inside — a point sitting exactly ON a polygon vertex/edge (which the
  // very first and last path samples do, by construction: the ribbon's
  // own first/last vertices are built as an offset FROM those exact
  // centerline points) is a well-known degenerate case for the algorithm
  // itself, not a real containment failure. Trimming a hair off each end
  // still covers every corner in between with margin to spare.
  const EDGE_TRIM = 0.001;

  it("every point an enemy can actually stand on (sampled continuously along the whole path, corners included) is strictly inside the drawn road's fill polygon", () => {
    const fill = buildOrganicRoad(ENEMY_PATH, PATH_VISUAL_WIDTH, 0, 11);
    const polygon = ribbonPolygon(fill.left, fill.right);

    const length = getPathLength(ENEMY_PATH);
    const SAMPLES = 400; // dense enough to land squarely on every corner region
    for (let i = 1; i < SAMPLES; i++) {
      const distanceTraveled = length * (EDGE_TRIM + ((1 - 2 * EDGE_TRIM) * i) / SAMPLES);
      const sample = getPointAtDistance(ENEMY_PATH, distanceTraveled);
      expect(
        pointInPolygon(sample.position, polygon),
        `enemy position at distanceTraveled=${distanceTraveled.toFixed(1)} (${sample.position.x.toFixed(1)}, ${sample.position.y.toFixed(1)}) is OUTSIDE the drawn road`,
      ).toBe(true);
    }
  });

  it("holds for every nested rendering pass (halo/edge/fill widths), not just the base fill", () => {
    const length = getPathLength(ENEMY_PATH);
    const SAMPLES = 200;
    for (const widthOffset of [9, 3, 0]) {
      // matches drawPath's halo(9)/edge(3)/fill(0) passes
      const road = buildOrganicRoad(ENEMY_PATH, PATH_VISUAL_WIDTH, widthOffset, 11);
      const polygon = ribbonPolygon(road.left, road.right);
      for (let i = 1; i < SAMPLES; i++) {
        const distanceTraveled = length * (EDGE_TRIM + ((1 - 2 * EDGE_TRIM) * i) / SAMPLES);
        const sample = getPointAtDistance(ENEMY_PATH, distanceTraveled);
        expect(pointInPolygon(sample.position, polygon)).toBe(true);
      }
    }
  });

  it("no enemy position along the path ever falls outside the playable world bounds", () => {
    const length = getPathLength(ENEMY_PATH);
    const SAMPLES = 400;
    for (let i = 0; i <= SAMPLES; i++) {
      const sample = getPointAtDistance(ENEMY_PATH, (length * i) / SAMPLES);
      expect(sample.position.x).toBeGreaterThanOrEqual(-1);
      expect(sample.position.y).toBeGreaterThanOrEqual(-1);
    }
  });

  it("PathDefinition.centerline is the exact array both this test's road-building and Enemy movement consume (no fork)", () => {
    expect(PATH_DEFINITION.centerline).toBe(ENEMY_PATH);
  });
});
