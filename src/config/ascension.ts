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
 * Master Implementation spec section 24 — "Toda recompensa permanente
 * precisa de: SeasonId, PlayerId, RewardId, RewardType, Rank, GrantedAt".
 * `ownedCosmetics` (a plain id list) is what gameplay checks against for
 * "does this save have cosmetic X"; this is the fuller provenance record
 * alongside it — one entry per individual reward ever granted (Gems
 * included, via the synthetic "GEMS" type), so a future Collection/History
 * UI can show exactly which season+rank earned which reward and when,
 * without re-deriving it from ascensionHistory + getSeasonRewardBundle.
 * See engine/AscensionManager.grantSeasonRewards for how these get built —
 * always alongside, never instead of, the existing ownedCosmetics/gems
 * updates and EconomyLedger entry.
 */
export type RewardRecordType = CosmeticType | "GEMS";

export interface SeasonRewardRecord {
  /** Human-readable season identity, not just the raw number — matches spec's "SeasonId" field name while staying joinable with AscensionHistoryEntry.seasonNumber. */
  seasonId: string;
  seasonNumber: number;
  playerId: string;
  rewardId: string;
  rewardType: RewardRecordType;
  rank: AscensionRank;
  grantedAt: number;
}

export function seasonId(seasonNumber: number): string {
  return `season-${seasonNumber}`;
}

// ---------------------------------------------------------------------------
// Master Implementation spec section 55 — "Prepare estas interfaces (mesmo
// sem backend ainda)". These describe the shape a future server-authoritative
// Ascension backend would own; nothing in this client currently constructs
// them from a live server, but every field is deliberately named to match
// what the client-local equivalents above already track, so wiring a real
// backend later is a data-source swap, not a redesign. Kept here (not used
// internally) purely as the documented contract the spec asks for.
// ---------------------------------------------------------------------------

/** Server-owned config for one season — the authoritative version of getSeasonTheme()'s output. */
export interface SeasonDefinition {
  seasonNumber: number;
  startsAtMs: number;
  endsAtMs: number;
  theme: SeasonTheme;
  rewardBundlesByRank: Record<AscensionRank, SeasonRewardBundle>;
}

/** Server-owned live state of the CURRENT season — the authoritative version of AscensionManager.getAscensionStatus(). */
export interface SeasonState {
  seasonNumber: number;
  isActive: boolean;
  timeRemainingMs: number;
}

/** One player's entry on the server-authoritative leaderboard — the wave-only ranking basis spec section 6 requires ("EXCLUSIVAMENTE a maior wave"). */
export interface SeasonEntry {
  playerId: string;
  bestWave: number;
  /** Tie-break — spec section 6: "quem alcançou primeiro" — first timestamp at which bestWave was reached, never overwritten by a later tie at the same wave. */
  reachedAtMs: number;
}

/** The full ranked board for one season, server-computed — the authoritative replacement for this client's honest single-entrant "rank 1" fallback (see AscensionManager's own doc comment on why it can't do this locally). */
export interface SeasonLeaderboard {
  seasonNumber: number;
  entries: SeasonEntry[]; // pre-sorted by (bestWave desc, reachedAtMs asc)
}

/** The outcome for ONE player once a season is frozen and ranked — the server-authoritative version of finalizeSeason()'s locally-derived AscensionHistoryEntry. */
export interface SeasonResult {
  seasonNumber: number;
  playerId: string;
  bestWave: number;
  rank: AscensionRank | null;
}

/** A single delivered reward — the server-authoritative version of SeasonRewardRecord above (same field set, same names). */
export type SeasonReward = SeasonRewardRecord;

/** What a rank is entitled to before it's granted — the server-authoritative version of getSeasonRewardBundle()'s output, addressable by id rather than only derivable by calling the function. */
export interface SeasonRewardDefinition {
  seasonNumber: number;
  rank: AscensionRank;
  bundle: SeasonRewardBundle;
}

/** Per-player lifetime Ascension stats — the authoritative version of the ascensionSeasonsWon/ascensionTop3/ascensionTop5 counters on SaveData. */
export interface PlayerSeasonStats {
  playerId: string;
  seasonsWon: number;
  top3Finishes: number;
  top5Finishes: number;
}

/** A player's full season-by-season record — the authoritative version of SaveData.ascensionHistory. */
export interface AscensionHistory {
  playerId: string;
  entries: AscensionHistoryEntry[];
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
