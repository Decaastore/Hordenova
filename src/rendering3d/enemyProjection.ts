import * as THREE from "three";
import type { Vector2 } from "@/utils/geometry";
import { WORLD_SIZE } from "@/config/gameBalance";

/**
 * INIMIGOS 3D — the same tilted-orthographic alignment technique already
 * validated in `src/hybrid/hybridProjection.ts`, but generalized to the
 * REAL game's own coordinate transform (`CanvasRenderer.tsx`'s `resize()`:
 * `scale = Math.min(w/1000, h/600)`, centered, recomputed on every resize)
 * instead of the hybrid demo's fixed crop + fixed DISPLAY_SCALE. Read-only
 * reuse of `WORLD_SIZE` — nothing here reads or writes gameplay state.
 */

export const TILT_DEG = 32;
const TILT_RAD = THREE.MathUtils.degToRad(TILT_DEG);
export const TILT_COS = Math.cos(TILT_RAD);
export const TILT_SIN = Math.sin(TILT_RAD);

export interface ScreenTransform {
  /** CSS pixels per world unit — same value CanvasRenderer's resize() computes (pre-DPR). */
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/** Mirrors CanvasRenderer.tsx's resize() exactly, in CSS pixels (no DPR — r3f/Three already handles DPR internally). */
export function computeScreenTransform(width: number, height: number): ScreenTransform {
  const scale = Math.min(width / WORLD_SIZE.width, height / WORLD_SIZE.height);
  const offsetX = (width - WORLD_SIZE.width * scale) / 2;
  const offsetY = (height - WORLD_SIZE.height * scale) / 2;
  return { scale, offsetX, offsetY, width, height };
}

/**
 * World position -> Three ground position (y=0), aligned so it lands on
 * the exact same screen pixel the 2D canvas would draw that world point
 * at. Same derivation as hybridProjection.ts's `footprintToThree`: convert
 * to a canvas-center-relative pixel offset, then apply the camera tilt.
 */
export function worldToThreeGround(p: Vector2, t: ScreenTransform): [number, number, number] {
  const px = t.offsetX + p.x * t.scale - t.width / 2;
  const py = t.offsetY + p.y * t.scale - t.height / 2;
  return [-px, 0, -py / TILT_COS];
}

/** A world-space unit direction (e.g. EnemyInstance.direction) -> yaw (radians) around Three's Y axis. Scale cancels out of atan2, so only the sign/cos(tilt) asymmetry between the X and Y axes matters. */
export function worldDirectionToThreeYaw(dir: Vector2): number {
  return Math.atan2(-dir.x, -dir.y / TILT_COS);
}

export function cameraPosition(distance: number): [number, number, number] {
  return [0, TILT_COS * distance, -TILT_SIN * distance];
}
