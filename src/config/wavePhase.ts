/**
 * DISPLAY "FASE + ONDA" LAYER — pure presentation/organization on top of the
 * existing global wave counter. This is DELIBERATELY unrelated to
 * config/phaseConfig.ts's `PhaseDefinition` (the biome-content-arc system —
 * Ancient Forest/Volcanic Wastes/etc, each 20-30 waves with its own boss),
 * which keeps its own name, its own boundaries, and every one of its
 * existing formulas (isMainBossWave, getEndgameBossHpMultiplierBonus, etc.)
 * completely untouched. To avoid ever confusing the two: this module calls
 * its own unit a "Fase" (exactly the 4 function names the spec asked for),
 * never reuses the word "Phase" as a type name, and nothing here is
 * imported by — or exported to — phaseConfig.ts.
 *
 * The global wave number (the ONE number every progression formula in this
 * codebase reads — enemyStats scaling, Boss HP, Specialization/Mastery
 * levels, milestone bonuses, everything) is NEVER replaced or reset. This
 * layer only ever RE-EXPRESSES it as (fase, onda-dentro-da-fase), both
 * derived with simple arithmetic, both invertible back to the exact same
 * global wave. No frozen formula anywhere else in the codebase reads
 * anything from this file.
 *
 * globalWave 1 -> Fase 1 / Onda 1
 * globalWave 10 -> Fase 1 / Onda 10
 * globalWave 11 -> Fase 2 / Onda 1
 * globalWave 991 -> Fase 100 / Onda 1
 * globalWave 1000 -> Fase 100 / Onda 10
 * globalWave 1001 -> Fase 101 / Onda 1
 */
export const WAVES_PER_PHASE = 10;

/** The 1-indexed Fase number a given global wave falls in. Total for any positive integer — never throws, never falls through. */
export function phaseNumberFromWave(globalWave: number): number {
  const wave = Math.max(1, Math.floor(globalWave));
  return Math.floor((wave - 1) / WAVES_PER_PHASE) + 1;
}

/** The 1..WAVES_PER_PHASE onda-within-the-fase position for a given global wave. Always in [1, WAVES_PER_PHASE] — wave 10/20/30/... is always exactly WAVES_PER_PHASE (10), never 0. */
export function waveInPhase(globalWave: number): number {
  const wave = Math.max(1, Math.floor(globalWave));
  const remainder = wave % WAVES_PER_PHASE;
  return remainder === 0 ? WAVES_PER_PHASE : remainder;
}

/** The first global wave belonging to `phase` (1-indexed). */
export function phaseStartWave(phase: number): number {
  const p = Math.max(1, Math.floor(phase));
  return (p - 1) * WAVES_PER_PHASE + 1;
}

/** The last global wave belonging to `phase` (1-indexed) — always exactly phaseStartWave(phase) + WAVES_PER_PHASE - 1. */
export function phaseEndWave(phase: number): number {
  return phaseStartWave(phase) + WAVES_PER_PHASE - 1;
}

/** True on the exact global wave that closes out its Fase (onda 10) — the moment a "grande confronto / encerramento de fase" beat reads from, purely for presentation (never gates any real spawn/boss logic — see phaseConfig.ts for the real cadence). */
export function isPhaseClosingWave(globalWave: number): boolean {
  return waveInPhase(globalWave) === WAVES_PER_PHASE;
}
