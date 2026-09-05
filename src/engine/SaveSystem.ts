import { RUN_START, SAVE_STORAGE_KEY } from "@/config/gameBalance";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { ENEMY_TYPES, type EnemyType } from "@/config/enemyStats";
import { SPECIALIZATIONS_BY_TOWER, type SpecializationId } from "@/config/specializations";
import { getTowerSkinDefinition } from "@/config/towerSkins";
import { DEFAULT_INVENTORY_CAPACITY } from "./InventoryManager";
import type { TowerLoadoutEntry } from "@/entities/Tower";
import type { ItemInstance } from "@/entities/Item";
import type { LocalFirstDiscoveries } from "./WorldFirst";
import type { AscensionHistoryEntry, SeasonRewardRecord } from "@/config/ascension";
import { generateId } from "@/utils/id";
import { seasonClock } from "./SeasonClock";

/**
 * Master Implementation spec section 2/36 — the ASCENSION season's own
 * playthrough state (its temporary wave/gold/towerLoadout) is stored as a
 * COMPLETELY SEPARATE SaveData blob, under this key, rather than a new
 * field bag bolted onto the Infinite save above — that's what makes "dois
 * modos completamente separados" true architecturally, not just by
 * convention: GameEngine doesn't need a single line of mode-branching
 * logic, it just gets pointed at a different storageKey (see
 * GameEngine.ts's constructor and engine/AscensionManager.ts, which owns
 * resetting this namespace at each season boundary). Anything that must
 * survive that reset (history, trophies, rank counters, owned cosmetic
 * rewards) lives on the PERMANENT (Infinite) SaveData below instead.
 */
export const ASCENSION_STORAGE_KEY = "hordenova.ascension.save.v1";

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
  /** Audio spec section 13 — 0..1, but only ever set to one of the 5 discrete UI steps (0/0.25/0.5/0.75/1). */
  sfxVolume: number;
  sfxMuted: boolean;
  /** Progression 2.0 spec section 33/37 — the convenience/cosmetics currency. Never a combat-power lever, see engine/GameEngine.ts's GemManager-pattern methods. */
  gems: number;
  /** Progression 2.0 spec section 34 — earned from bosses/milestones, manually convertible to Gems at a fixed rate (see GameEngine.convertGemShards). */
  gemShards: number;
  /** Progression 2.0 spec section 36/39 — usable inventory slots. Starts at DEFAULT_INVENTORY_CAPACITY; a future Gem-purchased expansion raises this. */
  inventoryCapacity: number;
  /** Progression 2.0 spec section 39 — items that arrived while the inventory was full. Never deleted; the player reclaims them by freeing a slot. */
  overflowInventory: ItemInstance[];

  // -----------------------------------------------------------------------
  // Master Implementation spec sections 1-24 — ASCENSION. Every field below
  // is PERMANENT (survives every season reset) even though it's all
  // derived from playing the temporary Ascension namespace (see
  // ASCENSION_STORAGE_KEY above and engine/AscensionManager.ts). None of
  // these ever grant gameplay power — history/counters are read-only
  // records, and gems/ownedCosmetics follow the exact same "never buys
  // stats" rule as the rest of the Gem economy.
  // -----------------------------------------------------------------------
  /** The last season number this save has fully processed (finalized + reset the Ascension namespace for). Defaults to the CURRENT season on a fresh/legacy save — never retroactively "owes" finalization for seasons that existed before this save ever touched Ascension. */
  ascensionLastSyncedSeason: number;
  /** One entry per season this save has ever finalized — permanent, append-only, never trimmed. The authoritative idempotency guard for season-reward granting (see AscensionManager.finalizeSeason). */
  ascensionHistory: AscensionHistoryEntry[];
  ascensionSeasonsWon: number;
  ascensionTop3: number;
  ascensionTop5: number;
  /** CosmeticRewardDefinition ids this save has ever been granted, from any season — permanent, never removed. */
  ownedCosmetics: string[];
  /** Full provenance record (spec section 24: SeasonId/PlayerId/RewardId/RewardType/Rank/GrantedAt) for every individual reward ever granted, Gems included — permanent, append-only, never trimmed. See config/ascension.ts's SeasonRewardRecord doc comment for why this exists alongside (not instead of) ownedCosmetics. */
  seasonRewardRecords: SeasonRewardRecord[];

  // -----------------------------------------------------------------------
  // Master Implementation spec sections 46-48 — the every-10-wave Roulette
  // (config/roulette.ts). Both fields are PERMANENT: a Castle HP bump or a
  // won Castle Skin is a real, lasting reward, never wiped by a retry after
  // PROGRESSION_STOPPED (see GameEngine.ts's resetAttemptState, which resets
  // baseHp to maxBaseHp — itself now RUN_START.baseHp + castleHpBonus, not a
  // fixed constant).
  // -----------------------------------------------------------------------
  /** Cumulative permanent bonus to max Castle HP, from every CASTLE_HP_* roulette win ever landed — never decreases. */
  castleHpBonus: number;
  /** config/castleSkins.ts CastleSkinDefinition ids this save has unlocked via the Roulette's CASTLE_SKIN outcome — permanent, non-consumable, never removed (spec section 48: "deve ser permanente... nunca desaparecer"). */
  unlockedCastleSkinIds: string[];

  /** Master Implementation Pass spec section 7-8 — PROFILE PRESTIGE: the recurring, uncapped, purely-cosmetic Gem sink (config/prestige.ts). Account-wide, never per-tower. 0 = never invested. */
  prestigeLevel: number;

  /**
   * AUDITORIA E CORREÇÃO GERAL spec sections 1-3, 9-13 — wave milestones
   * (config/roulette.ts's ROULETTE_MILESTONE_INTERVAL) whose Roulette has
   * been unlocked but NOT yet spun by the player. MUST be persisted (unlike
   * the purely-transient post-spin result banner) — losing this to a
   * reload would mean losing a reward the player never got the chance to
   * claim, not just losing a toast. Never auto-resolved by anything that
   * reads this array; only GameEngine.spinPendingRoulette() ever removes an
   * entry, and only in response to a real player click.
   */
  pendingRouletteSpinWaves: number[];

  /**
   * HORDENOVA — PRÓXIMA GRANDE FASE spec, "DECISÃO DEFINITIVA SOBRE
   * PROGRESSÃO": the account's single permanent save NEVER resets for a
   * Season boundary — towers/gold/gems/Tower Mastery/Prestige/items/
   * collection/skins/unlocks all keep going forever, exactly like
   * `bestWave` above always has. Season is purely a competitive window
   * layered on top: `seasonBestWave` is a SEPARATE high-water mark of the
   * SAME `currentWave` progress, tracked identically to `bestWave` (see
   * GameEngine.advanceBestWave/recordRunResult, which update both), except
   * it resets to 0 only when a season boundary is crossed (see
   * AscensionManager.syncSeasonIfNeeded) — never on a retry, never for any
   * other reason. `bestWave` (the account's all-time record) and
   * `seasonBestWave` (this season's record) can and will diverge the
   * moment a season rolls over, by design.
   */
  seasonBestWave: number;

  // -----------------------------------------------------------------------
  // HORDENOVA — PRÓXIMA GRANDE FASE spec, "CORREÇÃO DE REQUISITOS": a
  // player's build (tower LEVEL, specialization progress, Gold) is
  // SEASONAL — it resets to a fresh start at every Season boundary (see
  // AscensionManager.syncSeasonIfNeeded), exactly like `towerLoadout`/
  // `gold`/`currentWave` above. Tower Mastery and Tower Skin OWNERSHIP are
  // the opposite: permanent, account-wide, and untouched by that reset —
  // moved out of TowerLoadoutEntry (which IS wiped each season) into their
  // own top-level fields here. Mastery is funded by GEMS, never Gold (a
  // deliberate, explicit exception to the Gem economy's usual
  // never-buys-power rule — see config/gemSinks.ts's doc comment for why).
  // -----------------------------------------------------------------------
  /** Permanent per-tower-TYPE Mastery level (0 = never invested) — survives every Season reset. Applied to a freshly-placed tower of that type via GameEngine.instantiateTowerFromLoadout/placeTower. */
  towerMasteryLevels: Partial<Record<TowerType, number>>;
  /** Permanent record of every Tower Skin id this account has ever unlocked (by reaching its unlockLevel on some tower, in any Season) — mirrors unlockedCastleSkinIds. Never removed once granted, regardless of the tower's current (seasonal) level. */
  ownedTowerSkinIds: string[];
  /** Permanent per-tower-TYPE equipped-skin preference, auto-reapplied whenever a tower of that type is placed in a future Season — so an owned skin doesn't visually vanish just because the season reset the tower itself. Absent/undefined = default look. */
  equippedTowerSkinByType: Partial<Record<TowerType, string>>;
}

export const SAVE_DATA_VERSION = 14;

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
  sfxVolume: 1,
  sfxMuted: false,
  gems: 0,
  gemShards: 0,
  inventoryCapacity: DEFAULT_INVENTORY_CAPACITY,
  overflowInventory: [],
  ascensionLastSyncedSeason: seasonClock.getCurrentSeasonWindow().seasonNumber,
  ascensionHistory: [],
  ascensionSeasonsWon: 0,
  ascensionTop3: 0,
  ascensionTop5: 0,
  ownedCosmetics: [],
  seasonRewardRecords: [],
  castleHpBonus: 0,
  unlockedCastleSkinIds: [],
  prestigeLevel: 0,
  pendingRouletteSpinWaves: [],
  seasonBestWave: 0,
  towerMasteryLevels: {},
  ownedTowerSkinIds: [],
  equippedTowerSkinByType: {},
};

const VALID_SFX_VOLUME_STEPS = new Set([0, 0.25, 0.5, 0.75, 1]);

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
      const entry = item as Partial<TowerLoadoutEntry> & { type: TowerType };
      // Self-healing: a specializationId that doesn't belong to this
      // tower's own type (corrupted save, or a save from before this
      // field existed) is dropped back to null rather than trusted as-is.
      const validSpecIds = new Set<SpecializationId>(SPECIALIZATIONS_BY_TOWER[entry.type].map((s) => s.id));
      const specializationId =
        typeof entry.specializationId === "string" && validSpecIds.has(entry.specializationId as SpecializationId)
          ? (entry.specializationId as SpecializationId)
          : null;
      const skinDef = typeof entry.equippedSkinId === "string" ? getTowerSkinDefinition(entry.equippedSkinId) : null;
      entries.push({
        slotId: entry.slotId as string,
        type: entry.type,
        level: entry.level as number,
        specializationId,
        specializationLevel: specializationId && typeof entry.specializationLevel === "number" ? entry.specializationLevel : 0,
        equippedSkinId: skinDef && skinDef.towerType === entry.type ? skinDef.id : null,
        masteryLevel: typeof entry.masteryLevel === "number" && entry.masteryLevel >= 0 ? entry.masteryLevel : 0,
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
  return {
    ...DEFAULT_SAVE_DATA,
    towerLoadout: [],
    inventory: [],
    cosmetics: [],
    materials: [],
    discoveredEnemyTypes: [],
    localFirstDiscoveries: {},
    overflowInventory: [],
    ascensionHistory: [],
    ownedCosmetics: [],
    seasonRewardRecords: [],
    unlockedCastleSkinIds: [],
    pendingRouletteSpinWaves: [],
  };
}

function isValidAscensionHistoryEntry(raw: unknown): raw is AscensionHistoryEntry {
  if (!raw || typeof raw !== "object") return false;
  const e = raw as Partial<AscensionHistoryEntry>;
  return (
    typeof e.seasonNumber === "number" &&
    typeof e.bestWave === "number" &&
    (e.rank === null || (typeof e.rank === "number" && e.rank >= 1 && e.rank <= 5)) &&
    typeof e.achievedAtMs === "number" &&
    typeof e.seasonThemeNameKey === "string"
  );
}

function parseAscensionHistory(raw: unknown): AscensionHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidAscensionHistoryEntry);
}

function parseOwnedCosmetics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function isValidSeasonRewardRecord(raw: unknown): raw is SeasonRewardRecord {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Partial<SeasonRewardRecord>;
  return (
    typeof r.seasonId === "string" &&
    typeof r.seasonNumber === "number" &&
    typeof r.playerId === "string" &&
    typeof r.rewardId === "string" &&
    typeof r.rewardType === "string" &&
    typeof r.rank === "number" &&
    r.rank >= 1 &&
    r.rank <= 5 &&
    typeof r.grantedAt === "number"
  );
}

function parseSeasonRewardRecords(raw: unknown): SeasonRewardRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidSeasonRewardRecord);
}

function parseUnlockedCastleSkinIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

/** Self-healing parse for `ownedTowerSkinIds` — same shape as parseUnlockedCastleSkinIds (an id list), kept as its own named function since it's a conceptually distinct permanent field. */
function parseOwnedTowerSkinIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

/** Self-healing parse for `pendingRouletteSpinWaves` — drops anything that isn't a positive integer wave number instead of trusting a corrupted/tampered save. */
function parseWaveNumberArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is number => typeof entry === "number" && Number.isInteger(entry) && entry > 0);
}

const VALID_TOWER_TYPES = new Set<TowerType>(TOWER_TYPES);

/** Self-healing parse for `towerMasteryLevels` — drops any key that isn't a real TowerType or any value that isn't a non-negative integer. */
function parseTowerMasteryLevels(raw: unknown): Partial<Record<TowerType, number>> {
  if (!raw || typeof raw !== "object") return {};
  const result: Partial<Record<TowerType, number>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (VALID_TOWER_TYPES.has(key as TowerType) && typeof value === "number" && value >= 0) {
      result[key as TowerType] = value;
    }
  }
  return result;
}

/** Self-healing parse for `equippedTowerSkinByType` — drops any key that isn't a real TowerType, or a skin id that doesn't actually belong to that tower type. */
function parseEquippedTowerSkinByType(raw: unknown): Partial<Record<TowerType, string>> {
  if (!raw || typeof raw !== "object") return {};
  const result: Partial<Record<TowerType, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_TOWER_TYPES.has(key as TowerType) || typeof value !== "string") continue;
    const skin = getTowerSkinDefinition(value);
    if (skin && skin.towerType === key) result[key as TowerType] = value;
  }
  return result;
}

/** `storageKey` defaults to the Infinite (permanent) save — pass ASCENSION_STORAGE_KEY to read/write the separate, temporary Ascension namespace instead (see the const's own doc comment above). Both use the exact same SaveData shape and this exact same function — Ascension gameplay is architecturally just "GameEngine pointed at a different key", not a second parser. */
export function loadSave(storageKey: string = SAVE_STORAGE_KEY): SaveData {
  if (!isStorageAvailable()) return { ...emptySaveData(), playerId: generateId("player") };

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      const fresh = { ...emptySaveData(), playerId: generateId("player") };
      writeSave(fresh, storageKey);
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
      sfxVolume: typeof parsed.sfxVolume === "number" && VALID_SFX_VOLUME_STEPS.has(parsed.sfxVolume) ? parsed.sfxVolume : 1,
      sfxMuted: typeof parsed.sfxMuted === "boolean" ? parsed.sfxMuted : false,
      // Progression 2.0 (save v5 -> v6) — every field below is brand new,
      // so any save written before this migration simply gets the
      // DEFAULT_SAVE_DATA value here rather than needing a special
      // migration branch: "gems: 0 / gemShards: 0 / a full-size fresh
      // inventoryCapacity / an empty overflow" is exactly what a save that
      // never had a Gem economy SHOULD start at.
      gems: typeof parsed.gems === "number" && parsed.gems >= 0 ? parsed.gems : 0,
      gemShards: typeof parsed.gemShards === "number" && parsed.gemShards >= 0 ? parsed.gemShards : 0,
      inventoryCapacity:
        typeof parsed.inventoryCapacity === "number" && parsed.inventoryCapacity > 0
          ? parsed.inventoryCapacity
          : DEFAULT_INVENTORY_CAPACITY,
      overflowInventory: parseInventory(parsed.overflowInventory),
      // Master Implementation (save v6 -> v7) — same "brand new field, so a
      // pre-existing save just gets the sensible fresh-account default"
      // pattern as the v5->v6 Gem Economy fields above. ascensionLastSyncedSeason
      // defaults to the CURRENT season (not 0/1) specifically so a save
      // that's never touched Ascension doesn't retroactively "owe"
      // finalizing every season since SEASON_EPOCH_MS the instant it does.
      ascensionLastSyncedSeason:
        typeof parsed.ascensionLastSyncedSeason === "number" && parsed.ascensionLastSyncedSeason > 0
          ? parsed.ascensionLastSyncedSeason
          : seasonClock.getCurrentSeasonWindow().seasonNumber,
      ascensionHistory: parseAscensionHistory(parsed.ascensionHistory),
      ascensionSeasonsWon: typeof parsed.ascensionSeasonsWon === "number" && parsed.ascensionSeasonsWon >= 0 ? parsed.ascensionSeasonsWon : 0,
      ascensionTop3: typeof parsed.ascensionTop3 === "number" && parsed.ascensionTop3 >= 0 ? parsed.ascensionTop3 : 0,
      ascensionTop5: typeof parsed.ascensionTop5 === "number" && parsed.ascensionTop5 >= 0 ? parsed.ascensionTop5 : 0,
      ownedCosmetics: parseOwnedCosmetics(parsed.ownedCosmetics),
      // Master Implementation (save v7 -> v8) — same "brand new field,
      // sensible empty default for a pre-existing save" pattern as
      // ascensionLastSyncedSeason above.
      seasonRewardRecords: parseSeasonRewardRecords(parsed.seasonRewardRecords),
      // Master Implementation (save v8 -> v9) — same pattern once more.
      castleHpBonus: typeof parsed.castleHpBonus === "number" && parsed.castleHpBonus >= 0 ? parsed.castleHpBonus : 0,
      unlockedCastleSkinIds: parseUnlockedCastleSkinIds(parsed.unlockedCastleSkinIds),
      // Master Implementation Pass (save v10 -> v11) — same pattern once more.
      prestigeLevel: typeof parsed.prestigeLevel === "number" && parsed.prestigeLevel >= 0 ? parsed.prestigeLevel : 0,
      // AUDITORIA E CORREÇÃO GERAL (save v11 -> v12) — a pre-existing save
      // never had pending Roulette spins tracked at all (every Roulette
      // used to auto-resolve instantly), so an empty queue is the only
      // correct default; nothing was ever "missed" for it to represent.
      pendingRouletteSpinWaves: parseWaveNumberArray(parsed.pendingRouletteSpinWaves),
      // PRÓXIMA GRANDE FASE (save v12 -> v13) — a pre-existing save never
      // tracked a season-scoped high-water mark separately from its
      // all-time bestWave; 0 is the only correct default (nothing was
      // "achieved this season" before this field existed to record it).
      seasonBestWave: typeof parsed.seasonBestWave === "number" && parsed.seasonBestWave >= 0 ? parsed.seasonBestWave : 0,
      // CORREÇÃO DE REQUISITOS — Tower Mastery, owned skins, and equipped
      // skins are permanent account-wide state (unlike tower level/loadout,
      // which are Season-scoped and live only in towerLoadout). A
      // pre-existing save never tracked these separately, so empty is the
      // only correct default.
      towerMasteryLevels: parseTowerMasteryLevels(parsed.towerMasteryLevels),
      ownedTowerSkinIds: parseOwnedTowerSkinIds(parsed.ownedTowerSkinIds),
      equippedTowerSkinByType: parseEquippedTowerSkinByType(parsed.equippedTowerSkinByType),
    };
    if (result.playerId !== parsed.playerId) writeSave(result, storageKey);
    return result;
  } catch {
    return { ...emptySaveData(), playerId: generateId("player") };
  }
}

export function writeSave(data: SaveData, storageKey: string = SAVE_STORAGE_KEY): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // Storage unavailable/full — progress simply won't persist this session.
  }
}

/** Loads, applies `updates`, writes back, and returns the merged result. Pass ASCENSION_STORAGE_KEY as `storageKey` to update the separate Ascension namespace instead of the Infinite save. */
export function updateSave(updates: Partial<SaveData>, storageKey: string = SAVE_STORAGE_KEY): SaveData {
  const current = loadSave(storageKey);
  const next: SaveData = { ...current, ...updates, lastPlayedAt: Date.now() };
  writeSave(next, storageKey);
  return next;
}

export function recordRunResult(waveReached: number, storageKey: string = SAVE_STORAGE_KEY): SaveData {
  const current = loadSave(storageKey);
  return updateSave(
    {
      bestWave: Math.max(current.bestWave, waveReached),
      seasonBestWave: Math.max(current.seasonBestWave, waveReached),
    },
    storageKey,
  );
}
