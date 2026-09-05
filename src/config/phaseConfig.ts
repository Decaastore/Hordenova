import type { EnemyType } from "./enemyStats";

/**
 * Content Progression architecture — the piece that turns "hundreds of
 * waves with bigger numbers" into distinct legs of a journey. A
 * PhaseDefinition is the single source of truth for one biome-stage: which
 * waves belong to it, its enemy pool, its mini-boss/elite/swarm rhythm,
 * and which main boss closes it out. GameEngine and waveConfig/bossConfig
 * only ever ASK this module "what wave is this / what happens on it" —
 * none of that is hardcoded in the engine (spec section 9/10).
 *
 * To add a real biome's worth of content later: add enemy archetypes to
 * enemyStats.ts, a BossDefinition to bossConfig.ts, a BiomeDefinition to
 * rendering/biomes/, then one more PHASES entry here. Nothing else changes.
 */

export type WaveTag = "ELITE" | "SWARM";

export interface PhaseDefinition {
  id: string;
  /** i18n key: phases.<id>.name / .tagline */
  i18nKey: string;
  biomeId: string;
  startWave: number;
  /** The phase's last wave — also its main-boss wave. */
  endWave: number;
  mainBossId: string;
  /** Absolute wave numbers (within this phase) that spawn a mini-boss. */
  miniBossWaves: readonly number[];
  /** Absolute wave numbers tagged for a special composition. */
  waveTags: Readonly<Record<number, WaveTag>>;
  /** Which archetypes can appear in this phase's regular spawn pool. */
  enemyPool: readonly EnemyType[];
}

const CORE_POOL: readonly EnemyType[] = ["CRAWLER", "RUNNER", "BRUTE", "SHIELDBEARER"];
const FULL_POOL: readonly EnemyType[] = [...CORE_POOL, "SWARMLING", "REGENERATOR", "IRONCLAD", "DISABLER"];

/**
 * PHASES — the first real slice of content. Ancient Forest (1-30) is the
 * fully realized phase: its own biome, its full enemy pool, three
 * mini-bosses, two flavor waves, and the refined Hollow Warden.
 *
 * Phases 2-6 are lighter — same biome-driven visual identity (see
 * rendering/biomes/) and their own named boss (bossConfig.ts), but reuse
 * Ancient Forest's enemy archetypes rather than inventing per-biome
 * exclusive creatures right now, per the "don't do a huge content build
 * yet, just don't block it" instruction. Each still ends 20 waves after it
 * starts, matching the boss cadence the balance pass already validated
 * (isMainBossWave used to fire at 30/50/70/90/110/130... — these phase
 * boundaries reproduce that exact cadence, just now table-driven instead
 * of a formula, so it can diverge per-phase later without touching code).
 */
export const PHASES: readonly PhaseDefinition[] = [
  {
    id: "ANCIENT_FOREST",
    i18nKey: "ANCIENT_FOREST",
    biomeId: "ANCIENT_FOREST",
    startWave: 1,
    endWave: 30,
    mainBossId: "hollow-warden",
    miniBossWaves: [7, 14, 21],
    waveTags: { 10: "SWARM", 18: "ELITE", 25: "ELITE" },
    enemyPool: FULL_POOL,
  },
  {
    id: "VOLCANIC_WASTES",
    i18nKey: "VOLCANIC_WASTES",
    biomeId: "VOLCANIC_WASTES",
    startWave: 31,
    endWave: 50,
    mainBossId: "molten-colossus",
    miniBossWaves: [38, 45],
    waveTags: { 42: "SWARM", 48: "ELITE" },
    enemyPool: FULL_POOL,
  },
  {
    id: "FROZEN_TUNDRA",
    i18nKey: "FROZEN_TUNDRA",
    biomeId: "FROZEN_TUNDRA",
    startWave: 51,
    endWave: 70,
    mainBossId: "glacial-sovereign",
    miniBossWaves: [58, 65],
    waveTags: { 62: "SWARM", 68: "ELITE" },
    enemyPool: FULL_POOL,
  },
  {
    id: "CURSED_DESERT",
    i18nKey: "CURSED_DESERT",
    biomeId: "CURSED_DESERT",
    startWave: 71,
    endWave: 90,
    mainBossId: "sand-devourer",
    miniBossWaves: [78, 85],
    waveTags: { 82: "SWARM", 88: "ELITE" },
    enemyPool: FULL_POOL,
  },
  {
    id: "DARK_RUINS",
    i18nKey: "DARK_RUINS",
    biomeId: "DARK_RUINS",
    startWave: 91,
    endWave: 110,
    mainBossId: "grave-tyrant",
    miniBossWaves: [98, 105],
    waveTags: { 102: "SWARM", 108: "ELITE" },
    enemyPool: FULL_POOL,
  },
  {
    id: "ABYSS",
    i18nKey: "ABYSS",
    biomeId: "ABYSS",
    startWave: 111,
    endWave: 130,
    mainBossId: "abyssal-maw",
    miniBossWaves: [118, 125],
    waveTags: { 122: "SWARM", 128: "ELITE" },
    enemyPool: FULL_POOL,
  },
];

/**
 * CORREÇÃO DE REQUISITOS (BOSS STALL FIX) — beyond wave 130 there's no more
 * hand-authored content, but the game no longer just tiles the LAST phase
 * (Abyss) forever. That old behavior meant every endgame boss fight was
 * against `abyssal-maw` — the single HARDEST main boss (highest
 * hpMultiplierVsBrute AND a resistance flavor on top) — while tower power
 * has a hard structural ceiling (MAX_TOWER_LEVEL=30 + the Specialization
 * effect cap). Real engine simulation confirmed this creates a genuine
 * permanent wall around wave ~270-300: once a build's DPS falls behind
 * Abyssal Maw's ever-compounding HP, it NEVER faces an easier boss again to
 * make any further progress against, and Gem Shard income (boss/mini-boss
 * kills only) permanently flatlines with it — see
 * engine/ProgressionSimulation.test.ts's "HONEST FINDING" test for a real,
 * reproduced 48h data point.
 *
 * THE FIX — ENDGAME BOSS ROTATION: post-130, the game cycles through EVERY
 * main boss (in the same order as their original phases — weakest to
 * strongest), one uniform ENDGAME_CYCLE_LENGTH-wave block each, forever. A
 * build stuck on Abyssal Maw still gets 5 OTHER, easier bosses every lap —
 * each one still killable, still paying out Gem Shards/Gold/bestWave
 * progress — instead of an unbroken wall of the single hardest fight. The
 * uniform block reuses the EXACT same mini-boss-at-+7/+14 and
 * SWARM-at-+11/ELITE-at+17 rhythm every hand-authored 20-wave phase already
 * ships (Volcanic Wastes through Abyss) — not a new pattern invented for
 * this fix.
 *
 * ESCALATION IS PRESERVED (spec: "não apenas Boss1->Boss2->...->loop sem
 * progressão"): getEndgameBossHpMultiplierBonus below still makes every
 * FULL 6-boss lap measurably harder than the last, via the same
 * compound-cap-plus-linear-tail overflow-safety pattern already used by
 * enemyStats.ts/towerMastery.ts/specializations.ts/prestige.ts — genuinely
 * uncapped, never Infinity/NaN, but growing slowly enough (+8%/lap) that it
 * can never again concentrate into the single-fight wall this fix exists to
 * remove. `getPhaseForWave` itself stays total (never crashes/falls
 * through) exactly as before.
 */
const ENDGAME_CYCLE_LENGTH = 20;
/** Same relative rhythm every hand-authored 20-wave phase (Volcanic Wastes through Abyss) already uses — not a new pattern. */
const ENDGAME_MINI_BOSS_OFFSETS: readonly number[] = [7, 14];
const ENDGAME_WAVE_TAG_OFFSETS: Readonly<Record<number, WaveTag>> = { 11: "SWARM", 17: "ELITE" };

export function getPhaseForWave(waveNumber: number): PhaseDefinition {
  for (const phase of PHASES) {
    if (waveNumber <= phase.endWave) return phase;
  }

  const last = PHASES[PHASES.length - 1]!;
  const endgameStart = last.endWave + 1;
  const wavesIntoEndgame = waveNumber - endgameStart;
  const blockIndex = Math.floor(wavesIntoEndgame / ENDGAME_CYCLE_LENGTH);
  const rotation = PHASES[blockIndex % PHASES.length]!;
  const blockStart = endgameStart + blockIndex * ENDGAME_CYCLE_LENGTH;

  return {
    id: `${rotation.id}_ENDGAME_LAP${Math.floor(blockIndex / PHASES.length)}`,
    i18nKey: rotation.i18nKey,
    biomeId: rotation.biomeId,
    startWave: blockStart,
    endWave: blockStart + ENDGAME_CYCLE_LENGTH - 1,
    mainBossId: rotation.mainBossId,
    miniBossWaves: ENDGAME_MINI_BOSS_OFFSETS.map((offset) => blockStart + offset),
    waveTags: Object.fromEntries(Object.entries(ENDGAME_WAVE_TAG_OFFSETS).map(([offset, tag]) => [blockStart + Number(offset), tag])),
    enemyPool: FULL_POOL,
  };
}

/** How many FULL 6-boss rotations have completed at `waveNumber` — 0 before the endgame even starts. Used only to scale HP (see getEndgameBossHpMultiplierBonus); never changes WHICH boss appears (that's `rotation` above). */
export function getEndgameCycleLapCount(waveNumber: number): number {
  const last = PHASES[PHASES.length - 1]!;
  if (waveNumber <= last.endWave) return 0;
  const blockIndex = Math.floor((waveNumber - (last.endWave + 1)) / ENDGAME_CYCLE_LENGTH);
  return Math.floor(blockIndex / PHASES.length);
}

const ENDGAME_HP_GROWTH_PER_LAP = 0.08;
/** Numerical safety (same technique as enemyStats.ts/towerMastery.ts): compounding stops accelerating beyond this many laps, but keeps climbing forever via the linear tail below — never Infinity/NaN at any lap count a save could ever reach. */
const ENDGAME_HP_LAP_COMPOUND_CAP = 500;
const ENDGAME_HP_LAP_LINEAR_TAIL_GROWTH = 0.05;

/**
 * Multiplier (>= 1) applied on top of a boss's normal `hpMultiplierVsBrute`
 * once the endgame rotation is underway — 1 (no change) for every
 * hand-authored phase and the entire first lap of the rotation. This is
 * what keeps the endgame "measurably harder over time" per spec, without
 * ever re-concentrating into a single always-hardest fight (see this file's
 * top doc comment).
 */
export function getEndgameBossHpMultiplierBonus(waveNumber: number): number {
  const laps = getEndgameCycleLapCount(waveNumber);
  if (laps <= 0) return 1;
  const cappedLaps = Math.min(laps, ENDGAME_HP_LAP_COMPOUND_CAP);
  const compound = Math.pow(1 + ENDGAME_HP_GROWTH_PER_LAP, cappedLaps);
  const tailLaps = Math.max(0, laps - ENDGAME_HP_LAP_COMPOUND_CAP);
  const linearTail = 1 + tailLaps * ENDGAME_HP_LAP_LINEAR_TAIL_GROWTH;
  return compound * linearTail;
}

export function isMainBossWave(waveNumber: number): boolean {
  return getPhaseForWave(waveNumber).endWave === waveNumber;
}

export function isMiniBossWaveInPhase(waveNumber: number): boolean {
  return getPhaseForWave(waveNumber).miniBossWaves.includes(waveNumber);
}

export function getWaveTag(waveNumber: number): WaveTag | null {
  return getPhaseForWave(waveNumber).waveTags[waveNumber] ?? null;
}

/** True the instant `waveNumber` crosses into a new phase — the moment a "you've arrived somewhere new" banner should fire. */
export function isPhaseStart(waveNumber: number): boolean {
  return getPhaseForWave(waveNumber).startWave === waveNumber;
}

/**
 * Milestone bonuses — spec section 12. Deliberately small and gold-only
 * for now (XP/materials stay as unpopulated SaveData stub fields, see
 * SaveSystem.ts, so this can grow into a real rewards system later without
 * another migration). Keyed by absolute wave number; a wave not listed
 * here gets no milestone bonus (just its normal per-wave gold).
 */
export const PHASE_MILESTONE_BONUSES: Readonly<Record<number, number>> = {
  10: 150,
  20: 300,
  30: 600,
  50: 900,
  60: 1000,
  70: 1300,
  90: 1700,
  110: 2200,
  130: 2800,
};

export function getMilestoneBonus(waveNumber: number): number {
  return PHASE_MILESTONE_BONUSES[waveNumber] ?? 0;
}
