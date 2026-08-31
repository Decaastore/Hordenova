import { SAVE_STORAGE_KEY } from "@/config/gameBalance";

/**
 * Isolated persistence layer. Nothing outside this file touches
 * localStorage directly. `essence` and the offline-progress fields are
 * carried but not yet spent/used anywhere — they exist so a future phase
 * can add the Eternal Tree and Offline Rewards without a save-format
 * migration.
 */
export interface SaveData {
  bestWave: number;
  essence: number;
  lastPlayedAt: number | null;
}

export const DEFAULT_SAVE_DATA: SaveData = {
  bestWave: 0,
  essence: 0,
  lastPlayedAt: null,
};

function isStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function loadSave(): SaveData {
  if (!isStorageAvailable()) return { ...DEFAULT_SAVE_DATA };

  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE_DATA };

    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      bestWave: typeof parsed.bestWave === "number" ? parsed.bestWave : 0,
      essence: typeof parsed.essence === "number" ? parsed.essence : 0,
      lastPlayedAt: typeof parsed.lastPlayedAt === "number" ? parsed.lastPlayedAt : null,
    };
  } catch {
    return { ...DEFAULT_SAVE_DATA };
  }
}

export function writeSave(data: SaveData): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable/full — progress simply won't persist this session.
  }
}

/** Loads, applies `updates`, writes back, and returns the merged result. */
export function updateSave(updates: Partial<SaveData>): SaveData {
  const current = loadSave();
  const next: SaveData = { ...current, ...updates, lastPlayedAt: Date.now() };
  writeSave(next);
  return next;
}

export function recordRunResult(waveReached: number): SaveData {
  const current = loadSave();
  return updateSave({ bestWave: Math.max(current.bestWave, waveReached) });
}
