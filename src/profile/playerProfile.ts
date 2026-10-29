import type { SaveData } from "@/engine/SaveSystem";
import { TOWER_TYPES, MAX_TOWER_LEVEL, type TowerType } from "@/config/towerStats";
import { getTowerSkinDefinition, PRESTIGE_TOWER_SKINS, TOWER_SKINS } from "@/config/towerSkins";
import { getSpecializationsForTower } from "@/config/specializations";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getCastleSkinDefinition } from "@/config/castleSkins";
import type { SpecializationId } from "@/config/specializations";

/**
 * PUBLIC PLAYER PROFILE — the read-only "show-off" snapshot other players
 * see when they open someone from the Ranking: towers with their levels,
 * mastery, specialization, equipped items and skins, plus the account's
 * records. It is deliberately a SEPARATE, small, versioned shape (never the
 * raw SaveData): it carries nothing private (no gems, gold, inventory
 * contents, trades or ids of item instances) and it is what a future server
 * stores and serves. `parsePublicProfile` is the single gate every profile
 * coming from outside (server, another player) must pass through — unknown
 * towers/skins/items are dropped and every number is clamped, so a bad or
 * tampered payload can never break the screen.
 */
export const PROFILE_SCHEMA_VERSION = 1;

export interface PublicTowerSnapshot {
  type: TowerType;
  /** How many of this tower the player currently has on the map. */
  placed: number;
  /** Highest level among the player's towers of this type (0 = none built this Season). */
  bestLevel: number;
  masteryUnlocked: boolean;
  masteryLevel: number;
  specializationId: SpecializationId | null;
  specializationLevel: number;
  /** Skin shown on the player's preferred tower of this type (null = default look). */
  equippedSkinId: string | null;
  /** Every skin of this tower type the player owns. */
  ownedSkinIds: string[];
  /** Item definitions equipped on the player's best tower of this type. */
  equippedItemIds: string[];
}

export interface PublicPlayerProfile {
  schemaVersion: number;
  playerId: string;
  displayName: string;
  /** Epoch ms of the snapshot. */
  updatedAt: number;
  seasonBestWave: number;
  bestWave: number;
  prestigeLevel: number;
  seasonsWon: number;
  top3: number;
  top5: number;
  bossesDefeated: number;
  miniBossesDefeated: number;
  castleSkinIds: string[];
  towers: PublicTowerSnapshot[];
}

export const DISPLAY_NAME_MAX = 20;

/** Trims, collapses whitespace and strips control/markup characters; falls back to a name derived from the id. */
export function sanitizeDisplayName(raw: unknown, playerId: string): string {
  const cleaned = typeof raw === "string" ? raw.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, DISPLAY_NAME_MAX) : "";
  return cleaned.length >= 2 ? cleaned : defaultDisplayName(playerId);
}

export function defaultDisplayName(playerId: string): string {
  const tag = playerId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "0000";
  return `Defensor #${tag}`;
}

const clampInt = (v: unknown, min: number, max: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(min, Math.min(max, n));
};

/** Builds the public snapshot of the local player from their save. */
export function buildProfileFromSave(save: SaveData, displayName: string, now = Date.now()): PublicPlayerProfile {
  const itemDefByInstance = new Map<string, string>();
  for (const item of [...save.inventory, ...(save.overflowInventory ?? [])]) itemDefByInstance.set(item.instanceId, item.itemDefinitionId);

  const towers: PublicTowerSnapshot[] = TOWER_TYPES.map((type) => {
    const mine = save.towerLoadout.filter((t) => t.type === type);
    const best = mine.reduce<(typeof mine)[number] | null>((b, t) => (!b || t.level > b.level ? t : b), null);
    // Prefer the tower that actually carries a specialization for that read-out.
    const specced = mine.filter((t) => t.specializationId).sort((a, b) => (b.specializationLevel ?? 0) - (a.specializationLevel ?? 0))[0];
    const equippedSkin = best?.equippedSkinId ?? save.equippedTowerSkinByType[type] ?? null;
    return {
      type,
      placed: mine.length,
      bestLevel: best?.level ?? 0,
      masteryUnlocked: save.masteryUnlocked[type] === true,
      masteryLevel: save.towerMasteryLevels[type] ?? 0,
      specializationId: specced?.specializationId ?? null,
      specializationLevel: specced?.specializationLevel ?? 0,
      equippedSkinId: equippedSkin,
      ownedSkinIds: save.ownedTowerSkinIds.filter((id) => getTowerSkinDefinition(id)?.towerType === type),
      equippedItemIds: (best?.equippedItemInstanceIds ?? []).flatMap((id) => {
        const def = id ? itemDefByInstance.get(id) : undefined;
        return def ? [def] : [];
      }),
    };
  });

  return parsePublicProfile({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    playerId: save.playerId,
    displayName,
    updatedAt: now,
    seasonBestWave: save.seasonBestWave,
    bestWave: save.bestWave,
    prestigeLevel: save.prestigeLevel,
    seasonsWon: save.ascensionSeasonsWon,
    top3: save.ascensionTop3,
    top5: save.ascensionTop5,
    bossesDefeated: save.bossesDefeatedTotal,
    miniBossesDefeated: save.miniBossesDefeatedTotal,
    castleSkinIds: save.unlockedCastleSkinIds,
    towers,
  })!;
}

const BIG = 1_000_000_000;

/** Validates/normalizes any profile payload from outside. Returns null when it isn't a usable profile. */
export function parsePublicProfile(raw: unknown): PublicPlayerProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const playerId = typeof r.playerId === "string" ? r.playerId.slice(0, 64) : "";
  if (!playerId) return null;
  const rawTowers = Array.isArray(r.towers) ? r.towers : [];
  const towers: PublicTowerSnapshot[] = TOWER_TYPES.map((type) => {
    const t = (rawTowers.find((x) => x && typeof x === "object" && (x as Record<string, unknown>).type === type) ?? {}) as Record<string, unknown>;
    const specs = getSpecializationsForTower(type);
    const specializationId = specs.find((s) => s.id === t.specializationId)?.id ?? null;
    const skinOk = (id: unknown): id is string => typeof id === "string" && getTowerSkinDefinition(id)?.towerType === type;
    const ownedSkinIds = Array.isArray(t.ownedSkinIds) ? [...new Set(t.ownedSkinIds.filter(skinOk))] : [];
    return {
      type,
      placed: clampInt(t.placed, 0, 99),
      bestLevel: clampInt(t.bestLevel, 0, MAX_TOWER_LEVEL),
      masteryUnlocked: t.masteryUnlocked === true,
      masteryLevel: clampInt(t.masteryLevel, 0, BIG),
      specializationId,
      specializationLevel: specializationId ? clampInt(t.specializationLevel, 0, BIG) : 0,
      equippedSkinId: skinOk(t.equippedSkinId) ? t.equippedSkinId : null,
      ownedSkinIds,
      equippedItemIds: Array.isArray(t.equippedItemIds)
        ? t.equippedItemIds.filter((id): id is string => typeof id === "string" && getItemDefinition(id) !== null).slice(0, 8)
        : [],
    };
  });
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    playerId,
    displayName: sanitizeDisplayName(r.displayName, playerId),
    updatedAt: clampInt(r.updatedAt, 0, Number.MAX_SAFE_INTEGER),
    seasonBestWave: clampInt(r.seasonBestWave, 0, BIG),
    bestWave: clampInt(r.bestWave, 0, BIG),
    prestigeLevel: clampInt(r.prestigeLevel, 0, BIG),
    seasonsWon: clampInt(r.seasonsWon, 0, BIG),
    top3: clampInt(r.top3, 0, BIG),
    top5: clampInt(r.top5, 0, BIG),
    bossesDefeated: clampInt(r.bossesDefeated, 0, BIG),
    miniBossesDefeated: clampInt(r.miniBossesDefeated, 0, BIG),
    castleSkinIds: Array.isArray(r.castleSkinIds)
      ? [...new Set(r.castleSkinIds.filter((id): id is string => typeof id === "string" && getCastleSkinDefinition(id) !== null))]
      : [],
    towers,
  };
}

/** Total skins owned across every tower type — the headline "collection" number. */
export function countOwnedSkins(profile: PublicPlayerProfile): number {
  return profile.towers.reduce((n, t) => n + t.ownedSkinIds.length, 0);
}

export const TOTAL_TOWER_SKINS = TOWER_SKINS.length + PRESTIGE_TOWER_SKINS.length;
