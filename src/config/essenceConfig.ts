/**
 * Essence (permanent progression currency) — architecture placeholder only.
 * NOT wired into the engine in this phase. A future phase will compute
 * Essence earned on defeat from wave reached / enemies killed / bosses
 * killed, spend it in the Eternal Tree, and persist it via SaveSystem.
 */

export interface EssenceEarnedBreakdown {
  fromWaveReached: number;
  fromEnemiesDefeated: number;
  fromBossesDefeated: number;
  total: number;
}

/** Placeholder formula — intentionally unused until the Essence phase lands. */
export function calculateEssenceEarned(_input: {
  waveReached: number;
  enemiesDefeated: number;
  bossesDefeated: number;
}): EssenceEarnedBreakdown {
  return { fromWaveReached: 0, fromEnemiesDefeated: 0, fromBossesDefeated: 0, total: 0 };
}
