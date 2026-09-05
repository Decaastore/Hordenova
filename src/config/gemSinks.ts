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
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — the deliberate exception
 * this file used to document here (`COMBAT_POWER_MASTERY_EXCEPTION`: Tower
 * Mastery as a real damage/attack-speed/range multiplier funded by Gems)
 * has been REMOVED. Mastery no longer grants any combat stat at all — see
 * config/towerMastery.ts's doc comment for what it grants instead
 * (Specialization Respec Tokens + cosmetic-only visual tiers). `tower_mastery`
 * is therefore a completely ordinary COSMETIC_PRESTIGE sink now, and the
 * NEVER-P2W CONTRACT above has no exceptions left.
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
  { id: "tower_mastery", category: "COSMETIC_PRESTIGE", i18nKey: "TOWER_MASTERY", uncapped: true, implemented: true },
];

/** Spec section 46's Gem Economy Invariant, made checkable: true as long as at least one UNCAPPED, IMPLEMENTED sink exists. */
export function hasUncappedGemSink(): boolean {
  return GEM_SINKS.some((sink) => sink.uncapped && sink.implemented);
}
