import { generateWaveSpawns } from "@/config/waveConfig";
import { ENEMY_SPAWN_INTERVAL_MS, WAVE_TRANSITION_DURATION_MS } from "@/config/gameBalance";
import type { EnemyType } from "@/config/enemyStats";

export type WaveManagerPhase = "IDLE" | "SPAWNING" | "AWAITING_CLEAR" | "TRANSITIONING";

export interface WaveManagerState {
  currentWave: number;
  phase: WaveManagerPhase;
  spawnQueue: EnemyType[];
  spawnTimerMs: number;
  transitionTimerMs: number;
}

export function createWaveManagerState(): WaveManagerState {
  return {
    currentWave: 0,
    phase: "IDLE",
    spawnQueue: [],
    spawnTimerMs: 0,
    transitionTimerMs: 0,
  };
}

/**
 * The single function responsible for starting a wave. Called by the
 * engine to kick off Wave 1, and by `tickWaveManager` internally once the
 * transition pause after a cleared wave elapses. No other code path may
 * increment `currentWave`.
 */
export function activateNextWave(state: WaveManagerState): void {
  state.currentWave += 1;
  state.spawnQueue = generateWaveSpawns(state.currentWave);
  state.phase = "SPAWNING";
  state.spawnTimerMs = 0;
}

export interface WaveTickResult {
  enemyTypeToSpawn: EnemyType | null;
  waveJustCleared: boolean;
}

/** Advances wave state by `dtMs`. `aliveEnemyCount` must reflect enemies alive THIS tick. */
export function tickWaveManager(
  state: WaveManagerState,
  dtMs: number,
  aliveEnemyCount: number,
): WaveTickResult {
  let enemyTypeToSpawn: EnemyType | null = null;
  let waveJustCleared = false;

  if (state.phase === "SPAWNING") {
    state.spawnTimerMs -= dtMs;
    if (state.spawnTimerMs <= 0 && state.spawnQueue.length > 0) {
      enemyTypeToSpawn = state.spawnQueue.shift() ?? null;
      state.spawnTimerMs = ENEMY_SPAWN_INTERVAL_MS;
    }
    if (state.spawnQueue.length === 0) {
      state.phase = "AWAITING_CLEAR";
    }
  }

  if (state.phase === "AWAITING_CLEAR" && aliveEnemyCount === 0) {
    state.phase = "TRANSITIONING";
    state.transitionTimerMs = WAVE_TRANSITION_DURATION_MS;
    waveJustCleared = true;
  }

  if (state.phase === "TRANSITIONING") {
    state.transitionTimerMs -= dtMs;
    if (state.transitionTimerMs <= 0) {
      activateNextWave(state);
    }
  }

  return { enemyTypeToSpawn, waveJustCleared };
}
