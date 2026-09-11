import * as THREE from "three";
import type { Vector2 } from "@/utils/geometry";
import { worldToDisplayPixels, TILT_DEG } from "./hybridWorldData";

/**
 * PROVA DE CONCEITO HÍBRIDA — the 2D<->3D alignment math.
 *
 * The 3D layer uses a tilted ORTHOGRAPHIC camera (not a perfectly
 * vertical top-down one) so the Brute/tower show real form instead of
 * reading as a flat icon from directly above — but the tilt is applied
 * in a way that keeps a ground-level point's SCREEN position identical
 * to where the 2D canvas already draws that same world coordinate.
 * Only a model's actual HEIGHT shifts it upward on screen relative to
 * its own ground footprint, exactly like a real object standing on a
 * map would.
 *
 * For a camera at `cameraPosition(D)` looking at the origin with
 * `up = (0,1,0)`, a world point's screen-space position works out to:
 *   screen_x ∝ -worldX
 *   screen_y ∝ sin(tilt)*worldY + cos(tilt)*worldZ
 * So placing a footprint (worldY = 0) at worldX = -px, worldZ = -py/cos(tilt)
 * makes it land exactly on the 2D canvas's (px, py) — and the model's
 * own height (worldY > 0) then naturally rises toward the camera on
 * screen, per the formula above, instead of needing a second transform.
 */
const TILT_RAD = THREE.MathUtils.degToRad(TILT_DEG);
export const TILT_COS = Math.cos(TILT_RAD);
export const TILT_SIN = Math.sin(TILT_RAD);

/** REAL game-world ground point -> this scene's Three.js (x, 0, z). */
export function footprintToThree(p: Vector2): [number, number, number] {
  const { px, py } = worldToDisplayPixels(p);
  return [-px, 0, -py / TILT_COS];
}

/** Camera position at `distance` from the origin along the tilt direction derived above (any positive distance works for an orthographic camera). */
export function cameraPosition(distance: number): [number, number, number] {
  return [0, TILT_COS * distance, -TILT_SIN * distance];
}
