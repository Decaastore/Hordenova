/**
 * Global, non-entity-specific balance constants.
 * Any number here can be tuned without touching engine/entity code.
 */

export const GAME_SPEEDS = [1, 2, 4] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

export const RUN_START = {
  gold: 100,
  baseHp: 100,
};

/** Milliseconds of pause shown between one wave ending and the next starting. */
export const WAVE_TRANSITION_DURATION_MS = 2500;

/** Milliseconds between individual enemy spawns within the same wave. */
export const ENEMY_SPAWN_INTERVAL_MS = 650;

/** World-space size the map/path/tower-slots are authored in (renderer scales to fit). */
export const WORLD_SIZE = {
  width: 1000,
  height: 600,
};

/** Visual/geometric width of the enemy path, used only for rendering thickness. */
export const PATH_VISUAL_WIDTH = 42;

export const SAVE_STORAGE_KEY = "hordenova.save.v1";
