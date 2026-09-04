import { audioManager } from "./AudioManager";

/**
 * Persistence adapter for the Home screen's ambient music, mirroring
 * audioSettings.ts's split (AudioManager stays pure playback, this file
 * owns "what gets restored next session"). Deliberately its OWN
 * localStorage key rather than a field on SaveData: music preference is a
 * global, device-level UI setting exactly like the language choice
 * (i18n/LanguageContext.tsx's `hordenova.language` key) — it applies the
 * same way regardless of Infinite vs. Ascension save data, so it has no
 * reason to go through loadSave()/updateSave()'s Infinite-save-specific
 * plumbing (or need a SAVE_DATA_VERSION migration) the way sfxVolume/
 * sfxMuted historically did.
 */
const STORAGE_KEY = "hordenova.music.settings.v1";

export const MUSIC_VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

interface StoredMusicSettings {
  volume: number;
  muted: boolean;
}

const DEFAULT_MUSIC_SETTINGS: StoredMusicSettings = { volume: 0.35, muted: false };

function loadStoredMusicSettings(): StoredMusicSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MUSIC_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_MUSIC_SETTINGS;
    const candidate = parsed as Partial<StoredMusicSettings>;
    const volume = typeof candidate.volume === "number" && candidate.volume >= 0 && candidate.volume <= 1 ? candidate.volume : DEFAULT_MUSIC_SETTINGS.volume;
    const muted = typeof candidate.muted === "boolean" ? candidate.muted : DEFAULT_MUSIC_SETTINGS.muted;
    return { volume, muted };
  } catch {
    return DEFAULT_MUSIC_SETTINGS; // corrupted/unavailable storage — never crash over a cosmetic preference.
  }
}

function persistMusicSettings(settings: StoredMusicSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort — the setting still applies for the rest of this session.
  }
}

/** Restores the persisted volume/mute onto AudioManager. Call once, before the Home screen might start playAmbientMusic(). */
export function initMusicSettingsFromStorage(): void {
  const settings = loadStoredMusicSettings();
  audioManager.setMusicVolume(settings.volume);
  audioManager.setMusicMuted(settings.muted);
}

export function setMusicVolume(volume: number): void {
  audioManager.setMusicVolume(volume);
  persistMusicSettings({ volume: audioManager.getMusicVolume(), muted: audioManager.isMusicMuted() });
}

export function toggleMusicMuted(): boolean {
  const next = !audioManager.isMusicMuted();
  audioManager.setMusicMuted(next);
  persistMusicSettings({ volume: audioManager.getMusicVolume(), muted: next });
  return next;
}

export function getMusicVolume(): number {
  return audioManager.getMusicVolume();
}

export function isMusicMuted(): boolean {
  return audioManager.isMusicMuted();
}
