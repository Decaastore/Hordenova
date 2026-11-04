import { generateWaveSpawns } from "./waveConfig";
import { GOLD_GROWTH_PER_WAVE, getScaledEnemyStats, hpMultiplierForWaveIndex } from "./enemyStats";

/**
 * WAVE BUDGET — keeps the difficulty curve and the Gold curve smooth across maps.
 *
 * Each map brings its own enemies, and their raw toughness varied a lot.
 * Measured as threat per enemy (effective HP = HP / (1 - damage reduction),
 * weighted by how fast the enemy crosses the towers' range and by its
 * regeneration) against the HP curve, some maps were ~2x tougher than the
 * ones around them: a simulated player crawled through the Dwarven
 * Undercity's first wave for 20 hours and then raced through the next maps.
 * Gold per enemy varied the same way (up to ~2x on some endgame maps). A
 * balanced endless game can't have either.
 *
 * So every regular wave is scaled to the same threat budget for its number
 * (WAVE_THREAT_PER_ENEMY x hpMultiplierForWaveIndex x enemy count) and pays
 * the same Gold budget (WAVE_GOLD_PER_ENEMY x the Gold curve x enemy count).
 * Maps keep their character (which enemies, armour vs speed, which towers
 * shine), but how hard a wave is and what it pays depend only on its number.
 * The first map is left exactly as designed; the budget blends in after it.
 * Same numbers for every player.
 */

/** Threat per enemy, per unit of the HP curve — the median of the original maps (waves 2-130). */
export const WAVE_THREAT_PER_ENEMY = 94;
/** Gold per enemy, per unit of the Gold curve — the median of the original maps (waves 2-130). */
export const WAVE_GOLD_PER_ENEMY = 8.6;
/** The first map (waves 1-30) is left as it was designed; the budget blends in over the next ten waves. */
const BUDGET_BLEND_START_WAVE = 30;
const BUDGET_BLEND_WAVES = 10;
const MIN_FACTOR = 0.3;
const MAX_FACTOR = 3;
/** Speed an enemy's threat is measured against, and how strongly speed counts. */
const REFERENCE_SPEED = 60;
const SPEED_WEIGHT = 0.8;
/** Seconds of regeneration counted per enemy at the reference speed (a slower enemy regenerates for longer in range). */
const REGEN_SECONDS = 20;

/**
 * MEASURED CORRECTION per 10-wave block, waves 31-650 (the hand-made maps
 * and the first full lap of the endgame rotation). The threat formula above
 * can't see everything that makes a map hard — path length and shape, how
 * the towers' sites cover it, enemy abilities — so each regular wave was
 * also played in the real engine by the same reference build (twelve
 * towers, level and Mastery following a steady player's progress) and its
 * HP scaled up and down until the castle started taking damage. A block
 * that held up less than the waves around it (a 60-wave rolling median) is
 * made easier by that much, and vice versa: the map sequence then plays as
 * one smooth slope (wave-to-wave spread went from about +-15% to +-8%).
 * Later laps repeat the first lap's maps, so they reuse its corrections.
 */
const CORRECTION_FIRST_WAVE = 31;
const CORRECTION_BLOCK_WAVES = 10;
const ROTATION_START_WAVE = 331;
const ROTATION_LENGTH_WAVES = 320;
const MEASURED_BLOCK_CORRECTION: readonly number[] = [
  1.01, 1.06, 1.00, 0.94, 0.84, 0.70, 1.28, 1.17, 1.05, 1.13,
  0.89, 0.81, 1.01, 0.96, 1.01, 1.11, 0.96, 0.95, 1.01, 0.99,
  1.13, 1.09, 0.85, 0.83, 1.07, 1.08, 0.99, 1.05, 0.89, 0.97,
  1.01, 1.02, 0.98, 1.00, 1.11, 1.03, 0.94, 0.91, 1.08, 1.08,
  1.01, 1.05, 1.00, 1.01, 0.97, 0.96, 0.98, 1.03, 1.03, 0.98,
  0.96, 0.98, 1.13, 1.07, 0.92, 0.89, 1.01, 0.98, 1.03, 1.01,
  0.96, 0.95,
];

export function measuredWaveCorrection(wave: number): number {
  if (wave < CORRECTION_FIRST_WAVE) return 1;
  const lastMeasured = CORRECTION_FIRST_WAVE + MEASURED_BLOCK_CORRECTION.length * CORRECTION_BLOCK_WAVES - 1;
  const w = wave > lastMeasured ? ROTATION_START_WAVE + ((wave - ROTATION_START_WAVE) % ROTATION_LENGTH_WAVES) : wave;
  return MEASURED_BLOCK_CORRECTION[Math.floor((w - CORRECTION_FIRST_WAVE) / CORRECTION_BLOCK_WAVES)] ?? 1;
}

function earlyBlend(wave: number, factor: number): number {
  const t = Math.min(1, Math.max(0, (wave - BUDGET_BLEND_START_WAVE) / BUDGET_BLEND_WAVES));
  return 1 + (factor - 1) * t;
}

interface WaveFactors {
  hp: number;
  gold: number;
}

const cache = new Map<number, WaveFactors>();

function clampFactor(target: number, actual: number): number {
  return actual > 0 ? Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, target / actual)) : 1;
}

function factorsForWave(wave: number): WaveFactors {
  const w = Math.max(1, Math.floor(wave));
  const hit = cache.get(w);
  if (hit) return hit;
  const spawns = generateWaveSpawns(w);
  let threat = 0;
  let gold = 0;
  for (const type of spawns) {
    const s = getScaledEnemyStats(type, w);
    const effectiveHp = s.hp / Math.max(0.1, 1 - s.damageReduction);
    const speed = Math.max(1, s.speed);
    const regen = s.hp > 0 ? (s.regenPerSecond / s.hp) * REGEN_SECONDS * (REFERENCE_SPEED / speed) : 0;
    threat += effectiveHp * Math.pow(speed / REFERENCE_SPEED, SPEED_WEIGHT) * (1 + regen);
    gold += s.goldReward;
  }
  const n = spawns.length;
  const factors: WaveFactors = {
    hp: earlyBlend(w, clampFactor(WAVE_THREAT_PER_ENEMY * hpMultiplierForWaveIndex(w - 1) * n, threat)) * measuredWaveCorrection(w),
    gold: earlyBlend(w, clampFactor(WAVE_GOLD_PER_ENEMY * (1 + (w - 1) * GOLD_GROWTH_PER_WAVE) * n, gold)),
  };
  if (cache.size > 5000) cache.clear();
  cache.set(w, factors);
  return factors;
}

/** HP multiplier applied to every regular enemy (and the wave's elite) spawned on `wave`. The same for every player. */
export function waveHpFactor(wave: number): number {
  return factorsForWave(wave).hp;
}

/** Gold multiplier applied to every regular enemy (and the wave's elite) spawned on `wave`. The same for every player. */
export function waveGoldFactor(wave: number): number {
  return factorsForWave(wave).gold;
}
