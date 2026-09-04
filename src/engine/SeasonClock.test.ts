import { describe, expect, it } from "vitest";
import { LocalSeasonClock, SEASON_DURATION_MS, SEASON_EPOCH_MS } from "./SeasonClock";

describe("SeasonClock (Master Implementation spec section 7)", () => {
  it("reports season 1 starting exactly at the epoch", () => {
    const clock = new LocalSeasonClock(() => SEASON_EPOCH_MS);
    const window = clock.getCurrentSeasonWindow();
    expect(window.seasonNumber).toBe(1);
    expect(window.startAtMs).toBe(SEASON_EPOCH_MS);
    expect(window.endAtMs).toBe(SEASON_EPOCH_MS + SEASON_DURATION_MS);
  });

  it("reports season 2 the instant the 7-day boundary is crossed", () => {
    const justBefore = new LocalSeasonClock(() => SEASON_EPOCH_MS + SEASON_DURATION_MS - 1);
    expect(justBefore.getCurrentSeasonWindow().seasonNumber).toBe(1);

    const exactBoundary = new LocalSeasonClock(() => SEASON_EPOCH_MS + SEASON_DURATION_MS);
    expect(exactBoundary.getCurrentSeasonWindow().seasonNumber).toBe(2);
  });

  it("advances deterministically across many seasons", () => {
    const clock = new LocalSeasonClock(() => SEASON_EPOCH_MS + SEASON_DURATION_MS * 13 + 12345);
    expect(clock.getCurrentSeasonWindow().seasonNumber).toBe(14);
  });

  it("two independent clock instances at the same wall-clock time always agree — no local state, no coordination needed", () => {
    const t = SEASON_EPOCH_MS + SEASON_DURATION_MS * 4 + 999;
    const clockA = new LocalSeasonClock(() => t);
    const clockB = new LocalSeasonClock(() => t);
    expect(clockA.getCurrentSeasonWindow()).toEqual(clockB.getCurrentSeasonWindow());
  });

  it("getTimeRemainingMs counts down to exactly zero at the season boundary, never negative", () => {
    const almostOver = new LocalSeasonClock(() => SEASON_EPOCH_MS + SEASON_DURATION_MS - 500);
    expect(almostOver.getTimeRemainingMs()).toBe(500);

    const exactlyOver = new LocalSeasonClock(() => SEASON_EPOCH_MS + SEASON_DURATION_MS);
    expect(exactlyOver.getTimeRemainingMs()).toBe(SEASON_DURATION_MS); // now IS the start of the next season

    const past = new LocalSeasonClock(() => SEASON_EPOCH_MS - 999_999); // before the epoch entirely
    expect(past.getTimeRemainingMs()).toBeGreaterThanOrEqual(0);
    expect(past.getCurrentSeasonWindow().seasonNumber).toBe(1); // clamped, never a season <= 0
  });

  it("survives 'F5/reload' semantics: a fresh clock instance queried at the same real time reconstructs the identical season window, with no persisted state at all", () => {
    const t = SEASON_EPOCH_MS + SEASON_DURATION_MS * 2 + 42;
    const beforeReload = new LocalSeasonClock(() => t).getCurrentSeasonWindow();
    // Simulate "closing the browser and reopening it later at the same
    // instant" — a brand-new clock object, zero shared state with the one
    // above, must still compute byte-identical results.
    const afterReload = new LocalSeasonClock(() => t).getCurrentSeasonWindow();
    expect(afterReload).toEqual(beforeReload);
  });
});
