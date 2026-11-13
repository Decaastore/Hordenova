import type { RewardBundle } from "./rewardBundle";
import type { SaveData } from "@/engine/SaveSystem";
import { ITEM_DEFINITIONS } from "./itemDefinitions";
import { TOWER_SKINS } from "./towerSkins";
import { CASTLE_SKINS } from "./castleSkins";
import { ENEMY_TYPES } from "./enemyStats";
import type { TowerType } from "./towerStats";

/**
 * COLEÇÕES — albums of things to collect. Each album lists its entries
 * (owned or not) and pays a reward at each milestone. Completing the
 * Bestiary album gives the Void Spire castle skin.
 */
export type CollectionId = "ARSENAL" | "SKINS_IRONWOOD" | "SKINS_INFERNO" | "SKINS_FROSTBORN" | "SKINS_STORMCALLER" | "CASTLES" | "BESTIARY";

export interface CollectionEntry {
  id: string;
  /** i18n key for the entry's name (rendered by the page). */
  labelKey: string;
  owned: boolean;
}

export interface CollectionMilestone {
  count: number;
  reward: RewardBundle;
}

export interface CollectionDef {
  id: CollectionId;
  entries: (s: SaveData) => CollectionEntry[];
  milestones: readonly CollectionMilestone[];
}

const towerAlbum = (type: TowerType): CollectionDef => ({
  id: `SKINS_${type}` as CollectionId,
  entries: (s) => TOWER_SKINS.filter((k) => k.towerType === type).map((k) => ({ id: k.id, labelKey: `towerSkins.${k.i18nKey}.name`, owned: s.ownedTowerSkinIds.includes(k.id) })),
  milestones: [
    { count: 3, reward: { shards: 10 } },
    { count: 6, reward: { splinters: 60, freeGems: 1 } },
    { count: 9, reward: { freeGems: 2, epic: 1 } },
  ],
});

/** Every item kind this account has ever held (save.discoveredItemIds plus whatever it holds right now). */
export function discoveredItems(s: SaveData): Set<string> {
  const set = new Set(s.discoveredItemIds);
  for (const it of [...s.inventory, ...s.overflowInventory]) set.add(it.itemDefinitionId);
  return set;
}

export const COLLECTIONS: readonly CollectionDef[] = [
  {
    id: "ARSENAL",
    entries: (s) => {
      const have = discoveredItems(s);
      return Object.values(ITEM_DEFINITIONS).map((d) => ({ id: d.id, labelKey: `items.${d.i18nKey}.name`, owned: have.has(d.id) }));
    },
    milestones: [
      { count: 2, reward: { shards: 10 } },
      { count: 4, reward: { splinters: 40, rare: 3 } },
      { count: 6, reward: { freeGems: 3 } },
    ],
  },
  towerAlbum("IRONWOOD"),
  towerAlbum("INFERNO"),
  towerAlbum("FROSTBORN"),
  towerAlbum("STORMCALLER"),
  {
    id: "CASTLES",
    entries: (s) => CASTLE_SKINS.map((c) => ({ id: c.id, labelKey: `castleSkins.${c.i18nKey}.name`, owned: s.unlockedCastleSkinIds.includes(c.id) })),
    milestones: [
      { count: 2, reward: { shards: 15 } },
      { count: 4, reward: { freeGems: 2 } },
    ],
  },
  {
    id: "BESTIARY",
    entries: (s) => ENEMY_TYPES.map((e) => ({ id: e, labelKey: `enemies.${e}.name`, owned: s.discoveredEnemyTypes.includes(e) })),
    milestones: [
      { count: 10, reward: { shards: 10 } },
      { count: 25, reward: { splinters: 60 } },
      { count: ENEMY_TYPES.length, reward: { castleSkinId: "VOID_SPIRE", freeGems: 2 } },
    ],
  },
];

export interface CollectionsState {
  /** "<collectionId>:<count>" milestones already paid. */
  claimed: string[];
}

export function sanitizeCollectionsState(raw: unknown): CollectionsState {
  if (!raw || typeof raw !== "object") return { claimed: [] };
  const r = raw as Record<string, unknown>;
  return { claimed: Array.isArray(r.claimed) ? [...new Set((r.claimed as unknown[]).filter((x): x is string => typeof x === "string"))] : [] };
}

export const milestoneKey = (id: CollectionId, count: number) => `${id}:${count}`;

export function claimMilestone(s: SaveData, id: CollectionId, count: number): { state: CollectionsState; reward: RewardBundle } | null {
  const c = COLLECTIONS.find((x) => x.id === id);
  const m = c?.milestones.find((x) => x.count === count);
  if (!c || !m) return null;
  const key = milestoneKey(id, count);
  if (s.collections.claimed.includes(key)) return null;
  if (c.entries(s).filter((e) => e.owned).length < count) return null;
  return { state: { claimed: [...s.collections.claimed, key] }, reward: m.reward };
}

/** How many milestones are ready to claim right now (for badges). */
export function claimableMilestones(s: SaveData): number {
  let n = 0;
  for (const c of COLLECTIONS) {
    const owned = c.entries(s).filter((e) => e.owned).length;
    for (const m of c.milestones) if (owned >= m.count && !s.collections.claimed.includes(milestoneKey(c.id, m.count))) n++;
  }
  return n;
}
