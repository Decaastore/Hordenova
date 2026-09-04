/**
 * Central data table for every enemy type. Wave-to-wave scaling formula
 * lives here too, so no wave-difficulty number is hidden inside the engine.
 *
 * Content Progression spec section 3: each archetype must create a
 * DIFFERENT problem for the build, not just be a bigger number —
 * CRAWLER/RUNNER/BRUTE/SHIELDBEARER already cover Basic/Fast/Tank/Armored
 * (light). This adds four more, each demanding a different real response:
 *  SWARMLING  — Swarm:   tiny HP, spawns in numbers -> needs AoE.
 *  REGENERATOR — Regenerating: heals steadily -> needs burst/sustained DPS.
 *  IRONCLAD   — Armored (heavy): very high flat reduction -> needs
 *               Stormcaller's armor penetration specifically.
 *  DISABLER   — Disabler: periodically jams the nearest tower -> the one
 *               archetype that interferes with the build itself, not just
 *               its own stats. See entities/Enemy.ts `disablerState` and
 *               CombatSystem.ts `tickEnemyDisableAbilities`.
 *
 * Flying/Ranged/Shielded(proc)/Splitter/Summoner/Healer remain
 * architecturally open (just more EnemyType entries + a definition) but
 * aren't populated yet — this is the "well-chosen initial set", not the
 * full roster.
 */

export type EnemyType =
  | "CRAWLER"
  | "RUNNER"
  | "BRUTE"
  | "SHIELDBEARER"
  | "SWARMLING"
  | "REGENERATOR"
  | "IRONCLAD"
  | "DISABLER";

export const ENEMY_TYPES: readonly EnemyType[] = [
  "CRAWLER",
  "RUNNER",
  "BRUTE",
  "SHIELDBEARER",
  "SWARMLING",
  "REGENERATOR",
  "IRONCLAD",
  "DISABLER",
];

export interface EnemyDefinition {
  type: EnemyType;
  name: string;
  role: string;
  baseHp: number;
  /** World units per second. */
  baseSpeed: number;
  /** Damage dealt to the base if this enemy reaches the end of the path. */
  baseDamageToBase: number;
  /** Gold granted to the player when killed. */
  goldReward: number;
  /** Flat fraction of incoming damage ignored (0..1). 0 for most enemies. */
  damageReduction: number;
  /** Fraction of max HP regenerated per second while alive. 0 for most enemies. */
  regenPercentPerSecond: number;
  /**
   * DISABLER only: how often (ms) it jams the nearest tower, and for how
   * long. Undefined for every other archetype.
   */
  disablerIntervalMs?: number;
  disablerDurationMs?: number;
  disablerRadius?: number;
}

export const ENEMY_DEFINITIONS: Record<EnemyType, EnemyDefinition> = {
  CRAWLER: {
    type: "CRAWLER",
    name: "Crawler",
    role: "Basic enemy, balanced stats.",
    baseHp: 40,
    baseSpeed: 60,
    baseDamageToBase: 5,
    goldReward: 5,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  RUNNER: {
    type: "RUNNER",
    name: "Runner",
    role: "Very fast, low HP. Pressures slow-firing towers.",
    baseHp: 20,
    baseSpeed: 130,
    baseDamageToBase: 3,
    goldReward: 4,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  BRUTE: {
    type: "BRUTE",
    name: "Brute",
    role: "High HP, slow. Tests sustained DPS.",
    baseHp: 220,
    baseSpeed: 32,
    baseDamageToBase: 15,
    goldReward: 12,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  SHIELDBEARER: {
    type: "SHIELDBEARER",
    name: "Shieldbearer",
    role: "Reduces incoming damage. Forces tower-composition decisions.",
    baseHp: 70,
    baseSpeed: 48,
    baseDamageToBase: 8,
    goldReward: 8,
    damageReduction: 0.35,
    regenPercentPerSecond: 0,
  },
  SWARMLING: {
    type: "SWARMLING",
    name: "Swarmling",
    role: "Tiny, cheap, arrives in numbers. Individually harmless; in bulk, overwhelming.",
    baseHp: 12,
    baseSpeed: 70,
    baseDamageToBase: 2,
    goldReward: 2,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  REGENERATOR: {
    type: "REGENERATOR",
    name: "Regenerator",
    role: "Steadily heals while alive. Chip damage barely dents it — needs a real burst.",
    baseHp: 90,
    baseSpeed: 42,
    baseDamageToBase: 9,
    goldReward: 10,
    damageReduction: 0,
    regenPercentPerSecond: 0.025,
  },
  IRONCLAD: {
    type: "IRONCLAD",
    name: "Ironclad",
    role: "Heavy armor greatly reduces physical damage. Weak to Magic/Armor Penetration.",
    baseHp: 160,
    baseSpeed: 30,
    baseDamageToBase: 12,
    goldReward: 14,
    damageReduction: 0.55,
    regenPercentPerSecond: 0,
  },
  DISABLER: {
    type: "DISABLER",
    name: "Disabler",
    role: "Periodically jams the nearest tower, silencing it for a moment. The build itself is the target.",
    baseHp: 55,
    baseSpeed: 50,
    baseDamageToBase: 6,
    goldReward: 9,
    damageReduction: 0,
    regenPercentPerSecond: 0,
    disablerIntervalMs: 4000,
    disablerDurationMs: 1500,
    disablerRadius: 260,
  },
};

/** Linear growth applied per wave number to HP — the dominant term early/mid-game. */
const HP_GROWTH_PER_WAVE = 0.06;
/**
 * Small COMPOUNDING growth stacked on top of the linear term. Negligible
 * for the first ~50 waves (early game must stay easy to learn on), but by
 * wave ~150-250 it starts meaningfully outpacing even a fully-leveled
 * (MAX_TOWER_LEVEL-capped) army's fixed maximum DPS, and keeps
 * accelerating from there — without it, HP grows purely linearly forever
 * while tower power is capped, so a maxed build's DPS never actually gets
 * caught. This term is what produces the "the build eventually stops" wall
 * (empirically ~wave 450-460) the whole PROGRESSION_STOPPED/upgrade loop
 * is built around — do not remove it.
 */
const HP_COMPOUND_PER_WAVE = 0.006;
/** Small reward growth so later waves stay worth playing. */
const GOLD_GROWTH_PER_WAVE = 0.03;

/**
 * NUMERICAL SAFETY (Master Implementation Pass spec section 47/52) — a raw
 * `Math.pow(1 + HP_COMPOUND_PER_WAVE, waveIndex)` overflows to `Infinity`
 * around wave ~116,000-118,000 (verified: (1.006)^117999 already exceeds
 * Number.MAX_VALUE), which would make every enemy from that wave onward
 * literally unkillable — a hard break, not just "very hard". Since the
 * spec explicitly requires the game to keep functioning out to wave
 * 3,000,000+ with no artificial MAX_PHASE, the compounding term's
 * exponent is capped at this wave index: compounding growth STOPS
 * accelerating beyond it, but the linear term above keeps growing forever
 * (pure multiplication, never overflows at any wave number a real save
 * could reach), so difficulty still climbs indefinitely — it just stops
 * being exponential once it's already astronomically large (~1e52 at the
 * cap, leaving ~250 orders of magnitude of headroom below Number.MAX_VALUE
 * for the linear term and any other multiplier to stack on top of safely).
 * Far below any wave a real player reaches (~450-460 is already the
 * documented "wall"), so this changes nothing about actual gameplay balance
 * — see enemyStats.test.ts for the exact-match regression proof.
 */
const HP_COMPOUND_WAVE_INDEX_CAP = 20_000;

/** The HP multiplier for a given (0-indexed) wave — the only place `Math.pow` for HP scaling happens, so the overflow-safety cap above is applied exactly once. */
function hpMultiplierForWaveIndex(waveIndex: number): number {
  const linear = 1 + waveIndex * HP_GROWTH_PER_WAVE;
  const compoundIndex = Math.min(waveIndex, HP_COMPOUND_WAVE_INDEX_CAP);
  const compound = Math.pow(1 + HP_COMPOUND_PER_WAVE, compoundIndex);
  return linear * compound;
}

/**
 * Master Implementation Pass spec section 9-10 — ENDGAME MULTI-DIMENSIONAL
 * SCALING: "não simplesmente multiplicar HP infinitamente". HP above stays
 * the dominant, ever-present pressure (and is what produces the documented
 * ~450-460 wall) — these two additional dimensions only start contributing
 * at wave 300, matching the spec's own first calibration band ("300–500")
 * rather than the wall itself, so a build is already feeling a second and
 * third kind of pressure by the time HP alone starts to bite, not after.
 * Early/mid-game (< wave 300) is completely unaffected, and each dimension
 * is explicitly capped so no enemy ever becomes literally un-fightable: a
 * build has to adapt (more armor penetration, faster-firing towers), not
 * get permanently locked out.
 *
 * Both use the same "start wave + linear-per-wave + hard cap" shape —
 * genuinely uncapped in WAVE NUMBER (never overflows, no Math.pow anywhere
 * here) while the actual bonus itself stays bounded forever once capped.
 */
const ARMOR_SCALING_START_WAVE = 300;
const ARMOR_SCALING_PER_WAVE = 0.0006;
/** Extra damage reduction from this dimension alone never exceeds this. */
const ARMOR_SCALING_CAP = 0.5;
/** Combined (base archetype resistance + this scaling) damage reduction never exceeds this — always leaves SOME damage getting through, never literal invulnerability. */
const MAX_COMBINED_DAMAGE_REDUCTION = 0.9;

const SPEED_SCALING_START_WAVE = 300;
const SPEED_SCALING_PER_WAVE = 0.0003;
/** Enemies never move more than this fraction faster from this dimension alone. */
const SPEED_SCALING_CAP = 0.6;

function bandScaling(waveNumber: number, startWave: number, perWave: number, cap: number): number {
  if (waveNumber <= startWave) return 0;
  return Math.min(cap, (waveNumber - startWave) * perWave);
}

export interface ScaledEnemyStats {
  hp: number;
  speed: number;
  damageToBase: number;
  goldReward: number;
  damageReduction: number;
  regenPerSecond: number;
}

export function getScaledEnemyStats(type: EnemyType, waveNumber: number): ScaledEnemyStats {
  const def = ENEMY_DEFINITIONS[type];
  const waveIndex = Math.max(waveNumber - 1, 0);
  const hpMultiplier = hpMultiplierForWaveIndex(waveIndex);
  const goldMultiplier = 1 + waveIndex * GOLD_GROWTH_PER_WAVE;
  const hp = Math.round(def.baseHp * hpMultiplier);

  const extraArmor = bandScaling(waveNumber, ARMOR_SCALING_START_WAVE, ARMOR_SCALING_PER_WAVE, ARMOR_SCALING_CAP);
  const damageReduction = Math.min(MAX_COMBINED_DAMAGE_REDUCTION, def.damageReduction + extraArmor);
  const speedMultiplier = 1 + bandScaling(waveNumber, SPEED_SCALING_START_WAVE, SPEED_SCALING_PER_WAVE, SPEED_SCALING_CAP);

  return {
    hp,
    speed: def.baseSpeed * speedMultiplier,
    damageToBase: def.baseDamageToBase,
    goldReward: Math.round(def.goldReward * goldMultiplier),
    damageReduction,
    regenPerSecond: hp * def.regenPercentPerSecond,
  };
}
