import { TOWER_TYPES, type TowerType } from "./towerStats";

/**
 * A HORDA QUE APRENDE — the horde adapts to the defense it keeps dying to.
 *
 * After every wave the engine records how much damage each tower TYPE dealt
 * (direct hits + Inferno's burn). The horde keeps a smoothed memory of that
 * split and, for the next waves, grows a resistance against any element
 * doing far more than its fair share, and a weakness to the element the
 * player uses least. A balanced defense is never penalised; a defense that
 * leans on one element sees that element bite less and is nudged to mix.
 *
 * Fairness: it's one fixed, public rule for every player — it reacts only to
 * the player's own defense, never to luck or to who they are.
 */

/** First wave the horde starts adapting (the hand-made opening stays plain while a new player learns). */
export const ADAPTATION_START_WAVE = 20;
/** How much each finished wave moves the horde's memory toward that wave's split (0..1; higher = adapts faster). */
export const ADAPTATION_MEMORY_RATE = 0.3;
/** A share of total damage above this is "more than fair" — 4 elements would be 25% each; a little slack on top. */
export const ADAPTATION_FAIR_SHARE = 0.3;
/** Resistance gained per point of share above the fair share. */
export const ADAPTATION_RESIST_PER_SHARE = 0.5;
/** Most the horde ever resists one element. */
export const ADAPTATION_MAX_RESIST = 0.25;
/** Weakness to the least-used element, as a fraction of the strongest resistance. */
export const ADAPTATION_WEAKNESS_RATIO = 0.5;
/** Changes smaller than this (in resistance) aren't announced to the player. */
export const ADAPTATION_ANNOUNCE_STEP = 0.05;

export type DamageShares = Record<TowerType, number>;

export interface HordeAdaptation {
  /** Smoothed share of damage per element (sums to 1 once anything was recorded; all 0 before). */
  memory: DamageShares;
  /** Damage-taken multiplier per element for the current wave: < 1 resisted, > 1 weak. */
  multipliers: DamageShares;
}

export function emptyShares(): DamageShares {
  return { IRONWOOD: 0, INFERNO: 0, FROSTBORN: 0, STORMCALLER: 0 };
}

function neutralMultipliers(): DamageShares {
  return { IRONWOOD: 1, INFERNO: 1, FROSTBORN: 1, STORMCALLER: 1 };
}

export function createHordeAdaptation(): HordeAdaptation {
  return { memory: emptyShares(), multipliers: neutralMultipliers() };
}

/** Resistance/weakness from a damage split. Pure. */
export function multipliersFromShares(shares: DamageShares): DamageShares {
  const total = TOWER_TYPES.reduce((s, t) => s + shares[t], 0);
  const out = neutralMultipliers();
  if (total <= 0) return out;
  let maxResist = 0;
  for (const t of TOWER_TYPES) {
    const share = shares[t] / total;
    const resist = Math.min(ADAPTATION_MAX_RESIST, Math.max(0, share - ADAPTATION_FAIR_SHARE) * ADAPTATION_RESIST_PER_SHARE);
    out[t] = 1 - resist;
    maxResist = Math.max(maxResist, resist);
  }
  if (maxResist > 0) {
    // ties resolve in TOWER_TYPES order so the rule is fully deterministic
    let weakest: TowerType = TOWER_TYPES[0]!;
    for (const t of TOWER_TYPES) if (shares[t] < shares[weakest]) weakest = t;
    if (out[weakest] === 1) out[weakest] = 1 + maxResist * ADAPTATION_WEAKNESS_RATIO;
  }
  return out;
}

/**
 * Folds one finished wave's damage split into the horde's memory and returns
 * the adaptation for the waves that follow. Before ADAPTATION_START_WAVE the
 * memory still learns, but the horde fights plain.
 */
export function adaptAfterWave(previous: HordeAdaptation, waveDamage: DamageShares, finishedWave: number): HordeAdaptation {
  const total = TOWER_TYPES.reduce((s, t) => s + Math.max(0, waveDamage[t]), 0);
  if (total <= 0) return previous;
  const hadMemory = TOWER_TYPES.some((t) => previous.memory[t] > 0);
  const memory = emptyShares();
  for (const t of TOWER_TYPES) {
    const share = Math.max(0, waveDamage[t]) / total;
    memory[t] = hadMemory ? previous.memory[t] + (share - previous.memory[t]) * ADAPTATION_MEMORY_RATE : share;
  }
  const active = finishedWave + 1 >= ADAPTATION_START_WAVE;
  return { memory, multipliers: active ? multipliersFromShares(memory) : neutralMultipliers() };
}

/** The element the horde resists most (and by how much), or null when it resists nothing. */
export function strongestResistance(adaptation: HordeAdaptation): { type: TowerType; resist: number } | null {
  let best: { type: TowerType; resist: number } | null = null;
  for (const t of TOWER_TYPES) {
    const resist = 1 - adaptation.multipliers[t];
    if (resist > 0.0001 && (!best || resist > best.resist)) best = { type: t, resist };
  }
  return best;
}

/** The element the horde is weak to (and by how much), or null. */
export function weakness(adaptation: HordeAdaptation): { type: TowerType; bonus: number } | null {
  for (const t of TOWER_TYPES) {
    const bonus = adaptation.multipliers[t] - 1;
    if (bonus > 0.0001) return { type: t, bonus };
  }
  return null;
}

/** Restores a saved adaptation, tolerating missing/garbage fields from older saves. */
export function sanitizeHordeAdaptation(raw: unknown): HordeAdaptation {
  const fresh = createHordeAdaptation();
  if (!raw || typeof raw !== "object") return fresh;
  const r = raw as Partial<Record<keyof HordeAdaptation, Partial<Record<TowerType, unknown>>>>;
  for (const key of ["memory", "multipliers"] as const) {
    for (const t of TOWER_TYPES) {
      const v = r[key]?.[t];
      if (typeof v === "number" && Number.isFinite(v)) fresh[key][t] = Math.min(2, Math.max(0, v));
    }
  }
  return fresh;
}
