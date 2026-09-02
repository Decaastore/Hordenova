import { RUN_START, SAVE_STORAGE_KEY } from "@/config/gameBalance";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";
import type { TowerLoadoutEntry } from "@/entities/Tower";

/**
 * Isolated persistence layer. Nothing outside this file touches
 * localStorage directly. This is intentionally still a flat localStorage
 * wrapper rather than a client/server split — Core Gameplay spec section
 * 16 asks for the CODE to be organized so a future Client -> API -> Server
 * -> Database boundary is clean, not for that boundary to be built now.
 * The seam is exactly this file: every other module reads/writes progress
 * through loadSave/updateSave, never localStorage directly, so swapping
 * this file's internals for API calls later touches nothing else.
 *
 * `essence`, `inventory` and `cosmetics` are carried but not yet
 * spent/used anywhere (see config/essenceConfig.ts, config/blessingConfig.ts)
 * — they exist so a future phase can add the Eternal Tree, Relics/Runes/
 * Artifacts and cosmetic unlocks without another save-format migration.
 */
export interface SaveData {
  version: number;
  bestWave: number;
  essence: number;
  lastPlayedAt: number | null;
  /** Persistent Active Idle progression counter — the wave/phase the player is on. 0 = never started. */
  currentWave: number;
  /** Persistent resource spent on tower upgrades — survives across attempts, unlike a single "run's" gold in the old model. */
  gold: number;
  towerLoadout: TowerLoadoutEntry[];
  /** Reserved for future Relics/Runes/Artifacts/Boosts — always [] in this phase. */
  inventory: unknown[];
  /** Reserved for future skins/attack-effects/death-effects/castle cosmetics — always [] in this phase. */
  cosmetics: unknown[];
}

export const SAVE_DATA_VERSION = 2;

export const DEFAULT_SAVE_DATA: SaveData = {
  version: SAVE_DATA_VERSION,
  bestWave: 0,
  essence: 0,
  lastPlayedAt: null,
  currentWave: 0,
  gold: RUN_START.startingGold,
  towerLoadout: [],
  inventory: [],
  cosmetics: [],
};

function isStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function parseTowerLoadout(raw: unknown): TowerLoadoutEntry[] {
  if (!Array.isArray(raw)) return [];
  const validTypes = new Set<TowerType>(TOWER_TYPES);
  const entries: TowerLoadoutEntry[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as TowerLoadoutEntry).slotId === "string" &&
      validTypes.has((item as TowerLoadoutEntry).type) &&
      typeof (item as TowerLoadoutEntry).level === "number"
    ) {
      entries.push({
        slotId: (item as TowerLoadoutEntry).slotId,
        type: (item as TowerLoadoutEntry).type,
        level: (item as TowerLoadoutEntry).level,
      });
    }
  }
  return entries;
}

export function loadSave(): SaveData {
  if (!isStorageAvailable()) return { ...DEFAULT_SAVE_DATA, towerLoadout: [], inventory: [], cosmetics: [] };

  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE_DATA, towerLoadout: [], inventory: [], cosmetics: [] };

    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      version: SAVE_DATA_VERSION,
      bestWave: typeof parsed.bestWave === "number" ? parsed.bestWave : 0,
      essence: typeof parsed.essence === "number" ? parsed.essence : 0,
      lastPlayedAt: typeof parsed.lastPlayedAt === "number" ? parsed.lastPlayedAt : null,
      currentWave: typeof parsed.currentWave === "number" ? parsed.currentWave : 0,
      gold: typeof parsed.gold === "number" ? parsed.gold : RUN_START.startingGold,
      towerLoadout: parseTowerLoadout(parsed.towerLoadout),
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      cosmetics: Array.isArray(parsed.cosmetics) ? parsed.cosmetics : [],
    };
  } catch {
    return { ...DEFAULT_SAVE_DATA, towerLoadout: [], inventory: [], cosmetics: [] };
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
