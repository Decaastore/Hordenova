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
 * Beyond wave 130 there's no more hand-authored content — the Abyss just
 * keeps repeating its own 20-wave cycle (new instance of the same boss,
 * same rhythm) indefinitely, all the way out to the balance wall
 * (~wave 450-460). This is a deliberate scope cut, not an oversight: it
 * keeps `getPhaseForWave` total (never crashes/falls through) without
 * requiring dozens of hand-authored phases for a first content slice.
 */
export function getPhaseForWave(waveNumber: number): PhaseDefinition {
  for (const phase of PHASES) {
    if (waveNumber <= phase.endWave) return phase;
  }

  const last = PHASES[PHASES.length - 1]!;
  const cycleLength = last.endWave - last.startWave + 1;
  const cyclesElapsed = Math.floor((waveNumber - last.startWave) / cycleLength);
  const offset = cyclesElapsed * cycleLength;

  return {
    ...last,
    startWave: last.startWave + offset,
    endWave: last.endWave + offset,
    miniBossWaves: last.miniBossWaves.map((w) => w + offset),
    waveTags: Object.fromEntries(Object.entries(last.waveTags).map(([w, tag]) => [Number(w) + offset, tag])),
  };
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
