/**
 * Master Implementation Pass spec section 6 — GOLD SINK ARCHITECTURE.
 * "Não criar dezenas de sistemas agora. Criar uma arquitetura genérica
 * para Gold Sinks... Neste momento, IMPLEMENTAR Tower Mastery como
 * primeiro sink real. Não implementar sistemas vazios apenas para
 * preencher menu."
 *
 * This registry is deliberately thin: it documents WHICH gold sinks exist
 * (so a future Castle Reinforcement/Relic/Rune/Artifact/Crafting/Loadout-
 * slot sink has a real, named place to register into, per the spec's own
 * example list) without inventing UI or mechanics for anything not built
 * yet. Every entry here maps to a REAL, working sink already wired into
 * GameEngine — see each id's own module for the actual cost/mutation logic.
 *
 * CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE): `tower_mastery` moved OUT
 * of this registry and into gemSinks.ts — Tower Mastery is now permanent
 * account-wide progression funded by Gems, never Gold (see that file's own
 * doc comment for why). This is an honest, load-bearing consequence worth
 * stating plainly: Gold is now Season-scoped (resets every 30 days, see
 * AscensionManager.syncSeasonIfNeeded) and, with Mastery gone, every
 * remaining Gold sink here is FINITE (Tower Level caps at MAX_TOWER_LEVEL,
 * Specialization caps at MAX_SPECIALIZATION_LEVEL) — hasUncappedGoldSink()
 * below now correctly returns false. A player who maxes every tower's level
 * and specialization early in a Season has nothing left to spend Gold on
 * for the remainder of that Season. This was a known, explicit trade-off of
 * the correction, not an oversight — no unrequested new Gold sink was
 * invented to paper over it.
 */

export type GoldSinkCategory = "TOWER_LEVEL" | "SPECIALIZATION";

export interface GoldSinkDefinition {
  id: string;
  category: GoldSinkCategory;
  /** i18n key: goldSinks.<i18nKey>.name / .description */
  i18nKey: string;
  /** Whether the sink is genuinely uncapped (Gold always has somewhere to go once this exists) vs. finite. */
  uncapped: boolean;
}

export const GOLD_SINKS: readonly GoldSinkDefinition[] = [
  { id: "tower_level", category: "TOWER_LEVEL", i18nKey: "TOWER_LEVEL", uncapped: false },
  { id: "specialization", category: "SPECIALIZATION", i18nKey: "SPECIALIZATION", uncapped: false },
];

/** Spec section 45's Gold Economy Invariant, made checkable: true as long as at least one UNCAPPED sink exists — Gold can never structurally run out of somewhere to go, regardless of account age/level/wealth. Deliberately false now — see this file's own doc comment above. */
export function hasUncappedGoldSink(): boolean {
  return GOLD_SINKS.some((sink) => sink.uncapped);
}
