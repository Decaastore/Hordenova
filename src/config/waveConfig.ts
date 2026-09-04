import type { EnemyType } from "./enemyStats";
import { getPhaseForWave, getWaveTag, isMainBossWave } from "./phaseConfig";

/**
 * Procedural wave composition. Nothing here is a hardcoded per-wave array —
 * waves are generated from a small set of tier rules, now filtered through
 * the active phase's enemy pool (config/phaseConfig.ts) and nudged by that
 * wave's tag (ELITE/SWARM) — so composition variety is phase-configurable,
 * not hardcoded in the engine, per Content Progression spec section 4/9.
 *
 * Base tier progression (applies inside whatever pool the current phase
 * allows — a later phase's pool naturally re-weights these once its extra
 * archetypes exist):
 *  1-5   Crawler only
 *  6-10  + Runner
 *  11-15 + Brute
 *  16-20 + Shieldbearer
 *  21-27 combinations
 *  28+   + Ironclad/Regenerator/Disabler enter the mix (heavier, more varied)
 *
 * A SWARM-tagged wave heavily favors Swarmling and spawns more enemies
 * (spec: "Wave: Armored + Swarm" style combinations come from stacking a
 * tag on top of the tier weights, not a fully bespoke per-wave table).
 */

type EnemyWeights = Partial<Record<EnemyType, number>>;

function tierWeightsForWave(waveNumber: number): EnemyWeights {
  if (waveNumber <= 5) return { CRAWLER: 1 };
  if (waveNumber <= 10) return { CRAWLER: 0.7, RUNNER: 0.3 };
  if (waveNumber <= 15) return { CRAWLER: 0.55, RUNNER: 0.25, BRUTE: 0.2 };
  if (waveNumber <= 20) return { CRAWLER: 0.4, RUNNER: 0.2, BRUTE: 0.2, SHIELDBEARER: 0.2 };
  if (waveNumber <= 27) return { CRAWLER: 0.3, RUNNER: 0.25, BRUTE: 0.25, SHIELDBEARER: 0.2 };
  // 28+: the full archetype roster is in play — armored, regenerating and
  // disabling threats mixed in with the originals, forcing real build
  // decisions instead of just "more of the same, higher HP".
  return {
    CRAWLER: 0.14,
    RUNNER: 0.16,
    BRUTE: 0.18,
    SHIELDBEARER: 0.16,
    IRONCLAD: 0.14,
    REGENERATOR: 0.12,
    DISABLER: 0.1,
  };
}

/** Restricts + renormalizes tier weights to whatever archetypes the current phase's pool allows. */
function weightsForWave(waveNumber: number): EnemyWeights {
  const pool = new Set(getPhaseForWave(waveNumber).enemyPool);
  const tag = getWaveTag(waveNumber);

  if (tag === "SWARM" && pool.has("SWARMLING")) {
    // A Swarm wave is mostly Swarmlings with a thin backbone of whatever
    // else the phase allows, so it isn't literally invulnerable to non-AoE.
    const base = tierWeightsForWave(waveNumber);
    const thinned: EnemyWeights = {};
    for (const [type, weight] of Object.entries(base) as [EnemyType, number][]) {
      if (pool.has(type)) thinned[type] = weight * 0.25;
    }
    return { ...thinned, SWARMLING: 3 };
  }

  const tiered = tierWeightsForWave(waveNumber);
  const restricted: EnemyWeights = {};
  let total = 0;
  for (const [type, weight] of Object.entries(tiered) as [EnemyType, number][]) {
    if (!pool.has(type)) continue;
    restricted[type] = weight;
    total += weight;
  }
  if (total === 0) return { CRAWLER: 1 }; // safety net — never return an empty pool
  return restricted;
}

/** Total enemy count for a wave — grows steadily, capped for performance. A Swarm wave gets a real numbers spike on top. */
function enemyCountForWave(waveNumber: number): number {
  const raw = 6 + Math.floor(waveNumber * 0.8);
  const base = Math.min(raw, 26);
  return getWaveTag(waveNumber) === "SWARM" ? Math.round(base * 1.6) : base;
}

export function isBossMilestone(waveNumber: number): boolean {
  return isMainBossWave(waveNumber);
}

/**
 * Master Implementation Pass spec section 9-10 — ELITE DENSITY as one of
 * several endgame difficulty dimensions (alongside HP/armor/speed scaling
 * in enemyStats.ts), so deep-endgame pressure never comes from raw HP
 * alone. The phase system's own hand-authored waveTags (config/
 * phaseConfig.ts) already place a couple of ELITE waves per 20-wave phase
 * cycle — but that ratio never changes no matter how far a save
 * progresses, since waves beyond 130 just replay the same relative tags
 * offset by however many cycles have elapsed. This is a SEPARATE,
 * purely-additive mechanism layered on top (never replaces or edits
 * phaseConfig's own tags) that only ever activates well past the
 * documented ~450-460 balance wall, and its interval is floored so it can
 * never spam an Elite on every single wave.
 */
const ELITE_DENSITY_START_WAVE = 300;
const ELITE_DENSITY_INITIAL_INTERVAL = 15;
const ELITE_DENSITY_MIN_INTERVAL = 5;
const ELITE_DENSITY_SHRINK_PER_WAVE = 0.002;

function eliteBonusInterval(waveNumber: number): number {
  const wavesIntoScaling = Math.max(0, waveNumber - ELITE_DENSITY_START_WAVE);
  const shrink = wavesIntoScaling * ELITE_DENSITY_SHRINK_PER_WAVE;
  return Math.max(ELITE_DENSITY_MIN_INTERVAL, Math.round(ELITE_DENSITY_INITIAL_INTERVAL - shrink));
}

/** True on top of (never instead of) the phase's own ELITE tag — see this function's own doc comment above for the full rationale. */
export function isBonusEliteWave(waveNumber: number): boolean {
  if (waveNumber <= ELITE_DENSITY_START_WAVE) return false;
  return waveNumber % eliteBonusInterval(waveNumber) === 0;
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
