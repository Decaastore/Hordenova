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
 */

export type GoldSinkCategory = "TOWER_LEVEL" | "SPECIALIZATION" | "TOWER_MASTERY";

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
  { id: "tower_mastery", category: "TOWER_MASTERY", i18nKey: "TOWER_MASTERY", uncapped: true },
];

/** Spec section 45's Gold Economy Invariant, made checkable: true as long as at least one UNCAPPED sink exists — Gold can never structurally run out of somewhere to go, regardless of account age/level/wealth. */
export function hasUncappedGoldSink(): boolean {
  return GOLD_SINKS.some((sink) => sink.uncapped);
}
