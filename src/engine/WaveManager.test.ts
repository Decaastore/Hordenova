import { describe, expect, it } from "vitest";
import { activateNextWave, createWaveManagerState, tickWaveManager } from "./WaveManager";
import { ENEMY_SPAWN_INTERVAL_MS, WAVE_TRANSITION_DURATION_MS } from "@/config/gameBalance";

describe("WaveManager", () => {
  it("starts at wave 0 and idle until activated", () => {
    const state = createWaveManagerState();
    expect(state.currentWave).toBe(0);
    expect(state.phase).toBe("IDLE");
  });

  it("activateNextWave is the only thing that increments currentWave", () => {
    const state = createWaveManagerState();
    activateNextWave(state);
    expect(state.currentWave).toBe(1);
    expect(state.phase).toBe("SPAWNING");
    expect(state.spawnQueue.length).toBeGreaterThan(0);
  });

  it("spawns one enemy per ENEMY_SPAWN_INTERVAL_MS while in SPAWNING", () => {
    const state = createWaveManagerState();
    activateNextWave(state);
    const initialQueueLength = state.spawnQueue.length;

    const first = tickWaveManager(state, ENEMY_SPAWN_INTERVAL_MS, 0);
    expect(first.enemyTypeToSpawn).not.toBeNull();
    expect(state.spawnQueue.length).toBe(initialQueueLength - 1);

    // Not enough time has passed yet for the next spawn.
    const tooSoon = tickWaveManager(state, 10, 1);
    expect(tooSoon.enemyTypeToSpawn).toBeNull();
  });

  it("moves to AWAITING_CLEAR once the spawn queue is empty, then TRANSITIONING once all enemies die", () => {
    const state = createWaveManagerState();
    activateNextWave(state);

    // Drain the whole spawn queue.
    let aliveCount = 0;
    while (state.spawnQueue.length > 0) {
      const result = tickWaveManager(state, ENEMY_SPAWN_INTERVAL_MS, aliveCount);
      if (result.enemyTypeToSpawn) aliveCount++;
    }
    expect(state.phase).toBe("AWAITING_CLEAR");

    // Enemies are all dead now.
    const cleared = tickWaveManager(state, 16, 0);
    expect(cleared.waveJustCleared).toBe(true);
    expect(state.phase).toBe("TRANSITIONING");
  });

  it("automatically activates the next wave after the transition pause — no button required", () => {
    const state = createWaveManagerState();
    activateNextWave(state);
    state.spawnQueue = [];
    tickWaveManager(state, 16, 0); // -> TRANSITIONING
    expect(state.phase).toBe("TRANSITIONING");

    tickWaveManager(state, WAVE_TRANSITION_DURATION_MS + 1, 0);
    expect(state.currentWave).toBe(2);
    expect(state.phase).toBe("SPAWNING");
  });

  it("does not clear the wave the same tick its last enemy spawns, even with a strong defense", () => {
    // Regression test: a defense strong enough to kill every enemy before
    // the next one spawns previously fooled the clear check into firing
    // the instant the still-alive last enemy appeared, because the
    // alive-count snapshot passed in doesn't yet include a spawn that
    // happens during this very call.
    const state = createWaveManagerState();
    activateNextWave(state);
    const totalEnemies = state.spawnQueue.length;

    let clearedWhileSpawning = false;
    for (let i = 0; i < totalEnemies; i++) {
      const isLast = i === totalEnemies - 1;
      const result = tickWaveManager(state, ENEMY_SPAWN_INTERVAL_MS, 0);
      if (isLast && result.enemyTypeToSpawn && result.waveJustCleared) {
        clearedWhileSpawning = true;
      }
    }

    expect(clearedWhileSpawning).toBe(false);
  });
});
