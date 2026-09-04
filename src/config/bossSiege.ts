/**
 * Master Implementation Pass spec section 13 — BOSS SIEGE ATTACK. Bosses
 * don't just walk to the castle — a MAIN boss (scope deliberately limited
 * to main bosses for this first pass, not mini-bosses, to keep the new
 * pressure focused on the one fight already built for "múltiplas fases"
 * ceremony rather than spreading it thin across every mini-boss too) can
 * periodically strike the nearest tower, on its own independent interval
 * from its regular ability (SUMMON/SHIELD/DISABLE/etc — see
 * config/bossConfig.ts) so the two never compete for the same cooldown.
 *
 * Damage is expressed as a FRACTION of the target tower's own maxHp (not a
 * flat/wave-scaled number) — spec section 9's "múltiplas dimensões" of
 * difficulty already come from HP/gold scaling elsewhere; this fraction
 * lets tuning stay simple and automatically fair across every tower type's
 * different maxHp (config/towerSurvival.ts) without a second scaling curve.
 *
 * Telegraph (spec: "com telegraph"): a short window between the boss
 * PICKING a target and the hit actually landing — see entities/Enemy.ts's
 * BossState.siegeTelegraphRemainingMs/siegeTargetTowerId, which the
 * renderer reads to draw a warning indicator on the doomed tower before
 * the impact — never an instant, unreadable hit.
 */

export const SIEGE_INTERVAL_MS = 15_000;
export const SIEGE_TELEGRAPH_MS = 900;
export const SIEGE_RADIUS = 380;
/** Fraction of the TARGET tower's own maxHp dealt as raw (pre-armor/shield) damage. */
export const SIEGE_DAMAGE_FRACTION_OF_MAX_HP = 0.4;
/** How long a tower whose HP hits 0 from a siege hit stays disabled — reuses the exact same disabledRemainingMs mechanic a DISABLER enemy already uses. */
export const SIEGE_DISABLE_ON_DEPLETION_MS = 3000;
