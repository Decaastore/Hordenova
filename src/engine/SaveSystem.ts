import { RUN_START, SAVE_STORAGE_KEY } from "@/config/gameBalance";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { ENEMY_TYPES, type EnemyType } from "@/config/enemyStats";
import type { TowerLoadoutEntry } from "@/entities/Tower";
import type { ItemInstance } from "@/entities/Item";
import type { LocalFirstDiscoveries } from "./WorldFirst";
import { generateId } from "@/utils/id";

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
 * `xp` and `materials` follow the same pattern for Content Progression spec
 * section 11's future per-phase reward types — carried, unused, gold-only
 * rewards stay the real system for now.
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
  /** Every item this save owns — real individually-identified copies, see entities/Item.ts. Item System spec section 8. */
  inventory: ItemInstance[];
  /** Reserved for future skins/attack-effects/death-effects/castle cosmetics — always [] in this phase. */
  cosmetics: unknown[];
  /** Reserved for a future XP/leveling system — always 0 in this phase. */
  xp: number;
  /** Reserved for future crafting/upgrade materials — always [] in this phase. */
  materials: unknown[];
  /** Enemy archetypes the player has ever encountered — drives the one-time "NEW ENEMY" discovery banner, see GameEngine.maybeDiscover. */
  discoveredEnemyTypes: EnemyType[];
  /** Stable local identity used as ItemInstance.ownerId / TradeSession player ids / WorldFirst.playerId — generated once, then persisted. Item System spec section 14/31: this is exactly the id a future account system would replace. */
  playerId: string;
  /** Lifetime counters (never reset by retryPhase) — Item System spec section 18's one real local number: "how many bosses has THIS save defeated". */
  bossesDefeatedTotal: number;
  miniBossesDefeatedTotal: number;
  /** itemDefinitionId -> the record for the first copy THIS save ever obtained — see engine/WorldFirst.ts for why this is a LOCAL, not global, "first". */
  localFirstDiscoveries: LocalFirstDiscoveries;
}

export const SAVE_DATA_VERSION = 4;

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
  xp: 0,
  materials: [],
  discoveredEnemyTypes: [],
  // Left blank here on purpose — a real id is assigned (and persisted) the
  // first time loadSave() sees an empty one, so every actual save gets its
  // own unique identity instead of every "never saved yet" session sharing
  // this literal constant.
  playerId: "",
  bossesDefeatedTotal: 0,
  miniBossesDefeatedTotal: 0,
  localFirstDiscoveries: {},
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

function parseDiscoveredEnemyTypes(raw: unknown): EnemyType[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set<EnemyType>(ENEMY_TYPES);
  return raw.filter((entry): entry is EnemyType => valid.has(entry));
}

function isValidItemInstance(raw: unknown): raw is ItemInstance {
  if (!raw || typeof raw !== "object") return false;
  const item = raw as Partial<ItemInstance>;
  return (
    typeof item.instanceId === "string" &&
    typeof item.itemDefinitionId === "string" &&
    typeof item.ownerId === "string" &&
    typeof item.acquiredAt === "number" &&
    typeof item.tradable === "boolean" &&
    Array.isArray(item.history)
  );
}

function parseInventory(raw: unknown): ItemInstance[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidItemInstance);
}

function parseLocalFirstDiscoveries(raw: unknown): LocalFirstDiscoveries {
  if (!raw || typeof raw !== "object") return {};
  const result: LocalFirstDiscoveries = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (
      value &&
      typeof value === "object" &&
      typeof (value as { itemDefinitionId?: unknown }).itemDefinitionId === "string" &&
      typeof (value as { instanceId?: unknown }).instanceId === "string" &&
      typeof (value as { playerId?: unknown }).playerId === "string" &&
      typeof (value as { obtainedAt?: unknown }).obtainedAt === "number"
    ) {
      result[key] = value as LocalFirstDiscoveries[string];
    }
  }
  return result;
}

function emptySaveData(): SaveData {
  return { ...DEFAULT_SAVE_DATA, towerLoadout: [], inventory: [], cosmetics: [], materials: [], discoveredEnemyTypes: [], localFirstDiscoveries: {} };
}

export function loadSave(): SaveData {
  if (!isStorageAvailable()) return { ...emptySaveData(), playerId: generateId("player") };

  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      const fresh = { ...emptySaveData(), playerId: generateId("player") };
      writeSave(fresh);
      return fresh;
    }

    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const result: SaveData = {
      version: SAVE_DATA_VERSION,
      bestWave: typeof parsed.bestWave === "number" ? parsed.bestWave : 0,
      essence: typeof parsed.essence === "number" ? parsed.essence : 0,
      lastPlayedAt: typeof parsed.lastPlayedAt === "number" ? parsed.lastPlayedAt : null,
      currentWave: typeof parsed.currentWave === "number" ? parsed.currentWave : 0,
      gold: typeof parsed.gold === "number" ? parsed.gold : RUN_START.startingGold,
      towerLoadout: parseTowerLoadout(parsed.towerLoadout),
      inventory: parseInventory(parsed.inventory),
      cosmetics: Array.isArray(parsed.cosmetics) ? parsed.cosmetics : [],
      xp: typeof parsed.xp === "number" ? parsed.xp : 0,
      materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      discoveredEnemyTypes: parseDiscoveredEnemyTypes(parsed.discoveredEnemyTypes),
      // Self-healing: a save written before this field existed (or with it
      // somehow blank) gets a real id assigned and persisted right here,
      // once — every ItemInstance/TradeSession/WorldFirst record needs a
      // stable owner id to mean anything.
      playerId: typeof parsed.playerId === "string" && parsed.playerId.length > 0 ? parsed.playerId : generateId("player"),
      bossesDefeatedTotal: typeof parsed.bossesDefeatedTotal === "number" ? parsed.bossesDefeatedTotal : 0,
      miniBossesDefeatedTotal: typeof parsed.miniBossesDefeatedTotal === "number" ? parsed.miniBossesDefeatedTotal : 0,
      localFirstDiscoveries: parseLocalFirstDiscoveries(parsed.localFirstDiscoveries),
    };
    if (result.playerId !== parsed.playerId) writeSave(result);
    return result;
  } catch {
    return { ...emptySaveData(), playerId: generateId("player") };
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
