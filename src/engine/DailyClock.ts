import { SEASON_EPOCH_MS } from "./SeasonClock";

/**
 * BALANCEAMENTO DEFINITIVO spec section 6/13 — the daily boundary for the
 * free Tower Repositioning allowance. Mirrors SeasonClock's own design
 * exactly (same reasoning, same shared epoch): a day's identity must be a
 * PURE FUNCTION of wall-clock time, never a locally-incrementing counter,
 * so it survives reload/close-reopen/save-load for free — there is no local
 * "used today" flag to lose or reset by accident, only a day INDEX to
 * compare against. This app has no backend (a pure client-only, localStorage-
 * only save — every other time-gated system in it, Season boundaries and
 * Roulette milestones included, is client-clock-authoritative the same way),
 * so this is consistent with the existing time architecture rather than a
 * new trust model — documented here explicitly per the task's own
 * instruction to call out where "the existing architecture" is the answer.
 */
export const DAY_DURATION_MS = 24 * 60 * 60 * 1000;

/** A day index that only advances with real elapsed wall-clock time — never by calling this function more often, and never by closing/reopening the app. */
export function getCurrentDayIndex(nowMs: number = Date.now()): number {
  return Math.floor((nowMs - SEASON_EPOCH_MS) / DAY_DURATION_MS);
}
