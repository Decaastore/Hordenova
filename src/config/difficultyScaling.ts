/**
 * DIFICULDADE INDIVIDUAL POR JOGADOR — spec sections 1-2. This is a
 * SECONDARY, BOUNDED adjustment layered on top of the existing GLOBAL
 * wave-difficulty curve (config/enemyStats.ts's hpMultiplierForWaveIndex,
 * completely untouched by this file). It never replaces that curve, never
 * reads live combat damage, and never lets enemy HP become a function of
 * the player's own DPS — it only nudges the frozen global HP value up or
 * down within a small, hard-capped band based on how the account's real
 * Combat Power (engine/CombatPower.ts) compares to a real reference value
 * for the current global wave.
 *
 * WHY THIS CAN'T CREATE A WALL OR TRIVIALIZE THE GAME:
 *  - The reference curve grows with wave using the EXACT SAME shape/rate as
 *    the frozen Gold formula (config/enemyStats.ts's GOLD_GROWTH_PER_WAVE:
 *    base × (1+(wave-1)×0.03) — reused here, not reinvented). A player
 *    whose Combat Power stops
 *    growing therefore sees their ratio decay over time, sliding the
 *    multiplier toward DIFFICULTY_MULTIPLIER_MIN — but the GLOBAL curve
 *    keeps growing underneath regardless (per its own unrelated, frozen
 *    exponent), so a stalled account still eventually hits the same
 *    natural wall the base game already produces. This adjustment can only
 *    ever soften or sharpen that wall by a bounded amount, never remove it
 *    or move it to infinity.
 *  - The multiplier is clamped to [DIFFICULTY_MULTIPLIER_MIN,
 *    DIFFICULTY_MULTIPLIER_MAX] — a player who is arbitrarily far ahead of
 *    the reference NEVER sees enemies more than
 *    (DIFFICULTY_MULTIPLIER_MAX - 1) × 100% harder than the global
 *    baseline, and a player far behind never sees them easier than
 *    (1 - DIFFICULTY_MULTIPLIER_MIN) × 100%. There is no unbounded term
 *    anywhere in this file.
 */

/** Same constant/shape as config/enemyStats.ts's GOLD_GROWTH_PER_WAVE — reused as the reference Combat Power's growth rate so "expected power" tracks the same real economic curve the rest of the game already tunes against, rather than an invented one. */
export const DIFFICULTY_REFERENCE_GROWTH_PER_WAVE = 0.03;

/** How strongly the account's real Combat Power ratio (actual / reference) is allowed to move the difficulty multiplier away from 1.0. */
const DIFFICULTY_RESPONSE = 0.18;

/** Enemies scaled by this adjustment are never more than 22% harder than the frozen global baseline... */
export const DIFFICULTY_MULTIPLIER_MAX = 1.22;
/** ...and never more than 18% easier than it — Onda 1 always keeps real pressure (spec section 4), never becomes trivial. */
export const DIFFICULTY_MULTIPLIER_MIN = 0.82;

/**
 * The real Combat Power a reference, on-pace account is assumed to have at
 * `globalWave`, given its Combat Power at wave 1. Grows at exactly the same
 * rate as the frozen Gold-per-kill curve (see file header) — a real,
 * already-approved-for-difficulty-adjacent-purposes growth rate, not an
 * invented one.
 */
export function getReferenceCombatPower(baselineCombatPowerAtWaveOne: number, globalWave: number): number {
  const waveIndex = Math.max(0, Math.floor(globalWave) - 1);
  return baselineCombatPowerAtWaveOne * (1 + waveIndex * DIFFICULTY_REFERENCE_GROWTH_PER_WAVE);
}

/**
 * Converts a Combat Power ratio (accountCombatPower / referenceCombatPower)
 * into the bounded enemy-HP multiplier applied at spawn time. ratio === 1
 * (on pace) always returns exactly 1 (no adjustment at all). Never NaN —
 * a zero or negative reference safely returns the neutral 1.0 multiplier
 * rather than dividing by zero upstream.
 */
export function getIndividualDifficultyMultiplier(accountCombatPower: number, referenceCombatPower: number): number {
  if (!(referenceCombatPower > 0) || !(accountCombatPower >= 0)) return 1;
  const ratio = accountCombatPower / referenceCombatPower;
  const raw = 1 + DIFFICULTY_RESPONSE * (ratio - 1);
  return Math.min(DIFFICULTY_MULTIPLIER_MAX, Math.max(DIFFICULTY_MULTIPLIER_MIN, raw));
}
