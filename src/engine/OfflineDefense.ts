import type { TowerLoadoutEntry } from "@/entities/Tower";
import { waveGoldFactor, waveHpFactor } from "@/config/waveBudget";
import { mainBossHp } from "@/config/bossAssault";
import { previousWaveTotalHp } from "./BossManager";
import { getTowerLevelStats } from "@/config/towerStats";
import { getScaledEnemyStats } from "@/config/enemyStats";
import { generateWaveSpawns, isBossMilestone } from "@/config/waveConfig";
import { isMiniBossWave, getMainBossForWave, getMiniBossForWave } from "@/config/bossConfig";
import { getWaveTag } from "@/config/phaseConfig";
import { ENEMY_SPAWN_INTERVAL_MS, WAVE_TRANSITION_DURATION_MS } from "@/config/gameBalance";

/** Coarse elite-wave difficulty bump for the offline threat estimate — matches GameEngine's ELITE_MODIFIER.hpMultiplier without needing to simulate the elite enemy itself. */
const ELITE_WAVE_HP_MULTIPLIER = 1.4;

/**
 * Offline Defense — spec section 11. A SEPARATE architecture from Active
 * Idle: on resume, simulates a bounded amount of continued progression
 * using the player's current build, coarsely enough to stay a "welcome
 * back" convenience rather than a second full combat engine.
 *
 * Hard constraints from the spec, enforced here:
 *  - capped at MAX_OFFLINE_CAPACITY_MS regardless of accumulation source
 *    (never gated behind "1 hour played = 1 hour offline" — capacity is
 *    pure elapsed real time since the last checkpoint, full stop);
 *  - each simulated wave costs MORE virtual time than the same wave would
 *    take active (OFFLINE_INEFFICIENCY_MULTIPLIER > 1) and must clear a
 *    stricter DPS bar (OFFLINE_SAFETY_MARGIN > 1) — so offline is strictly
 *    less efficient than playing, never a substitute for it;
 *  - a build that can't clear the next wave simply stops the simulation
 *    there (BUILD_TOO_WEAK) instead of grinding the same phase forever.
 *
 * NOTE (spec section 11's explicit callout): this all runs on Date.now()
 * deltas computed client-side, which is exactly what a future backend must
 * NOT trust for anything reward-critical — see the note on
 * `computeOfflineCapacityMs` below. This module is written so that
 * swapping the capacity source for a server-issued value later only
 * touches the one call site in GameEngine, not this simulation logic.
 */

export const MAX_OFFLINE_CAPACITY_MS = 8 * 60 * 60 * 1000;

/**
 * Offline (game closed) advances at this fraction of the live pace: the
 * game is meant to be played with the browser open, so being away pays,
 * but clearly less. Live play — including a background tab — is 100%.
 */
export const OFFLINE_PACE = 0.4;
/**
 * A real wave takes about this many times its spawn budget (enemies still
 * have to walk the road): measured on the live engine, 4 towers at level
 * 30, ~23 s per wave vs a ~16 s budget. Dividing it by the pace keeps
 * "40%" true against actual play, not against the estimate.
 */
const LIVE_WAVE_TIME_OVER_BUDGET = 1.43;
const OFFLINE_INEFFICIENCY_MULTIPLIER = LIVE_WAVE_TIME_OVER_BUDGET / OFFLINE_PACE;
/**
 * With the game closed, each wave also pays only this share of its normal
 * Gold (kills and milestone bonuses). Together with OFFLINE_PACE that puts
 * closed-game Gold at roughly a tenth of what the same time with the
 * browser open earns. Gem Shards, Pass XP and missions are not reduced.
 */
export const OFFLINE_GOLD_SHARE = 0.5;
/** A tab that stayed open but that the browser froze: the player did keep the game open, so this is kinder than closing it. */
export const FROZEN_TAB_INEFFICIENCY_MULTIPLIER = LIVE_WAVE_TIME_OVER_BUDGET / 0.7;
const OFFLINE_SAFETY_MARGIN = 1.5;
const BOSS_FIGHT_BUDGET_MS = 20_000;

/**
 * Pure elapsed-time-since-last-checkpoint, capped. Deliberately NOT scaled
 * by how many hours the player actively played — that would be the "1 hour
 * played = 1 hour offline" disguised-stamina pattern the spec explicitly
 * forbids. `now`/`lastPlayedAt` are client clocks; a future backend should
 * issue and verify this value itself rather than trusting the client's.
 */
export function computeOfflineCapacityMs(lastPlayedAt: number, now: number): number {
  return Math.max(0, Math.min(now - lastPlayedAt, MAX_OFFLINE_CAPACITY_MS));
}

function estimateBuildDps(towerLoadout: readonly TowerLoadoutEntry[]): number {
  return towerLoadout.reduce((total, entry) => {
    const stats = getTowerLevelStats(entry.type, entry.level);
    return total + stats.damage * stats.attackSpeed * stats.projectileCount;
  }, 0);
}

interface WaveThreat {
  totalHp: number;
  goldReward: number;
  durationBudgetMs: number;
  isMainBoss: boolean;
  isMiniBoss: boolean;
}

function estimateWaveThreat(waveNumber: number): WaveThreat {
  if (isBossMilestone(waveNumber)) {
    const mainBoss = getMainBossForWave(waveNumber);
    return {
      totalHp: mainBossHp(mainBoss.id, previousWaveTotalHp(waveNumber)),
      goldReward: mainBoss.goldReward,
      durationBudgetMs: BOSS_FIGHT_BUDGET_MS,
      isMainBoss: true,
      isMiniBoss: false,
    };
  }

  const spawns = generateWaveSpawns(waveNumber);
  let totalHp = 0;
  let goldReward = 0;
  for (const type of spawns) {
    const stats = getScaledEnemyStats(type, waveNumber);
    totalHp += stats.hp * waveHpFactor(waveNumber);
    goldReward += stats.goldReward * waveGoldFactor(waveNumber);
  }

  const miniBoss = isMiniBossWave(waveNumber);
  if (miniBoss) {
    const bruteHp = getScaledEnemyStats("BRUTE", waveNumber).hp;
    const miniBossDef = getMiniBossForWave(waveNumber);
    totalHp += bruteHp * miniBossDef.hpMultiplierVsBrute;
    goldReward += miniBossDef.goldReward;
  }

  // Elite Waves add one stat-boosted enemy on top of the normal
  // composition (see GameEngine.maybeSpawnElite) — approximate its extra
  // threat coarsely rather than simulating the elite spawn itself.
  if (getWaveTag(waveNumber) === "ELITE") {
    const bruteHp = getScaledEnemyStats("BRUTE", waveNumber).hp;
    totalHp += bruteHp * ELITE_WAVE_HP_MULTIPLIER;
  }

  const durationBudgetMs = spawns.length * ENEMY_SPAWN_INTERVAL_MS + WAVE_TRANSITION_DURATION_MS;
  return { totalHp, goldReward, durationBudgetMs, isMainBoss: false, isMiniBoss: miniBoss };
}

export type OfflineStopReason = "RAN_OUT_OF_CAPACITY" | "BUILD_TOO_WEAK";

export interface OfflineSimulationResult {
  startingWave: number;
  endingWave: number;
  phasesCleared: number;
  miniBossesCleared: number;
  bossesCleared: number;
  resourcesEarned: number;
  capacityUsedMs: number;
  stoppedReason: OfflineStopReason;
}

export function simulateOfflineDefense(input: {
  startingWave: number;
  towerLoadout: readonly TowerLoadoutEntry[];
  capacityMs: number;
  /** Virtual-time cost per simulated wave relative to its live duration (defaults to the closed-game pace, 1 / OFFLINE_PACE). */
  inefficiency?: number;
}): OfflineSimulationResult {
  const inefficiency = input.inefficiency ?? OFFLINE_INEFFICIENCY_MULTIPLIER;
  const buildDps = estimateBuildDps(input.towerLoadout);

  let currentWave = input.startingWave;
  let capacityRemainingMs = input.capacityMs;
  let capacityUsedMs = 0;
  let phasesCleared = 0;
  let miniBossesCleared = 0;
  let bossesCleared = 0;
  let resourcesEarned = 0;
  let stoppedReason: OfflineStopReason = "RAN_OUT_OF_CAPACITY";

  // Bounded by capacityRemainingMs / (a wave's minimum realistic cost), so
  // this always terminates — no separate iteration cap needed.
  while (true) {
    const nextWave = currentWave + 1;
    const threat = estimateWaveThreat(nextWave);
    const requiredDps = threat.totalHp / (threat.durationBudgetMs / 1000);
    const costMs = threat.durationBudgetMs * inefficiency;

    if (costMs > capacityRemainingMs) {
      stoppedReason = "RAN_OUT_OF_CAPACITY";
      break;
    }

    if (buildDps < requiredDps * OFFLINE_SAFETY_MARGIN) {
      stoppedReason = "BUILD_TOO_WEAK";
      break;
    }

    capacityRemainingMs -= costMs;
    capacityUsedMs += costMs;
    currentWave = nextWave;
    phasesCleared += 1;
    resourcesEarned += threat.goldReward;
    if (threat.isMainBoss) bossesCleared += 1;
    if (threat.isMiniBoss) miniBossesCleared += 1;
  }

  return {
    startingWave: input.startingWave,
    endingWave: currentWave,
    phasesCleared,
    miniBossesCleared,
    bossesCleared,
    resourcesEarned,
    capacityUsedMs,
    stoppedReason,
  };
}
