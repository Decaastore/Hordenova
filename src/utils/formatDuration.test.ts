import { describe, expect, it } from "vitest";
import { formatDurationShort } from "./formatDuration";

describe("formatDurationShort", () => {
  it("shows days+hours once at least a day remains", () => {
    expect(formatDurationShort(5 * 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000)).toBe("5d 13h");
  });

  it("shows hours+minutes under a day", () => {
    expect(formatDurationShort(13 * 60 * 60 * 1000 + 4 * 60 * 1000)).toBe("13h 4m");
  });

  it("shows just minutes under an hour", () => {
    expect(formatDurationShort(4 * 60 * 1000)).toBe("4m");
  });

  it("never goes negative — clamps to 0m at/after the boundary", () => {
    expect(formatDurationShort(0)).toBe("0m");
    expect(formatDurationShort(-5000)).toBe("0m");
  });
});
