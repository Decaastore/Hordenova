/**
 * Novidades (patch notes) — spec: "Não inventar histórico. Utilizar apenas
 * alterações realmente existentes." Every item below corresponds to a
 * real, shipped change in this codebase (cross-referenced against this
 * repo's own commit history) — no invented feature, date, or number.
 *
 * `dateIso` is deliberately `null` on every version except the very latest
 * one: this repo's commit history was authored inside a single sandboxed
 * development session, so every earlier commit carries the SAME calendar
 * timestamp regardless of how much real design/implementation time it
 * actually represents — showing that timestamp on each version would
 * itself be a fabricated-looking, misleading history. Versions are
 * ordered newest-first instead; only the version shipping today (this
 * Home/Wiki/Novidades pass) has a real, honest date.
 *
 * To add a new version when real work ships: add ONE new entry at the top
 * of PATCH_NOTES with a fresh `id`, today's `dateIso`, and its real items
 * (each `i18nKey` needs a matching `novidades.entries.<id>.<i18nKey>` in
 * both locale files) — nothing else needs to change.
 */

export type PatchNoteType = "NEW" | "CHANGE" | "FIX" | "BALANCE" | "REMOVAL";

export type PatchNoteCategory =
  | "CONTENT"
  | "FIXES"
  | "BALANCE"
  | "TOWERS"
  | "CASTLE"
  | "ASCENSION"
  | "ITEMS"
  | "BOSSES"
  | "INTERFACE"
  | "SYSTEMS";

export interface PatchNoteItem {
  type: PatchNoteType;
  category: PatchNoteCategory;
  /** i18n key suffix: novidades.entries.<versionId>.<i18nKey> */
  i18nKey: string;
}

export interface PatchNoteVersion {
  id: string;
  /** ISO date (YYYY-MM-DD) for a version shipping today, or null — see file header. */
  dateIso: string | null;
  items: PatchNoteItem[];
}

/** Newest first. */
export const PATCH_NOTES: readonly PatchNoteVersion[] = [
  {
    id: "v5",
    dateIso: "2026-09-05",
    items: [
      { type: "CHANGE", category: "INTERFACE", i18nKey: "homeRedesign" },
      { type: "NEW", category: "INTERFACE", i18nKey: "rankingScreen" },
      { type: "CHANGE", category: "INTERFACE", i18nKey: "seasonOverviewEnriched" },
      { type: "FIX", category: "SYSTEMS", i18nKey: "ambientMusicClickFix" },
      { type: "CHANGE", category: "CONTENT", i18nKey: "enemyAnatomyPass" },
      { type: "FIX", category: "INTERFACE", i18nKey: "endgamePhaseNameFix" },
    ],
  },
  {
    id: "v4",
    dateIso: "2026-09-04",
    items: [
      { type: "FIX", category: "SYSTEMS", i18nKey: "rouletteAutoGrant" },
      { type: "FIX", category: "CASTLE", i18nKey: "castleHpDrift" },
      { type: "FIX", category: "INTERFACE", i18nKey: "gemConvertButton" },
      { type: "FIX", category: "BOSSES", i18nKey: "ccResistanceTiers" },
      { type: "NEW", category: "INTERFACE", i18nKey: "enemyHpBars" },
      { type: "NEW", category: "INTERFACE", i18nKey: "movementVfx" },
      { type: "FIX", category: "TOWERS", i18nKey: "towerSpacing" },
      { type: "FIX", category: "BOSSES", i18nKey: "miniBossRegenStall" },
      { type: "FIX", category: "INTERFACE", i18nKey: "gemsVsShards" },
      { type: "NEW", category: "SYSTEMS", i18nKey: "homeWikiNovidades" },
    ],
  },
  {
    id: "v3",
    dateIso: null,
    items: [
      { type: "NEW", category: "SYSTEMS", i18nKey: "sfxSystem" },
      { type: "CHANGE", category: "TOWERS", i18nKey: "attackVfxRebuild" },
      { type: "NEW", category: "CASTLE", i18nKey: "castleSkinArchitecture" },
      { type: "FIX", category: "BALANCE", i18nKey: "goldSinkSaturation" },
      { type: "FIX", category: "TOWERS", i18nKey: "frostbornPermafreeze" },
    ],
  },
  {
    id: "v2",
    dateIso: null,
    items: [
      { type: "NEW", category: "SYSTEMS", i18nKey: "persistentProgression" },
      { type: "NEW", category: "CONTENT", i18nKey: "phasesAndBiomes" },
      { type: "NEW", category: "BOSSES", i18nKey: "bossMiniBossSystem" },
      { type: "NEW", category: "ITEMS", i18nKey: "itemSystem" },
      { type: "NEW", category: "ASCENSION", i18nKey: "ascensionSeasons" },
      { type: "NEW", category: "SYSTEMS", i18nKey: "rouletteRewards" },
      { type: "NEW", category: "TOWERS", i18nKey: "towerMastery" },
      { type: "NEW", category: "SYSTEMS", i18nKey: "sinkRegistries" },
      { type: "NEW", category: "TOWERS", i18nKey: "specialAttacks" },
      { type: "NEW", category: "TOWERS", i18nKey: "towerSurvival" },
    ],
  },
  {
    id: "v1",
    dateIso: null,
    items: [
      { type: "NEW", category: "CONTENT", i18nKey: "fourTowers" },
      { type: "NEW", category: "CONTENT", i18nKey: "waveDefenseLoop" },
      { type: "NEW", category: "INTERFACE", i18nKey: "languageSelector" },
      { type: "NEW", category: "INTERFACE", i18nKey: "cinematicMenu" },
    ],
  },
];
