import * as THREE from "three";
import type { Vector2 } from "@/utils/geometry";
import { distanceToPolyline } from "@/utils/geometry";
import { ENEMY_PATH } from "@/data/mapWhisperingWoods";
import { WORLD_SIZE, PATH_VISUAL_WIDTH } from "@/config/gameBalance";
import { fbmNoise2D } from "@/lab3d/noise";
import { buildTaperedTube } from "@/lab3d/geometryUtils";
import { mulberry32 } from "@/lab3d/rng";
import { worldToLocalGround } from "../enemyProjection";
import type { BiomePalette } from "@/rendering/biomes";

/**
 * MUNDO 3D — terrain shape is a pure function of world position, built
 * ONCE from the SAME `ENEMY_PATH` polyline that both enemy movement and
 * the 2D `drawPath` road walk (data/mapWhisperingWoods.ts's single source
 * of truth) — never a second hand-authored curve. The road stays flat
 * near the path (a real gameplay readability requirement, not just
 * decoration) and the surrounding terrain rolls via layered noise the
 * farther it gets from the route.
 */

const NOISE_FREQ = 0.0055;
const MAX_ELEVATION = 22;
const FLATTEN_INNER = PATH_VISUAL_WIDTH * 1.35;
const FLATTEN_OUTER = PATH_VISUAL_WIDTH * 2.6;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Ground elevation (Three Y, local-unscaled units) at a given WORLD position — flat near the road, rolling farther away. */
export function terrainElevationAt(worldX: number, worldY: number): number {
  const raw = fbmNoise2D(worldX * NOISE_FREQ, worldY * NOISE_FREQ, 4) - 0.5;
  const distanceFromRoad = distanceToPolyline({ x: worldX, y: worldY }, ENEMY_PATH);
  const roughness = smoothstep(FLATTEN_INNER, FLATTEN_OUTER, distanceFromRoad);
  return raw * MAX_ELEVATION * roughness;
}

function parseBiomeColor(css: string): THREE.Color {
  const rgbaMatch = css.match(/rgba?\(([^)]+)\)/);
  if (rgbaMatch) {
    const [r, g, b] = rgbaMatch[1]!.split(",").map((n) => parseFloat(n.trim()));
    return new THREE.Color(r! / 255, g! / 255, b! / 255);
  }
  return new THREE.Color(css);
}

const GRID_COLS = 90;
const GRID_ROWS = 54;

/**
 * Ground mesh grid, built in the SAME "local unscaled ground" space as
 * `worldToLocalGround` — the whole mesh is later scaled by the real screen
 * transform's `scale`, never repositioned or rebuilt per-frame/resize.
 * Vertex-colored per-vertex from the active biome's palette (moss/earth
 * tone by height + a second noise field for patchiness), so the terrain
 * automatically matches whatever biome the 2D map is already using —
 * zero new palette authoring needed.
 */
export function buildGroundGeometry(palette: BiomePalette): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const base = parseBiomeColor(palette.groundBase);
  const shadowed = parseBiomeColor(palette.groundShadowed);
  const accentA = parseBiomeColor(palette.groundAccentA);
  const accentB = parseBiomeColor(palette.groundAccentB);
  const tmp = new THREE.Color();

  for (let j = 0; j <= GRID_ROWS; j++) {
    const worldY = (j / GRID_ROWS) * WORLD_SIZE.height;
    for (let i = 0; i <= GRID_COLS; i++) {
      const worldX = (i / GRID_COLS) * WORLD_SIZE.width;
      const elevation = terrainElevationAt(worldX, worldY);
      const [lx, , lz] = worldToLocalGround({ x: worldX, y: worldY });
      positions.push(lx, elevation, lz);

      const heightNorm = Math.max(0, Math.min(1, elevation / MAX_ELEVATION + 0.5));
      const moisture = fbmNoise2D(worldX * NOISE_FREQ * 2.4 + 91, worldY * NOISE_FREQ * 2.4 + 47, 3);

      tmp.copy(base).lerp(shadowed, 1 - heightNorm);
      const patchTarget = moisture > 0.5 ? accentA : accentB;
      tmp.lerp(patchTarget, Math.max(0, (Math.abs(moisture - 0.5) - 0.08) * 1.4));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  const cols1 = GRID_COLS + 1;
  for (let j = 0; j < GRID_ROWS; j++) {
    for (let i = 0; i < GRID_COLS; i++) {
      const a = j * cols1 + i;
      const b = a + 1;
      const c = a + cols1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface MountainPlacement {
  position: [number, number, number];
  scale: number;
  geometry: THREE.BufferGeometry;
}

/**
 * Distant background silhouettes — lofted (via the same `buildTaperedTube`
 * technique the creature bodies use), never a bare `ConeGeometry` primitive:
 * a handful of irregular, leaning peaks scattered just beyond the playable
 * terrain edge, low-poly enough to cost nothing but reading as sculpted
 * rock rather than an assembled primitive. Deterministic (fixed seed) so
 * they never pop/shift between renders.
 */
export function buildMountainSilhouettes(count: number): MountainPlacement[] {
  const rand = mulberry32(777);
  const placements: MountainPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const baseRadius = 55 + rand() * 45;
    const height = 140 + rand() * 120;
    const segments = 3 + Math.floor(rand() * 2);
    const points: THREE.Vector3[] = [];
    const radii: number[] = [];
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const lean = (rand() - 0.5) * baseRadius * 0.6 * t;
      points.push(new THREE.Vector3(lean, t * height, (rand() - 0.5) * baseRadius * 0.3 * t));
      radii.push(baseRadius * (1 - t) * (0.85 + rand() * 0.3) + (t === 1 ? 0 : 0));
    }
    const geometry = buildTaperedTube(points, radii, 6 + Math.floor(rand() * 2), true);

    // Scatter around the terrain's far/side edges (never in front, so it
    // never competes with the playable area) in WORLD space, then project
    // through the same local-ground math everything else uses.
    const edge = Math.floor(rand() * 3); // 0 = far (north), 1 = left, 2 = right
    let worldX: number;
    let worldY: number;
    if (edge === 0) {
      worldX = rand() * WORLD_SIZE.width;
      worldY = -80 - rand() * 160;
    } else if (edge === 1) {
      worldX = -80 - rand() * 160;
      worldY = rand() * WORLD_SIZE.height;
    } else {
      worldX = WORLD_SIZE.width + 80 + rand() * 160;
      worldY = rand() * WORLD_SIZE.height;
    }
    const [lx, , lz] = worldToLocalGround({ x: worldX, y: worldY });
    placements.push({ position: [lx, 0, lz], scale: 1, geometry });
  }
  return placements;
}

/**
 * Road ribbon following the exact `ENEMY_PATH` polyline (never re-smoothed
 * — see the module doc comment), a thin strip offset perpendicular to
 * each segment by half `PATH_VISUAL_WIDTH`, sitting just above the
 * (flattened) ground to avoid z-fighting. Center/edge vertex-color lerp
 * gives it a worn "rut" look without a second texture.
 */
export function buildRoadGeometry(palette: BiomePalette): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const halfWidth = PATH_VISUAL_WIDTH / 2;

  const fill = parseBiomeColor(palette.roadFill);
  const edge = parseBiomeColor(palette.roadEdge);
  const tmp = new THREE.Color();

  const pushRing = (p: Vector2, normalX: number, normalY: number): void => {
    const left: Vector2 = { x: p.x + normalX * halfWidth, y: p.y + normalY * halfWidth };
    const right: Vector2 = { x: p.x - normalX * halfWidth, y: p.y - normalY * halfWidth };
    const elevationHere = terrainElevationAt(p.x, p.y) + 0.6;
    const [lxL, , lzL] = worldToLocalGround(left);
    const [lxR, , lzR] = worldToLocalGround(right);
    positions.push(lxL, elevationHere, lzL, lxR, elevationHere, lzR);
    tmp.copy(edge).lerp(fill, 0.85);
    colors.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b);
  };

  for (let i = 0; i < ENEMY_PATH.length; i++) {
    const p = ENEMY_PATH[i]!;
    const prev = ENEMY_PATH[Math.max(0, i - 1)]!;
    const next = ENEMY_PATH[Math.min(ENEMY_PATH.length - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    pushRing(p, -dy / len, dx / len);
  }

  for (let i = 0; i < ENEMY_PATH.length - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
