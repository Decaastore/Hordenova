export interface Vector2 {
  x: number;
  y: number;
}

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shortest distance from `point` to the segment [a, b]. */
export function distanceToSegment(point: Vector2, a: Vector2, b: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return distance(point, a);

  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projection: Vector2 = { x: a.x + t * dx, y: a.y + t * dy };
  return distance(point, projection);
}

/** Shortest distance from `point` to any segment of the polyline `path`. */
export function distanceToPolyline(point: Vector2, path: readonly Vector2[]): number {
  if (path.length < 2) return path[0] ? distance(point, path[0]) : Infinity;

  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const d = distanceToSegment(point, a, b);
    if (d < min) min = d;
  }
  return min;
}

export function getPathLength(path: readonly Vector2[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += distance(path[i]!, path[i + 1]!);
  }
  return total;
}

export interface PathSample {
  position: Vector2;
  /** Unit direction vector of the segment the sample falls on. */
  direction: Vector2;
  /** True once `distanceTraveled` reaches or exceeds the path length. */
  finished: boolean;
}

/**
 * Walks `distanceTraveled` world units along `path` from its start and
 * returns the resulting position + facing direction. Used every tick to
 * move enemies without storing per-enemy segment indices.
 */
export function getPointAtDistance(
  path: readonly Vector2[],
  distanceTraveled: number,
): PathSample {
  if (path.length < 2) {
    const only = path[0] ?? { x: 0, y: 0 };
    return { position: only, direction: { x: 1, y: 0 }, finished: true };
  }

  let remaining = Math.max(distanceTraveled, 0);

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const segmentLength = distance(a, b);

    if (remaining <= segmentLength || i === path.length - 2) {
      const t = segmentLength === 0 ? 0 : Math.min(remaining / segmentLength, 1);
      const direction =
        segmentLength === 0
          ? { x: 1, y: 0 }
          : { x: (b.x - a.x) / segmentLength, y: (b.y - a.y) / segmentLength };
      const position: Vector2 = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
      const finished = i === path.length - 2 && remaining >= segmentLength;
      return { position, direction, finished };
    }

    remaining -= segmentLength;
  }

  const last = path[path.length - 1]!;
  return { position: last, direction: { x: 1, y: 0 }, finished: true };
}

/**
 * A point offset perpendicular from a point `t` (0..1) along segment [a, b],
 * `distance` world units to one `side` (1 or -1). Used to author tower
 * slots at an exact, known distance from the path instead of hand-picked
 * coordinates.
 */
export function offsetFromSegment(
  a: Vector2,
  b: Vector2,
  t: number,
  distanceFromPath: number,
  side: 1 | -1,
): Vector2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * side;
  const ny = (dx / length) * side;

  const basePoint: Vector2 = { x: a.x + dx * t, y: a.y + dy * t };
  return {
    x: basePoint.x + nx * distanceFromPath,
    y: basePoint.y + ny * distanceFromPath,
  };
}
