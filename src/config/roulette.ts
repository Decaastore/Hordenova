/**
 * Master Implementation spec sections 46-48, and the AUDITORIA E CORREÇÃO
 * GERAL pass's own sections 4-5 — the every-10-wave milestone Roulette.
 * Mirrors config/dropTables.ts's proven pattern exactly (same "SE O JOGO
 * MOSTRA UMA CHANCE, ESSA CHANCE É REAL" contract): `weightPercent` on each
 * entry IS the weight `rollRoulette` uses, there is no hidden multiplier or
 * per-player modifier anywhere in this file, and a UI's "spin" animation is
 * free to take however long it wants to feel good — but the result it lands
 * on must always be the one `rollRoulette` really produced, never a value
 * chosen to manufacture a near-miss.
 *
 * NOTHING outcome (AUDITORIA spec section 4-5): a real, honest chance of
 * walking away with no reward at all — the table was RECALIBRATED (not just
 * appended-to) so the five original outcomes plus NOTHING still sum to
 * exactly 100%. Rank order is preserved (CASTLE_HP_5 stays the dominant
 * outcome, CASTLE_SKIN stays the rarest at 1%); NOTHING is set to 15%,
 * meaningful but never crushing, with the other five scaled down from
 * their original 55/25/10/9/1 to make room for it.
 *
 * Test values only (spec section 47: "não finais, sujeitos a ajuste após
 * simulação") — tune here, nowhere else.
 */

export type RouletteRewardType = "CASTLE_HP_5" | "CASTLE_HP_10" | "CASTLE_HP_20" | "GEM" | "CASTLE_SKIN" | "NOTHING";

/** Spec section 46: "a cada 10 níveis" — reuses the codebase's existing "wave" vocabulary (config/phaseConfig.ts's PHASE_MILESTONE_BONUSES is keyed the same way) since HORDENOVA has no separate "nível" concept from "wave". */
export const ROULETTE_MILESTONE_INTERVAL = 10;

export interface RouletteEntry {
  type: RouletteRewardType;
  /** The real probability, in percent (0-100) — the exact number a Roulette UI must display. */
  weightPercent: number;
}

export const ROULETTE_ENTRIES: readonly RouletteEntry[] = [
  { type: "CASTLE_HP_5", weightPercent: 45 },
  { type: "CASTLE_HP_10", weightPercent: 22 },
  { type: "CASTLE_HP_20", weightPercent: 9 },
  { type: "GEM", weightPercent: 8 },
  { type: "CASTLE_SKIN", weightPercent: 1 },
  { type: "NOTHING", weightPercent: 15 },
];

/** How much permanent max Castle HP each HP-flavored reward grants — 0 for every non-HP outcome (GEM/CASTLE_SKIN/NOTHING alike). */
export function castleHpForReward(type: RouletteRewardType): number {
  if (type === "CASTLE_HP_5") return 5;
  if (type === "CASTLE_HP_10") return 10;
  if (type === "CASTLE_HP_20") return 20;
  return 0;
}

/** Gems granted directly by the GEM outcome (the CASTLE_SKIN outcome's own Gem fallback is a separate constant below, since it's a substitution, not this reward's own value). */
export const ROULETTE_GEM_REWARD_AMOUNT = 1;

/** Spec sections 20/48: a rare cosmetic reward must "genuinely carry that exclusivity value" — if every real Castle Skin is already owned (nothing left to unlock), landing on CASTLE_SKIN falls back to this many Gems instead of silently doing nothing, so the 1%-rarity roll is never wasted. */
export const ROULETTE_CASTLE_SKIN_FALLBACK_GEMS = 25;

/**
 * Weighted single-outcome roll — identical shape/contract to
 * dropTables.ts's rollDropTable. `rng` defaults to Math.random but is
 * injectable so tests can drive exact outcomes deterministically.
 */
export function rollRoulette(rng: () => number = Math.random): RouletteRewardType {
  const roll = rng() * 100;
  let cumulative = 0;
  for (const entry of ROULETTE_ENTRIES) {
    cumulative += entry.weightPercent;
    if (roll < cumulative) return entry.type;
  }
  return ROULETTE_ENTRIES[ROULETTE_ENTRIES.length - 1]!.type;
}

/** Sum of all weights — roulette.test.ts asserts this is exactly 100, same discipline as dropTables.test.ts's totalWeightPercent check. */
export function totalRouletteWeightPercent(): number {
  return ROULETTE_ENTRIES.reduce((sum, entry) => sum + entry.weightPercent, 0);
}
