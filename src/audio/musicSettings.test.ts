import { beforeEach, describe, expect, it } from "vitest";
import { audioManager } from "./AudioManager";
import { getMusicVolume, initMusicSettingsFromStorage, isMusicMuted, MUSIC_VOLUME_STEPS, setMusicVolume, toggleMusicMuted } from "./musicSettings";

const STORAGE_KEY = "hordenova.music.settings.v1";

describe("musicSettings — Home ambient music persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    audioManager.setMusicVolume(1);
    audioManager.setMusicMuted(false);
  });

  it("defaults to a sane, non-invented volume/mute when nothing was ever persisted", () => {
    initMusicSettingsFromStorage();
    expect(getMusicVolume()).toBeGreaterThan(0);
    expect(getMusicVolume()).toBeLessThanOrEqual(1);
    expect(isMusicMuted()).toBe(false);
  });

  it("setMusicVolume persists across a fresh initMusicSettingsFromStorage() call (simulating a reload)", () => {
    setMusicVolume(0.75);
    audioManager.setMusicVolume(1); // perturb the live manager to prove the next line actually reads storage, not just memory
    initMusicSettingsFromStorage();
    expect(getMusicVolume()).toBe(0.75);
  });

  it("toggleMusicMuted persists across a reload", () => {
    expect(isMusicMuted()).toBe(false);
    const next = toggleMusicMuted();
    expect(next).toBe(true);
    audioManager.setMusicMuted(false); // perturb, prove the reload reads storage
    initMusicSettingsFromStorage();
    expect(isMusicMuted()).toBe(true);
  });

  it("corrupted/invalid stored JSON falls back to defaults instead of throwing", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(() => initMusicSettingsFromStorage()).not.toThrow();
    expect(getMusicVolume()).toBeGreaterThan(0);
  });

  it("an out-of-range stored volume falls back to the default rather than being applied as-is", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: 99, muted: false }));
    initMusicSettingsFromStorage();
    expect(getMusicVolume()).toBeLessThanOrEqual(1);
  });

  it("exposes the same stepped-volume UI pattern as SFX (0/25/50/75/100%)", () => {
    expect(MUSIC_VOLUME_STEPS).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
