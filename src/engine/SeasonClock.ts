/**
 * Master Implementation spec section 7 — the ASCENSION season clock. A
 * season's identity (which number is "current", when it started/ends) must
 * be a pure function of wall-clock time, never a locally-incrementing
 * counter — that's what makes it survive F5/reload/a closed browser/a
 * powered-off computer for free: there is no local state to lose. The
 * client is NOT the authority on this once a backend exists (spec: "o
 * cliente não deve ser a autoridade definitiva quando houver backend") —
 * this file is deliberately split into a `SeasonClock` interface any
 * implementation can satisfy, and `LocalSeasonClock`, the one real
 * implementation this pass ships. A future `ServerSeasonClock` (fetching
 * the season boundary from a server instead of computing it locally) can
 * implement the exact same interface without any caller changing.
 */

/**
 * HORDENOVA — PRÓXIMA GRANDE FASE spec section 3: Season is now the ONE
 * competitive window (30 days), not a 7-day side ladder next to a separate
 * "Infinite" mode. It measures the player's permanent, never-reset save
 * (see SaveData.seasonBestWave) rather than resetting anything — see
 * AscensionManager.ts's updated doc comment for the full lifecycle.
 */
export const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reference point for season numbering — season 1 starts here, season 2
 * exactly SEASON_DURATION_MS later, and so on forever. The exact date is
 * arbitrary (any fixed timestamp works identically), just never move it
 * once real players have live season progress, or every season number
 * shifts under them.
 */
export const SEASON_EPOCH_MS = Date.UTC(2025, 0, 6, 0, 0, 0);

export interface SeasonWindow {
  seasonNumber: number;
  startAtMs: number;
  endAtMs: number;
}

export interface SeasonClock {
  /** Current time, in ms since epoch — the ONLY thing an implementation is free to source differently (local Date.now() vs. a server-provided time). */
  now(): number;
  getCurrentSeasonWindow(): SeasonWindow;
  getTimeRemainingMs(): number;
}

/**
 * The one real implementation this pass ships. Deterministic and
 * side-effect-free: two calls at the same `now()` always agree, which is
 * exactly what lets every client independently agree on "season 14 ends at
 * exactly this timestamp" with no coordination at all.
 */
export class LocalSeasonClock implements SeasonClock {
  constructor(private readonly nowFn: () => number = () => Date.now()) {}

  now(): number {
    return this.nowFn();
  }

  getCurrentSeasonWindow(): SeasonWindow {
    const t = this.now();
    const elapsed = Math.max(0, t - SEASON_EPOCH_MS);
    const seasonIndex = Math.floor(elapsed / SEASON_DURATION_MS);
    const startAtMs = SEASON_EPOCH_MS + seasonIndex * SEASON_DURATION_MS;
    return {
      seasonNumber: seasonIndex + 1,
      startAtMs,
      endAtMs: startAtMs + SEASON_DURATION_MS,
    };
  }

  getTimeRemainingMs(): number {
    return Math.max(0, this.getCurrentSeasonWindow().endAtMs - this.now());
  }
}

/** Shared singleton — every caller in the app should use this one clock instance rather than constructing their own, so "what season is it" is always asked the same way. */
export const seasonClock: SeasonClock = new LocalSeasonClock();
