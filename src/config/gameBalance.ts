/**
 * Global, non-entity-specific balance constants.
 * Any number here can be tuned without touching engine/entity code.
 */

export const GAME_SPEEDS = [1, 2, 4] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

export const RUN_START = {
  /** Gold a brand-new save starts with. Gold persists across attempts after that. */
  startingGold: 100,
  baseHp: 100,
};

/** Milliseconds of pause shown between one wave ending and the next starting. */
export const WAVE_TRANSITION_DURATION_MS = 2500;

/** Milliseconds between individual enemy spawns within the same wave. */
export const ENEMY_SPAWN_INTERVAL_MS = 650;

/** Milliseconds of cinematic pause before a main-boss fight begins. */
export const BOSS_INTRO_DURATION_MS = 3000;

/** Milliseconds of pause after a main boss dies before the next wave starts. */
export const BOSS_VICTORY_DURATION_MS = 2000;

/**
 * Below this much real elapsed time since the last checkpoint, resuming is
 * treated as a normal reload (tab refresh, quick relaunch) rather than a
 * genuine "while you were away" absence — so the Offline Defense summary
 * only appears when it would actually mean something.
 */
export const OFFLINE_RETURN_MIN_ELAPSED_MS = 60_000;

/** World-space size the map/path/tower-slots are authored in (renderer scales to fit). */
export const WORLD_SIZE = {
  width: 1000,
  height: 600,
};

/** Visual/geometric width of the enemy path, used only for rendering thickness. */
export const PATH_VISUAL_WIDTH = 42;

export const SAVE_STORAGE_KEY = "hordenova.save.v1";
