/**
 * Master Implementation spec sections 12-25 — ASCENSION reward catalog.
 * Rewards are permanent (spec: "SEASON REWARDS = PERMANENTES") and never
 * grant power (section 23's forbidden list) — every field here is purely
 * cosmetic/prestige metadata, never damage/HP/level/gold-rate. See
 * engine/AscensionManager.ts for how these get granted (idempotently, via
 * the existing EconomyLedger) and CastleGameplay/CastleVisualDefinition/
 * CastleSkin's own "never gameplay" precedent in config/castleSkins.ts.
 */

export type CosmeticType =
  | "TOWER_SKIN"
  | "CASTLE_SKIN"
  | "ATTACK_EFFECT"
  | "DEATH_EFFECT"
  | "VICTORY_EFFECT"
  | "ENTRANCE_EFFECT"
  | "AURA"
  | "PROFILE_FRAME"
  | "PROFILE_BANNER"
  | "TITLE"
  | "PROFILE_EFFECT"
  | "TROPHY";

export type CosmeticRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";

export interface CosmeticRewardDefinition {
  /** Stable across reloads — derived from seasonNumber+rank+type, never randomly generated, so re-granting is always the SAME id (required for ledger idempotency). */
  id: string;
  seasonNumber: number;
  type: CosmeticType;
  /** i18n key: ascension.rewards.<i18nKey>.name / .description */
  i18nKey: string;
  rarity: CosmeticRarity;
}

export type AscensionRank = 1 | 2 | 3 | 4 | 5;

/**
 * One permanent record of a fully-ended season this save participated in
 * (or didn't) — see engine/SaveSystem.ts's `ascensionHistory` field and
 * engine/AscensionManager.ts's finalizeSeason. Never trimmed, never
 * removed — this is the account's own competitive history (spec section
 * 22: "O histórico nunca é apagado").
 */
export interface AscensionHistoryEntry {
  seasonNumber: number;
  /** Highest wave reached in the Ascension namespace during this season. */
  bestWave: number;
  /** 1-5 if this save earned a placement (see AscensionManager's honesty note on what "rank" means without a real backend/leaderboard yet), or null if it didn't meet the participation bar for that season. */
  rank: AscensionRank | null;
  achievedAtMs: number;
  seasonThemeNameKey: string;
}

export interface SeasonRewardBundle {
  rank: AscensionRank;
  /** i18n key: ascension.rankTitles.<rankTitleKey> */
  rankTitleKey: "CHAMPION" | "ELITE" | "VETERAN" | "CONTENDER";
  gems: number;
  cosmetics: CosmeticRewardDefinition[];
}

/**
 * Section 12's own instruction: "Os valores de Gems devem ficar em
 * configuração." Tune here, nowhere else.
 */
export const ASCENSION_GEM_REWARDS: Record<AscensionRank, number> = {
  1: 200,
  2: 120,
  3: 80,
  4: 50,
  5: 30,
};

/**
 * Section 18 — each Season gets its own identity instead of a re-skinned
 * copy of the last one. Cycles through the spec's own example themes so
 * the architecture never needs "season 5's theme" authored by hand — a
 * real content team would replace this with hand-authored entries per
 * season; this is the honest procedural placeholder in the meantime (spec
 * section 33: "implemente a melhor arquitetura/placeholder visual possível
 * sem destruir a direção").
 */
const SEASON_THEMES: readonly { nameKey: string; cosmeticFlavor: CosmeticType }[] = [
  { nameKey: "THE_HOLLOW_KING", cosmeticFlavor: "CASTLE_SKIN" },
  { nameKey: "EMBERS_OF_WAR", cosmeticFlavor: "TOWER_SKIN" },
  { nameKey: "FROZEN_REIGN", cosmeticFlavor: "ATTACK_EFFECT" },
  { nameKey: "STORMFALL", cosmeticFlavor: "VICTORY_EFFECT" },
];

export interface SeasonTheme {
  seasonNumber: number;
  /** i18n key: ascension.seasonThemes.<nameKey> */
  nameKey: string;
  /** The one "big" cosmetic type this season's Champion/Elite/Veteran rewards feature, per section 18's "não quero apenas mudar a cor do mesmo prêmio". */
  cosmeticFlavor: CosmeticType;
}

export function getSeasonTheme(seasonNumber: number): SeasonTheme {
  const theme = SEASON_THEMES[(seasonNumber - 1) % SEASON_THEMES.length]!;
  return { seasonNumber, nameKey: theme.nameKey, cosmeticFlavor: theme.cosmeticFlavor };
}

function rewardId(seasonNumber: number, rank: AscensionRank, type: CosmeticType): string {
  return `season-${seasonNumber}-rank-${rank}-${type.toLowerCase()}`;
}

/**
 * The full reward bundle for finishing a season at `rank`. Purely a
 * function of (seasonNumber, rank) — same inputs always produce the exact
 * same bundle (including cosmetic ids), which is what lets granting be
 * idempotent without a database: re-deriving the bundle and re-granting it
 * is always a safe no-op if the ledger already has that reward's id
 * recorded (see AscensionManager.grantSeasonRewards).
 */
export function getSeasonRewardBundle(seasonNumber: number, rank: AscensionRank): SeasonRewardBundle {
  const theme = getSeasonTheme(seasonNumber);
  const gems = ASCENSION_GEM_REWARDS[rank];
  const cosmetics: CosmeticRewardDefinition[] = [];

  const push = (type: CosmeticType, rarity: CosmeticRarity) =>
    cosmetics.push({ id: rewardId(seasonNumber, rank, type), seasonNumber, type, i18nKey: rewardId(seasonNumber, rank, type), rarity });

  // Every placed rank gets a title + trophy — the permanent "I competed and
  // placed" record (spec section 20/24).
  push("TITLE", rank === 1 ? "MYTHIC" : rank <= 3 ? "LEGENDARY" : "EPIC");
  push("TROPHY", rank === 1 ? "MYTHIC" : rank <= 3 ? "LEGENDARY" : "EPIC");
  push("PROFILE_FRAME", rank === 1 ? "LEGENDARY" : rank <= 3 ? "EPIC" : "RARE");

  // Top 3 get the fuller prestige set (spec sections 13-15); 4/5 get a
  // lighter but still real set (section 16/17).
  if (rank <= 3) {
    push("AURA", rank === 1 ? "LEGENDARY" : "EPIC");
    push("PROFILE_BANNER", rank === 1 ? "LEGENDARY" : "EPIC");
    push(theme.cosmeticFlavor, rank === 1 ? "MYTHIC" : rank === 2 ? "LEGENDARY" : "EPIC");
  } else {
    push("PROFILE_EFFECT", "RARE");
  }

  const rankTitleKey = rank === 1 ? "CHAMPION" : rank === 2 ? "ELITE" : rank === 3 ? "VETERAN" : "CONTENDER";
  return { rank, rankTitleKey, gems, cosmetics };
}
