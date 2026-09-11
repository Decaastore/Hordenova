import { TOWER_SLOTS, ENEMY_PATH } from "@/data/mapWhisperingWoods";
import type { Vector2 } from "@/utils/geometry";

/**
 * PROVA DE CONCEITO HÍBRIDA (2D + 3D) — read-only bridge to the REAL
 * production map data. Nothing here duplicates or re-derives game logic;
 * it only crops a small window of the actual `TOWER_SLOTS`/`ENEMY_PATH`
 * (both imported straight from `@/data/mapWhisperingWoods`, the same
 * module the real game's `CanvasRenderer` uses) so the demo has a
 * recognizable, real slice of Whispering Woods rather than an invented
 * layout.
 */

/** World-space (game pixel) crop window — the portal + the first stretch of lane 1 + tower slot-1. */
export const CROP = { minX: -40, maxX: 300, minY: 40, maxY: 280 } as const;

/** 2D canvas pixels per world unit. */
export const DISPLAY_SCALE = 2;

export const CANVAS_W = (CROP.maxX - CROP.minX) * DISPLAY_SCALE;
export const CANVAS_H = (CROP.maxY - CROP.minY) * DISPLAY_SCALE;

const cropCenterX = (CROP.minX + CROP.maxX) / 2;
const cropCenterY = (CROP.minY + CROP.maxY) / 2;

/** The REAL slot-1 definition (position, id) — untouched, just looked up by id. */
export const HYBRID_TOWER_SLOT = TOWER_SLOTS.find((s) => s.id === "slot-1")!;

/**
 * The REAL enemy path, cropped to lane 1 only (y close to its actual
 * lane-1 height, ~120) — a wide Y band would also catch lane 2 (~y=300),
 * which sits inside this same X range further along the route and would
 * splice two disconnected stretches of the path together into one
 * nonsensical "segment."
 */
export const HYBRID_PATH_SEGMENT: Vector2[] = ENEMY_PATH.filter(
  (p) => p.x >= CROP.minX - 30 && p.x <= CROP.maxX + 30 && p.y >= 90 && p.y <= 150,
);

/** World (2D game) coordinates -> centered display-pixel offset (before the 3D tilt projection is applied). */
export function worldToDisplayPixels(p: Vector2): { px: number; py: number } {
  return { px: (p.x - cropCenterX) * DISPLAY_SCALE, py: (p.y - cropCenterY) * DISPLAY_SCALE };
}

/** Camera tilt off vertical (degrees) shared between the 2D<->3D alignment math and the camera setup itself. */
export const TILT_DEG = 32;
