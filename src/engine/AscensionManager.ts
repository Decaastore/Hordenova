import { ASCENSION_STORAGE_KEY, loadSave, updateSave, type SaveData } from "./SaveSystem";
import { seasonClock } from "./SeasonClock";
import { getSeasonRewardBundle, getSeasonTheme, type AscensionHistoryEntry, type AscensionRank } from "@/config/ascension";
import { appendLedgerEvent } from "./EconomyLedger";

/**
 * Master Implementation spec sections 6/9/22/23 — season lifecycle.
 * Everything here operates on raw SaveData (both namespaces — see
 * SaveSystem.ASCENSION_STORAGE_KEY), never a live GameEngine instance:
 * finalizing a season and resetting the Ascension namespace must work
 * correctly even if no GameEngine for that mode is currently running (e.g.
 * the app was closed for three weeks and the very next thing that happens
 * on reopen, before any screen even mounts, is catching the season up).
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

/** The bar for "this save actually played the season" — clearing wave 1 (reaching wave 2) — below this, a season is recorded but grants no reward, so an idle/never-opened account can't passively farm Champion rewards every week. */
const PARTICIPATION_MIN_WAVE = 2;

export function getAscensionSave(): SaveData {
  return loadSave(ASCENSION_STORAGE_KEY);
}

/** Read-only view of where the account stands in the CURRENT season — for HUD/mode-select display. Never mutates anything (see syncSeasonIfNeeded for the mutating side). */
export function getAscensionStatus(): {
  seasonNumber: number;
  themeNameKey: string;
  timeRemainingMs: number;
  currentWave: number;
  hasParticipated: boolean;
} {
  const window = seasonClock.getCurrentSeasonWindow();
  const ascension = getAscensionSave();
  return {
    seasonNumber: window.seasonNumber,
    themeNameKey: getSeasonTheme(window.seasonNumber).nameKey,
    timeRemainingMs: seasonClock.getTimeRemainingMs(),
    currentWave: ascension.currentWave,
    hasParticipated: ascension.currentWave >= PARTICIPATION_MIN_WAVE,
  };
}

function resetAscensionNamespace(): void {
  updateSave(
    {
      currentWave: 1,
      gold: 0,
      towerLoadout: [],
      bestWave: 0,
      gems: 0,
      gemShards: 0,
    },
    ASCENSION_STORAGE_KEY,
  );
}

/**
 * Grants one season's reward bundle to the PERMANENT (Infinite) save —
 * Gems added to the real, unified Gem balance (spec section 49: Ascension
 * rewards use the same Gem economy, not a second currency), cosmetic
 * reward ids appended to `ownedCosmetics`. The caller (finalizeSeason) is
 * responsible for the actual idempotency guard (checking `ascensionHistory`
 * for this season first) — this function just performs the grant and
 * records it on the ledger for audit purposes (spec section 24).
 */
function grantSeasonRewards(seasonNumber: number, rank: AscensionRank): void {
  const bundle = getSeasonRewardBundle(seasonNumber, rank);
  const main = loadSave();

  const newCosmeticIds = bundle.cosmetics.map((c) => c.id).filter((id) => !main.ownedCosmetics.includes(id));

  updateSave({
    gems: main.gems + bundle.gems,
    ownedCosmetics: [...main.ownedCosmetics, ...newCosmeticIds],
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
 */
function finalizeSeason(seasonNumber: number, bestWaveReached: number): void {
  const main = loadSave();
  if (main.ascensionHistory.some((h) => h.seasonNumber === seasonNumber)) return; // already finalized

  const participated = bestWaveReached >= PARTICIPATION_MIN_WAVE;
  const rank: AscensionRank | null = participated ? 1 : null;
  const theme = getSeasonTheme(seasonNumber);

  const historyEntry: AscensionHistoryEntry = {
    seasonNumber,
    bestWave: bestWaveReached,
    rank,
    achievedAtMs: Date.now(),
    seasonThemeNameKey: theme.nameKey,
  };

  updateSave({ ascensionHistory: [...main.ascensionHistory, historyEntry] });
  if (rank !== null) grantSeasonRewards(seasonNumber, rank);
}

/**
 * The one function every entry point into Ascension (mode-select screen,
 * app boot) should call before showing anything Ascension-related. Fully
 * idempotent and safe to call on every mount — does real work only the
 * first time it's called after a season boundary has actually passed.
 *
 * Handles being away for MULTIPLE seasons at once (spec section 7:
 * survives "computador desligado" for however long): every fully-ended
 * season between the last sync and now gets its own history entry, not
 * just the most recent one.
 */
export function syncSeasonIfNeeded(): void {
  const main = loadSave();
  const currentSeasonNumber = seasonClock.getCurrentSeasonWindow().seasonNumber;
  const lastSynced = main.ascensionLastSyncedSeason;

  if (lastSynced >= currentSeasonNumber) return; // already caught up, nothing ended since we last checked

  // The season the player was actually (maybe) mid-way through — its real
  // leftover progress is still sitting in the Ascension namespace.
  finalizeSeason(lastSynced, getAscensionSave().currentWave);

  // Any seasons fully skipped in between (the app was closed for more than
  // a week) never had any progress recorded at all.
  for (let s = lastSynced + 1; s < currentSeasonNumber; s++) {
    finalizeSeason(s, 1);
  }

  resetAscensionNamespace();
  updateSave({ ascensionLastSyncedSeason: currentSeasonNumber });
}
