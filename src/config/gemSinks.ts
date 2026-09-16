/**
 * Master Implementation Pass spec section 7-8 — GEM SINK ARCHITECTURE +
 * the "pelo menos UMA forma de uso recorrente e escalável de Gems que NÃO
 * seja Pay-to-Win" requirement. Same thin-registry philosophy as
 * config/goldSinks.ts: documents what exists, doesn't invent UI for
 * anything not built.
 *
 * THE NEVER-P2W CONTRACT every entry here must honor (spec sections 7/8/23,
 * restated because it's the one rule that must never quietly slip): a Gem
 * sink may buy CONVENIENCE, COSMETICS, or PRESTIGE — never damage, HP,
 * attack speed, drop-rate, or any other combat/progression advantage. A
 * free player must always be able to out-progress a paying one through
 * time/skill/strategy alone; Gems only ever make that same path faster or
 * prettier, never gate it. `inventory_expansion` stays what SaveSystem.ts's
 * own inventoryCapacity field already documented — architecturally
 * reserved, honestly marked `implemented: false` below, not silently
 * pretended into existence.
 *
 * FASE 6 (currency division: "Gold compra/evolui poder. Gems compram
 * acesso/decisões específicas e Prestige permanente.") — `tower_mastery`
 * has been REMOVED from this registry entirely. Mastery no longer spends
 * any Gems anywhere, unlock included (see config/towerMastery.ts's
 * getMasteryUnlockGoldCost) — it is now a pure Gold sink, registered as
 * "mastery" in goldSinks.ts instead. This keeps Gems reserved for exactly
 * three things: Prestige, Specialization path unlock, and Specialization
 * path change — never Mastery.
 */

export type GemSinkCategory = "CONVENIENCE" | "COSMETIC_PRESTIGE";

export interface GemSinkDefinition {
  id: string;
  category: GemSinkCategory;
  /** i18n key: gemSinks.<i18nKey>.name / .description */
  i18nKey: string;
  /** Whether this sink is genuinely uncapped/recurring (spec section 7's "a progressão pode continuar indefinidamente"). */
  uncapped: boolean;
  /** False for a documented-but-not-yet-wired sink — never claim a purchase flow exists when it doesn't. */
  implemented: boolean;
}

export const GEM_SINKS: readonly GemSinkDefinition[] = [
  { id: "specialization_unlock", category: "CONVENIENCE", i18nKey: "SPECIALIZATION_UNLOCK", uncapped: false, implemented: true },
  { id: "inventory_expansion", category: "CONVENIENCE", i18nKey: "INVENTORY_EXPANSION", uncapped: false, implemented: false },
  { id: "profile_prestige", category: "COSMETIC_PRESTIGE", i18nKey: "PROFILE_PRESTIGE", uncapped: true, implemented: true },
  { id: "tower_skin", category: "COSMETIC_PRESTIGE", i18nKey: "TOWER_SKIN", uncapped: false, implemented: true },
];

/** Spec section 46's Gem Economy Invariant, made checkable: true as long as at least one UNCAPPED, IMPLEMENTED sink exists. */
export function hasUncappedGemSink(): boolean {
  return GEM_SINKS.some((sink) => sink.uncapped && sink.implemented);
}
