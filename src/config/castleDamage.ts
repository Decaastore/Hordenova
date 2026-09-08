/**
 * BALANCEAMENTO DEFINITIVO spec section 5 — CASTLE DAMAGE.
 *
 * Replaces the old flat, never-wave-scaling `damageToBase` numbers (a
 * different constant baked per enemy archetype/boss, 5-55 range, applied
 * identically whether the base's max HP was 100 or had grown via a
 * permanent Roulette bonus, and IDENTICAL whether the player was on wave 1
 * or wave 5000 — the real bug the wave-1595 audit traced part of the
 * "everything feels trivial forever" complaint to: letting an enemy
 * through became strictly less relevant, in relative terms, the longer a
 * run went on, since Castle max HP could grow slightly via Roulette while
 * this never did).
 *
 * The replacement has exactly the three category tiers the spec asks for
 * (Normal/Mini-Boss/Boss — no per-archetype distinction within Normal) and
 * a single SMOOTH multiplier that is a pure function of wave, applied on
 * top of the category's fixed base percentage of the Castle's actual
 * current max HP (RUN_START.baseHp + any permanent castleHpBonus) — never
 * a hardcoded 100. Damage is computed fresh at the moment of crossing
 * (GameEngine's own reachedBaseIds handling), never cached on the enemy
 * instance, so it always reflects the CURRENT wave and CURRENT max HP.
 */

export type CastleDamageCategory = "NORMAL" | "MINI_BOSS" | "BOSS";

/** Fixed fraction of the Castle's current max HP a single hit of this category deals, BEFORE the wave multiplier. */
export const CASTLE_DAMAGE_BASE_PERCENT: Record<CastleDamageCategory, number> = {
  NORMAL: 0.1,
  MINI_BOSS: 0.25,
  BOSS: 0.5,
};

// Curve shape: BASE + SCALE * ((1 + wave/DIVISOR)^EXPONENT - 1) — the same
// "early value, then a sublinear power law that never flattens" family as
// the frozen enemy-HP late-game formula, chosen deliberately for the same
// reason: EXPONENT < 1 means it keeps climbing forever (never an
// artificial ceiling, satisfying "não deixar os waves altos permanentemente
// triviais") while decelerating (never a runaway spike, satisfying "não
// punir injustamente o início de jogo" and "sem saltos artificiais" — the
// function is C-infinity smooth everywhere, including at wave 0).
// Calibrated against the spec's own reference curve (section 5's
// wave->multiplier table, explicitly given as a STARTING POINT, not a
// final number) via least-error fit at wave 100/1000/5000; the resulting
// curve lands within ~0.15 of every other reference point along the way
// (wave1: 0.252 vs 0.25 target; wave300: 0.60 vs 0.55; wave500: 0.74 vs
// 0.70; wave800: 0.91 vs 0.85; wave1500: 1.20 vs 1.15; wave2000: 1.37 vs
// 1.30; wave3000: 1.63 vs 1.55; wave5000: 2.04 vs 1.90).
const CASTLE_DAMAGE_MULTIPLIER_BASE = 0.25;
const CASTLE_DAMAGE_MULTIPLIER_SCALE = 0.47;
const CASTLE_DAMAGE_MULTIPLIER_WAVE_DIVISOR = 100;
const CASTLE_DAMAGE_MULTIPLIER_EXPONENT = 0.4;

/** Pure function of wave — the ONLY thing that grows with progression; the category base percentages above never change. */
export function getCastleDamageMultiplier(wave: number): number {
  const w = Math.max(0, wave);
  return (
    CASTLE_DAMAGE_MULTIPLIER_BASE +
    CASTLE_DAMAGE_MULTIPLIER_SCALE * (Math.pow(1 + w / CASTLE_DAMAGE_MULTIPLIER_WAVE_DIVISOR, CASTLE_DAMAGE_MULTIPLIER_EXPONENT) - 1)
  );
}

/**
 * The real damage a single enemy of `category` deals to the Castle upon
 * reaching it, at `wave`, against a Castle whose current max HP is
 * `maxBaseHp` (RUN_START.baseHp + any permanent Roulette bonus — the
 * caller's own live value, never re-derived here). Called exactly once per
 * enemy that actually crosses (see GameEngine's reachedBaseIds handling) —
 * never twice, never pre-computed at spawn time.
 */
export function computeCastleDamage(category: CastleDamageCategory, wave: number, maxBaseHp: number): number {
  return Math.round(maxBaseHp * CASTLE_DAMAGE_BASE_PERCENT[category] * getCastleDamageMultiplier(wave));
}
