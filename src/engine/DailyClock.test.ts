import { describe, expect, it } from "vitest";
import { DAY_DURATION_MS, getCurrentDayIndex } from "./DailyClock";
import { SEASON_EPOCH_MS } from "./SeasonClock";

describe("DailyClock — BALANCEAMENTO DEFINITIVO spec section 6/13", () => {
  it("reports day 0 exactly at the epoch", () => {
    expect(getCurrentDayIndex(SEASON_EPOCH_MS)).toBe(0);
  });

  it("advances to the next day the instant the 24h boundary is crossed, never before", () => {
    expect(getCurrentDayIndex(SEASON_EPOCH_MS + DAY_DURATION_MS - 1)).toBe(0);
    expect(getCurrentDayIndex(SEASON_EPOCH_MS + DAY_DURATION_MS)).toBe(1);
  });

  it("advances deterministically across many days", () => {
    expect(getCurrentDayIndex(SEASON_EPOCH_MS + DAY_DURATION_MS * 30 + 12345)).toBe(30);
  });

  it("survives 'F5/reload' semantics: two independent calls at the same real time always agree, with no persisted state at all", () => {
    const t = SEASON_EPOCH_MS + DAY_DURATION_MS * 7 + 999;
    expect(getCurrentDayIndex(t)).toBe(getCurrentDayIndex(t));
  });
});
