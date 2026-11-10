import { describe, expect, it } from "vitest";
import { isClipRecordingSupported, pickClipMimeType } from "./victoryClip";

describe("Clipe da vitória — degrades quietly where the browser can't record", () => {
  it("reports no support (and no format) when MediaRecorder is missing", () => {
    expect(pickClipMimeType()).toBeNull();
    expect(isClipRecordingSupported()).toBe(false);
  });
});
