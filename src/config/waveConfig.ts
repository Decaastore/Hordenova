import type { EnemyType } from "./enemyStats";

/**
 * Procedural wave composition. Nothing here is a hardcoded per-wave array —
 * waves are generated from a small set of tier rules so the system scales
 * indefinitely past wave 50, per spec section 13.
 *
 * Progression follows the spec:
 *  1-5   Crawler only
 *  6-10  Crawler + Runner
 *  11-15 Brute introduced
 *  16-20 Shieldbearer introduced
 *  21-29 combinations
 *  30    marked as a boss milestone (combat not implemented yet, see below)
 *  31-49 harder combinations
 *  50    marked as a boss milestone (bigger)
 *  51+   continues scaling using the same tier-4 composition weights
 *
 * NOTE: Boss combat (Goliath) is intentionally NOT implemented in this
 * phase. `isBossMilestone` only marks the wave number so a future phase can
 * hook boss spawning in without touching this file's scaling logic.
 */

type EnemyWeights = Partial<Record<EnemyType, number>>;

function weightsForWave(waveNumber: number): EnemyWeights {
  if (waveNumber <= 5) return { CRAWLER: 1 };
  if (waveNumber <= 10) return { CRAWLER: 0.7, RUNNER: 0.3 };
  if (waveNumber <= 15) return { CRAWLER: 0.55, RUNNER: 0.25, BRUTE: 0.2 };
  if (waveNumber <= 20) {
    return { CRAWLER: 0.4, RUNNER: 0.2, BRUTE: 0.2, SHIELDBEARER: 0.2 };
  }
  if (waveNumber <= 29) {
    return { CRAWLER: 0.3, RUNNER: 0.25, BRUTE: 0.25, SHIELDBEARER: 0.2 };
  }
  // 30+ (including the 30/50 milestones): heavier, tankier mix.
  return { CRAWLER: 0.2, RUNNER: 0.2, BRUTE: 0.3, SHIELDBEARER: 0.3 };
}

/** Total enemy count for a wave — grows steadily, capped for performance. */
function enemyCountForWave(waveNumber: number): number {
  const raw = 6 + Math.floor(waveNumber * 0.8);
  return Math.min(raw, 26);
}

export function isBossMilestone(waveNumber: number): boolean {
  return waveNumber === 30 || (waveNumber >= 50 && waveNumber % 20 === 10);
}

/** Deterministic per-wave PRNG so a given wave's composition is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ordered list of enemy types to spawn, one every ENEMY_SPAWN_INTERVAL_MS. */
export function generateWaveSpawns(waveNumber: number): EnemyType[] {
  const weights = weightsForWave(waveNumber);
  const entries = Object.entries(weights) as [EnemyType, number][];
  const count = enemyCountForWave(waveNumber);
  const rng = mulberry32(waveNumber * 7919 + 13);

  const spawns: EnemyType[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rng();
    let cumulative = 0;
    let picked: EnemyType = entries[0]![0];
    for (const [type, weight] of entries) {
      cumulative += weight;
      if (roll <= cumulative) {
        picked = type;
        break;
      }
    }
    spawns.push(picked);
  }
  return spawns;
}
