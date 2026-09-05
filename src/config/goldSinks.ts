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
 * doc comment for why). This left, for a while, an honest but unwanted
 * consequence: Gold is Season-scoped (resets every 30 days, see
 * AscensionManager.syncSeasonIfNeeded) and, with Mastery gone, both
 * remaining Gold sinks were FINITE (Tower Level caps at MAX_TOWER_LEVEL,
 * Specialization capped at 5) — a player who maxed every tower's level and
 * specialization early in a Season had nothing left to spend Gold on for
 * the rest of that Season.
 *
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — FIXED, not papered over: no
 * new Gold sink was invented. `specialization` (config/specializations.ts)
 * had its level cap removed — Gold can always buy another specialization
 * level, forever — while its COMBAT EFFECT stays capped at exactly the same
 * point it always was (see SPECIALIZATION_EFFECT_LEVEL_CAP), so this is not
 * `Gold -> infinite power`, only `Gold -> infinite (but harmless) sink`.
 * Tower Level (`tower_level`) is deliberately left alone — MAX_TOWER_LEVEL=30
 * and its visual/unlock ladder are untouched by this correction.
 * `hasUncappedGoldSink()` below now correctly returns true again.
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
  { id: "specialization", category: "SPECIALIZATION", i18nKey: "SPECIALIZATION", uncapped: true },
];

/** Spec section 45's Gold Economy Invariant, made checkable: true as long as at least one UNCAPPED sink exists — Gold can never structurally run out of somewhere to go, regardless of account age/level/wealth. */
export function hasUncappedGoldSink(): boolean {
  return GOLD_SINKS.some((sink) => sink.uncapped);
}
