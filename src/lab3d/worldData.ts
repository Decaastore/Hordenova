import { ENEMY_PATH, TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { WORLD_SIZE } from "@/config/gameBalance";

/**
 * TESTE VISUAL 3D — read-only bridge from the REAL Whispering Woods map
 * geometry (the 2D game's actual path curve + tower slot positions) into
 * 3D world-space coordinates. Only DATA is imported here (arrays of
 * points) — never `GameEngine`, `WaveManager`, or anything that runs
 * gameplay. The point is that this 3D scene is recognizably the same
 * place as the 2D map, not a new invented layout.
 *
 * 2D (x, y) in a WORLD_SIZE.width x WORLD_SIZE.height field maps to 3D
 * (x, 0, z) on the ground plane, uniformly scaled down and re-centered so
 * the whole field spans roughly [-26, 26] on X and [-16, 16] on Z — a
 * comfortable size for a real-world-unit-scaled Three.js scene (a 2-unit
 * tall tower reads as ~2m, matching everything else built at that scale).
 */
const SCALE = 0.052;

function to3D(x: number, y: number): [number, number] {
  return [(x - WORLD_SIZE.width / 2) * SCALE, (y - WORLD_SIZE.height / 2) * SCALE];
}

/** Dense path polyline in 3D ground-plane coordinates (y is always 0 here — terrain height is applied separately by whatever samples this). */
export const PATH_3D: readonly [number, number][] = ENEMY_PATH.map((p) => to3D(p.x, p.y));

export const TOWER_SLOTS_3D: readonly [number, number][] = TOWER_SLOTS.map((s) => to3D(s.position.x, s.position.y));

/** Total path length in 3D units — for constant-speed traversal (t in [0,1] -> distance-along-path, not just an index lerp). */
export function path3DLength(): number {
  let total = 0;
  for (let i = 1; i < PATH_3D.length; i++) {
    const [ax, az] = PATH_3D[i - 1]!;
    const [bx, bz] = PATH_3D[i]!;
    total += Math.hypot(bx - ax, bz - az);
  }
  return total;
}

/** Point + forward-facing yaw (radians) at `distance` along the 3D path, clamped to the path's ends. */
export function pointAtDistance3D(distance: number): { x: number; z: number; yaw: number } {
  let remaining = Math.max(0, distance);
  for (let i = 1; i < PATH_3D.length; i++) {
    const [ax, az] = PATH_3D[i - 1]!;
    const [bx, bz] = PATH_3D[i]!;
    const segLen = Math.hypot(bx - ax, bz - az);
    if (remaining <= segLen || i === PATH_3D.length - 1) {
      const t = segLen > 0 ? Math.min(1, remaining / segLen) : 0;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(bx - ax, bz - az) };
    }
    remaining -= segLen;
  }
  const [lx, lz] = PATH_3D[PATH_3D.length - 1]!;
  return { x: lx, z: lz, yaw: 0 };
}

export const CASTLE_POSITION_3D = PATH_3D[PATH_3D.length - 1]!;
export const PORTAL_POSITION_3D = PATH_3D[0]!;
