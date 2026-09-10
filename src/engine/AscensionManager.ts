import { loadSave, updateSave } from "./SaveSystem";
import { seasonClock } from "./SeasonClock";
import {
  getSeasonRewardBundle,
  getSeasonTheme,
  seasonId,
  type AscensionHistoryEntry,
  type AscensionRank,
  type SeasonRewardRecord,
} from "@/config/ascension";
import { appendLedgerEvent } from "./EconomyLedger";
import { RUN_START } from "@/config/gameBalance";
import type { TowerLoadoutEntry } from "@/entities/Tower";

/**
 * HORDENOVA — PRÓXIMA GRANDE FASE spec, "DECISÃO DEFINITIVA SOBRE
 * PROGRESSÃO" — season lifecycle. "Ascension" is this codebase's historical
 * internal name (module/file names, SaveData field prefixes) for what the
 * PRODUCT now calls "Season" — the single competitive layer, no longer a
 * separate mode next to a permanent "Infinite" one. Renaming every symbol
 * here was judged not worth the churn/regression risk for a purely internal
 * name; this comment is the map from old name to new meaning.
 *
 * THE CORE RULE THIS FILE ENFORCES — HORDENOVA Season/Progression v1.0's own
 * restatement: "Season resets progression, not ownership." Season is a
 * competitive WINDOW layered on top of the one permanent save. Two
 * completely separate buckets exist:
 *
 *   PERMANENT (never touched by a Season boundary): gems, Mastery ownership
 *   (SaveData.masteryUnlocked — the one-time 400 Gems purchase per tower
 *   TYPE), Specialization ownership (SaveData.unlockedSpecializationIds —
 *   the one-time 500 Gems purchase per path), owned/equipped Tower Skins
 *   (ownedTowerSkinIds/equippedTowerSkinByType — also Gems-only), Profile
 *   Prestige, items/inventory, collection, ascensionHistory/records,
 *   bestWave (the account's all-time record).
 *
 *   SEASONAL (reset to a fresh state at every Season boundary, by
 *   syncSeasonIfNeeded below): tower LEVEL, Mastery LEVEL
 *   (SaveData.towerMasteryLevels — ownership above is untouched, only the
 *   numeric progression resets), specialization choice/level, Gold,
 *   currentWave, and seasonBestWave itself. A tower placed and leveled to 35
 *   in Season 1 stays PLACED (its type is never "un-unlocked" — there was
 *   never a type-lock to begin with, every type is buildable from wave 1 the
 *   same way it always has been) but drops back to level 1 in Season 2; the
 *   Gold spent leveling it belonged to Season 1 only.
 *
 * `seasonBestWave` is tracked LIVE, the same way `bestWave` always has been
 * (see GameEngine.advanceBestWave/SaveSystem.recordRunResult, which update
 * both high-water marks side by side) — finalizing a season just reads
 * whatever value is already sitting there, the same way a photo finish
 * reads a clock that's already running, rather than computing anything
 * after the fact from a snapshot.
 *
 * HONESTY NOTE (spec section 23: "se o backend ainda não existir, mostrar
 * somente dados reais disponíveis localmente"): HORDENOVA has no server
 * yet, so there is no real opponent pool and no real leaderboard — a
 * completed season can only ever record "you personally reached wave X".
 * Rather than fabricate a fake Top 5 of other players, a season that meets
 * the participation bar is recorded as rank 1 (the only real, honest
 * statement this client can make: "you were the only entrant, and you
 * finished"), and the UI must say so plainly rather than imply real
 * competition happened. When a backend exists, `finalizeSeason` is exactly
 * the function a server-driven equivalent replaces — the reward-bundle and
 * ledger-idempotency logic below doesn't change, only where `rank` comes
 * from does.
 */

/** The bar for "this save actually played the season" — at least 1 wave of real seasonBestWave progress — below this, a season is recorded but grants no reward, so an idle/never-opened account can't passively farm Champion rewards every cycle. */
const PARTICIPATION_MIN_WAVE = 1;

/** Read-only view of where the account stands in the CURRENT season — for HUD/Season screen display. Never mutates anything (see syncSeasonIfNeeded for the mutating side). */
export function getAscensionStatus(): {
  seasonNumber: number;
  themeNameKey: string;
  timeRemainingMs: number;
  seasonBestWave: number;
  hasParticipated: boolean;
} {
  const window = seasonClock.getCurrentSeasonWindow();
  const main = loadSave();
  return {
    seasonNumber: window.seasonNumber,
    themeNameKey: getSeasonTheme(window.seasonNumber).nameKey,
    timeRemainingMs: seasonClock.getTimeRemainingMs(),
    seasonBestWave: main.seasonBestWave,
    hasParticipated: main.seasonBestWave >= PARTICIPATION_MIN_WAVE,
  };
}

/**
 * Grants one season's reward bundle to the permanent save — Gems added to
 * the real, unified Gem balance (spec section 49: Ascension rewards use the
 * same Gem economy, not a second currency), cosmetic reward ids appended to
 * `ownedCosmetics`. The caller (finalizeSeason) is responsible for the
 * actual idempotency guard (checking `ascensionHistory` for this season
 * first) — this function just performs the grant and records it on the
 * ledger for audit purposes (spec section 24).
 */
function grantSeasonRewards(seasonNumber: number, rank: AscensionRank): void {
  const bundle = getSeasonRewardBundle(seasonNumber, rank);
  const main = loadSave();
  const grantedAt = Date.now();

  const newCosmeticIds = bundle.cosmetics.map((c) => c.id).filter((id) => !main.ownedCosmetics.includes(id));

  // Full provenance record (spec section 24) for every individual reward —
  // Gems included — alongside the plain-id ownedCosmetics list. Guarded the
  // same way as ownedCosmetics itself: only ids this save doesn't already
  // hold a record for get appended, so a defensive re-grant (should the
  // ascensionHistory guard in finalizeSeason ever be bypassed) still can't
  // duplicate a record.
  const existingRewardIds = new Set(main.seasonRewardRecords.map((r) => r.rewardId));
  const newRecords: SeasonRewardRecord[] = [];
  const gemsRewardId = `season-${seasonNumber}-rank-${rank}-gems`;
  if (bundle.gems > 0 && !existingRewardIds.has(gemsRewardId)) {
    newRecords.push({
      seasonId: seasonId(seasonNumber),
      seasonNumber,
      playerId: main.playerId,
      rewardId: gemsRewardId,
      rewardType: "GEMS",
      rank,
      grantedAt,
    });
  }
  for (const cosmetic of bundle.cosmetics) {
    if (existingRewardIds.has(cosmetic.id)) continue;
    newRecords.push({
      seasonId: seasonId(seasonNumber),
      seasonNumber,
      playerId: main.playerId,
      rewardId: cosmetic.id,
      rewardType: cosmetic.type,
      rank,
      grantedAt,
    });
  }

  updateSave({
    gems: main.gems + bundle.gems,
    ownedCosmetics: [...main.ownedCosmetics, ...newCosmeticIds],
    seasonRewardRecords: [...main.seasonRewardRecords, ...newRecords],
    ascensionSeasonsWon: main.ascensionSeasonsWon + (rank === 1 ? 1 : 0),
    ascensionTop3: main.ascensionTop3 + (rank <= 3 ? 1 : 0),
    ascensionTop5: main.ascensionTop5 + 1, // any recorded placement (rank is always 1-5 here) counts as a top-5 finish
  });

  appendLedgerEvent({
    eventType: "GEMS_EARNED",
    fromOwner: null,
    toOwner: main.playerId,
    source: `ascension:season-${seasonNumber}:rank-${rank}`,
    amount: bundle.gems,
  });
}

/**
 * Idempotency guard AND the actual finalize step. `ascensionHistory` is
 * permanent and never trimmed (unlike the 500-event-capped EconomyLedger),
 * so it — not the ledger — is the authoritative "have I already processed
 * season N" check. Safe to call repeatedly with the same seasonNumber.
 * `seasonBestWaveReached` is read directly off the live, permanent
 * `seasonBestWave` field — never a separate save/namespace.
 */
function finalizeSeason(seasonNumber: number, seasonBestWaveReached: number): void {
  const main = loadSave();
  if (main.ascensionHistory.some((h) => h.seasonNumber === seasonNumber)) return; // already finalized

  const participated = seasonBestWaveReached >= PARTICIPATION_MIN_WAVE;
  const rank: AscensionRank | null = participated ? 1 : null;
  const theme = getSeasonTheme(seasonNumber);

  const historyEntry: AscensionHistoryEntry = {
    seasonNumber,
    bestWave: seasonBestWaveReached,
    rank,
    achievedAtMs: Date.now(),
    seasonThemeNameKey: theme.nameKey,
  };

  updateSave({ ascensionHistory: [...main.ascensionHistory, historyEntry] });
  if (rank !== null) grantSeasonRewards(seasonNumber, rank);
}

/**
 * The one function every entry point into Season-aware UI (the Season
 * screen, app boot) should call before showing anything season-related.
 * Fully idempotent and safe to call on every mount — does real work only
 * the first time it's called after a season boundary has actually passed.
 *
 * Handles being away for MULTIPLE seasons at once (spec section 7:
 * survives "computador desligado" for however long): every fully-ended
 * season between the last sync and now gets its own history entry, not
 * just the most recent one. Since the underlying save is permanent and
 * never resets, `seasonBestWave` only changes while the player is actually
 * playing — any season window that elapsed entirely while the app was
 * closed necessarily saw zero progress (the value literally cannot have
 * moved with nobody playing), so it's correctly recorded as
 * non-participation, exactly like the old per-namespace-reset version was.
 */
export function syncSeasonIfNeeded(): void {
  const main = loadSave();
  const currentSeasonNumber = seasonClock.getCurrentSeasonWindow().seasonNumber;
  const lastSynced = main.ascensionLastSyncedSeason;

  if (lastSynced >= currentSeasonNumber) return; // already caught up, nothing ended since we last checked

  // The season the player was actually (maybe) mid-way through — whatever
  // seasonBestWave sits on the permanent save right now IS that season's
  // real, final result (nothing to "reset" first, unlike the old
  // separate-namespace design).
  const waveWhenLastSeasonEnded = main.seasonBestWave;
  finalizeSeason(lastSynced, waveWhenLastSeasonEnded);

  // Any seasons fully skipped in between (the app was closed for more than
  // one Season) never had any progress recorded at all — the value hasn't
  // moved since nobody was playing.
  for (let s = lastSynced + 1; s < currentSeasonNumber; s++) {
    finalizeSeason(s, 0);
  }

  // HORDENOVA Season/Progression v1.0 — "Season resets progression, not
  // ownership": tower level/specialization/Season Gold are SEASONAL, not
  // permanent: each placed tower keeps its TYPE and SLOT (never
  // "un-placed" — there's no unlock to lose) but returns to a fresh
  // level-1, no-specialization state, exactly like a tower a player just
  // built. Equipped skin is deliberately NOT touched here —
  // instantiateTowerFromLoadout (GameEngine.ts) sources it from the
  // separate PERMANENT equippedTowerSkinByType map, not from this loadout
  // entry, so leaving this entry's own equivalent field blank changes
  // nothing about what the player actually sees.
  //
  // BALANCEAMENTO DEFINITIVO spec section 7/12 — Tower Equipment Slots.
  // This file's own header already classifies "items/inventory" as
  // PERMANENT, never touched by a Season boundary — equippedItemInstanceIds
  // is carried forward UNCHANGED for exactly that reason (equipping grants
  // no combat power in this pass, so there is no seasonal-balance reason to
  // strip it, and the equipped items themselves remain permanently owned in
  // SaveData.inventory regardless). Losing this on every reset would have
  // been a silent, contract-inconsistent regression.
  const resetLoadout: TowerLoadoutEntry[] = main.towerLoadout.map((entry) => ({
    slotId: entry.slotId,
    type: entry.type,
    level: 1,
    specializationId: null,
    specializationLevel: 0,
    equippedSkinId: null,
    masteryLevel: 0,
    equippedItemInstanceIds: entry.equippedItemInstanceIds,
  }));

  updateSave({
    seasonBestWave: 0,
    ascensionLastSyncedSeason: currentSeasonNumber,
    currentWave: 0,
    gold: RUN_START.startingGold,
    towerLoadout: resetLoadout,
    // Mastery LEVEL is SEASON-scoped (unlike its permanent ownership half,
    // SaveData.masteryUnlocked, which this reset never touches) — resets
    // to {} exactly like the loadout's own level/specialization fields
    // above. This is the one field this reset used to leave untouched
    // (when Mastery ownership and level were still the same conflated
    // number) and no longer does.
    towerMasteryLevels: {},
  });
}

/**
 * CLAUDE CODE — IMPLEMENTAÇÃO INTEGRADA spec section 9: "Reset global para
 * teste" — a manual, tester-triggered reset of ALL seasonal progression back
 * to zero, for use during testing/QA. This is NOT a season boundary and does
 * not touch `ascensionLastSyncedSeason`/`ascensionHistory` — it is a second,
 * independent reset path a tester can fire at will, any time, without
 * waiting for or faking a real season rollover.
 *
 * Deliberately DIFFERENT from syncSeasonIfNeeded in one key way: a real
 * Season boundary keeps every placed tower on the map (only its level/
 * specialization/Mastery-level resets — see that function's own header),
 * but THIS manual testing reset must clear the map itself — "the player
 * must start the test as if they had never placed a tower this Season" is
 * an explicit requirement, not just a fresh level-1/no-specialization state
 * for towers that stay standing. `towerLoadout` (entities/Tower.ts's
 * `TowerLoadoutEntry[]`) is the ONLY persisted representation of "which
 * towers are placed on the map, in which slots" — GameEngine's constructor
 * does exactly `this.towers = save.towerLoadout.map(instantiateFromLoadout)`
 * on every resume, and its own `persist()` writes `this.towers` straight
 * back into that same field — so setting it to `[]` here is both necessary
 * and sufficient to empty the map, and (being a real `updateSave` write to
 * the persistent save, not an in-memory GameEngine mutation) survives a
 * reload with no separate step required. A tower's TYPE was never "unlocked
 * by placing it" in this codebase (every owned type has always been
 * buildable from an empty map) — clearing this array only un-places the
 * towers, it can never un-own a type.
 *
 * Also zeroes the all-time `bestWave` record, since spec section 9
 * explicitly lists "Best Wave" among the fields a testing reset must clear
 * and requires that "old Best Wave must never reappear after reload" —
 * something a real season boundary deliberately never does (that field is
 * permanent there) but this manual testing tool explicitly must.
 *
 * PRESERVED — same permanent bucket this file's header already documents,
 * completely untouched by this function: `playerId`, `gems`/`gemShards`,
 * `prestigeLevel`, `masteryUnlocked` (ownership), `unlockedSpecializationIds`
 * (ownership), `unlockedItemSlots`, `ownedTowerSkinIds`/
 * `equippedTowerSkinByType`, `inventory`, `ownedCosmetics`,
 * `ascensionHistory`/`seasonRewardRecords`/`ascensionSeasonsWon`/
 * `ascensionTop3`/`ascensionTop5`. Any item that was equipped on a now-
 * removed tower simply goes back to being owned-but-unequipped — its
 * `ItemInstance` in `inventory` (the actual, permanent record of ownership)
 * is never touched by clearing `towerLoadout`. Spec section 9's own words:
 * "Season reset = resetar PROGRESSÃO. Season reset NÃO = apagar OWNERSHIP."
 * — never call this expecting it to touch any of the above.
 */
export function resetSeasonProgressionForTesting(): void {
  updateSave({
    bestWave: 0,
    seasonBestWave: 0,
    // Empties the map — see the doc comment above for why this single
    // field is both the necessary and sufficient persisted state to clear.
    towerLoadout: [],
    currentWave: 0,
    gold: RUN_START.startingGold,
    towerMasteryLevels: {},
  });
}
