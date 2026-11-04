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
    hp: earlyBlend(w, clampFactor(WAVE_THREAT_PER_ENEMY * hpMultiplierForWaveIndex(w - 1) * n, threat)),
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
