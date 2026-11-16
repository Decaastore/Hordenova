import * as THREE from "three";
import { WORLD_SIZE } from "@/config/gameBalance";
import type { Vector2 } from "@/utils/geometry";

/**
 * CAMPO DE BATALHA 3D — the game's logic lives on a flat 1000×600 world
 * plane (x right, y down). The 3D battlefield lays that plane on the ground:
 * 1 world unit = 1 three.js unit, X = x − 500, Z = y − 300, Y is up. Nothing
 * here ever moves the gameplay state; it only maps positions for drawing and
 * maps a tap on the ground back to a world position.
 */

/** Extra terrain drawn around the playable rectangle, so the camera never sees the world's edge. */
export const TERRAIN_MARGIN_X = 300;
export const TERRAIN_MARGIN_Z = 260;
export const TERRAIN_WIDTH = WORLD_SIZE.width + TERRAIN_MARGIN_X * 2;
export const TERRAIN_DEPTH = WORLD_SIZE.height + TERRAIN_MARGIN_Z * 2;

export function worldToThree(p: Vector2, y = 0): THREE.Vector3 {
  return new THREE.Vector3(p.x - WORLD_SIZE.width / 2, y, p.y - WORLD_SIZE.height / 2);
}

export function threeToWorld(v: THREE.Vector3): Vector2 {
  return { x: v.x + WORLD_SIZE.width / 2, y: v.z + WORLD_SIZE.height / 2 };
}

/** Yaw (around +Y) that turns a model facing +Z towards a world-space direction. */
export function worldDirToYaw(dir: Vector2): number {
  return Math.atan2(dir.x, dir.y);
}
