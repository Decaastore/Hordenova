import {
  BOSS_INTRO_DURATION_MS,
  BOSS_VICTORY_DURATION_MS,
  GAME_SPEEDS,
  OFFLINE_RETURN_MIN_ELAPSED_MS,
  RUN_START,
  SAVE_STORAGE_KEY,
  type GameSpeed,
} from "@/config/gameBalance";
import { TOWER_DEFINITIONS, type TowerType } from "@/config/towerStats";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { isBossMilestone, isBonusEliteWave } from "@/config/waveConfig";
import { isMiniBossWave, getMainBossForWave, getMiniBossForWave, getBossDefinitionById } from "@/config/bossConfig";
import { getMilestoneBonus, getPhaseForWave, getWaveTag } from "@/config/phaseConfig";
import { computeCastleDamage, type CastleDamageCategory } from "@/config/castleDamage";
import {
  castleHpForReward,
  rollRoulette,
  ROULETTE_CASTLE_SKIN_FALLBACK_GEMS,
  ROULETTE_GEM_REWARD_AMOUNT,
  ROULETTE_MILESTONE_INTERVAL,
  type RouletteRewardType,
} from "@/config/roulette";
import { CASTLE_SKINS } from "@/config/castleSkins";
import { canUnlockPrestige, getPrestigeBonuses, getPrestigeUpgradeCost, type PrestigeBonuses } from "@/config/prestige";
import type { EnemyType } from "@/config/enemyStats";
import { getDropTable, rollDropTable } from "@/config/dropTables";
import { createItemInstance, type ItemInstance } from "@/entities/Item";
import { addItemWithCapacity, claimFromOverflow, DEFAULT_INVENTORY_CAPACITY, findItem } from "./InventoryManager";
import { appendLedgerEvent } from "./EconomyLedger";
import { checkLocalFirst, type LocalFirstDiscoveries } from "./WorldFirst";
import {
  createTowerInstance,
  getTowerUpgradeCost,
  upgradeTower as upgradeTowerEntity,
  canChooseSpecialization,
  chooseSpecialization as chooseSpecializationEntity,
  canUpgradeSpecialization,
  getSpecializationUpgradeCostFor,
  upgradeSpecialization as upgradeSpecializationEntity,
  equipSkin as equipSkinEntity,
  canPurchaseSkin as canPurchaseSkinEntity,
  canUpgradeMastery,
  getMasteryUpgradeCostFor,
  upgradeMastery as upgradeMasteryEntity,
  canSwitchSpecialization,
  switchSpecialization as switchSpecializationEntity,
  applySiegeDamage,
  resetTowerSurvival,
  canEquipItem,
  equipItem as equipItemEntity,
  unequipItem as unequipItemEntity,
  type TowerInstance,
  type TowerLoadoutEntry,
} from "@/entities/Tower";
import { TOWER_ITEM_SLOT_COUNT } from "@/config/towerItemSlots";
import { MASTERY_UNLOCK_GEM_COST } from "@/config/towerMastery";
import { getTowerSkinDefinition } from "@/config/towerSkins";
import { SPECIALIZATION_CHANGE_GEM_COST, SPECIALIZATION_UNLOCK_GEM_COST, type SpecializationId } from "@/config/specializations";
import { REPOSITION_GEM_COST } from "@/config/repositioning";
import { getCurrentDayIndex } from "./DailyClock";
import {
  advanceEnemy,
  createEliteEnemyInstance,
  createEnemyInstance,
  isEnemyDead,
  type BossState,
  type EliteModifier,
  type EnemyInstance,
} from "@/entities/Enemy";
import { isProjectileExpired, tickProjectile, type ProjectileInstance } from "@/entities/Projectile";
import { tickCombat, tickEnemyDisableAbilities } from "./CombatSystem";
import {
  activateNextWave,
  createWaveManagerState,
  retryCurrentWave,
  tickWaveManager,
  type WaveManagerState,
} from "./WaveManager";
import { createBossInstance, tickBossAbilities, tickBossSiege } from "./BossManager";
import { SIEGE_DISABLE_ON_DEPLETION_MS } from "@/config/bossSiege";
import {
  createBattleStats,
  finalizeBattleStats,
  generateFailureReport,
  recordBaseHit,
  recordBossSnapshot,
  recordDamageEvents,
  recordKill,
  type BattleStats,
  type FailureReport,
} from "./BattleDiagnostics";
import { computeOfflineCapacityMs, simulateOfflineDefense, type OfflineSimulationResult } from "./OfflineDefense";
import { loadSave, recordRunResult, updateSave } from "./SaveSystem";
import type { RunPhase } from "./types";
import { getMilestoneUnlockForLevel } from "@/config/towerStats";
import type { EnemyAudioTier, GameAudioEvent } from "./AudioEvents";

/** Elite spec (section 5): real stat multipliers plus a passive-regen "special ability", not just a bigger HP number. */
const ELITE_MODIFIER: EliteModifier = {
  hpMultiplier: 1.4,
  speedMultiplier: 1.2,
  rewardMultiplier: 1.6,
  regenPercentPerSecond: 0.015,
};
/** Elites are always built on the Brute silhouette — a consistent "this one's different" read across every phase without needing a bespoke archetype per elite. */
const ELITE_BASE_TYPE: EnemyType = "BRUTE";

/** CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — this many consecutive boss escapes with zero kills in between is treated as a genuine wall, not bad luck (see EndgameWallReport's own doc comment). */
const ENDGAME_WALL_ESCAPE_THRESHOLD = 3;

export interface HudSnapshot {
  phase: RunPhase;
  wave: number;
  /** Current phase's id (config/phaseConfig.ts) — unique per rendered phase INSTANCE (a post-130 endgame lap gets its own suffixed id, e.g. `VOLCANIC_WASTES_ENDGAME_LAP1`), so this is NOT a valid i18n key on its own — see `phaseI18nKey` for that. */
  phaseId: string;
  /** The stable, hand-authored i18n key (`phases.<phaseI18nKey>.name`) — always one of the original PHASES entries' own id, even during an endgame rotation lap that reuses it under a suffixed `phaseId`. Use this, never `phaseId`, for any translated phase name/tagline. */
  phaseI18nKey: string;
  gold: number;
  /** Progression 2.0 — the convenience/cosmetics currency (spec section 33). Shown in the HUD, never spendable on power. */
  gems: number;
  gemShards: number;
  baseHp: number;
  maxBaseHp: number;
  speed: GameSpeed;
  bestWave: number;
  /** This Season's own high-water mark — see SaveData.seasonBestWave's doc comment. */
  seasonBestWave: number;
  enemiesDefeated: number;
  selectedTowerId: string | null;
  /** i18n key (bosses.<bossNameKey>.name) — NOT a display string. */
  bossNameKey: string | null;
  bossHp: number | null;
  bossMaxHp: number | null;
  bossIntroRemainingMs: number | null;
  /** Set only while the VICTORY beat plays — the gold the just-defeated boss dropped. */
  bossLastReward: number | null;
  /** The oldest not-yet-acknowledged newly-discovered enemy type, or null — see GameEngine.acknowledgeDiscovery. */
  pendingDiscoveryType: EnemyType | null;
  /** The most recent still-unacknowledged item drop, or null — see GameEngine.acknowledgeItemReward. Item System spec section 25/32. */
  pendingItemReward: { instanceId: string; itemDefinitionId: string } | null;
  /** The most recent still-unacknowledged Roulette spin, or null — see GameEngine.acknowledgeRouletteResult. Master Implementation spec section 46-48. */
  pendingRouletteResult: RouletteResult | null;
  /**
   * AUDITORIA E CORREÇÃO GERAL spec sections 1-3, 9, 11-13 — the oldest wave
   * milestone whose Roulette has NOT been spun yet, or null. Its reward is
   * NOT granted and its result is NOT known until the player explicitly
   * calls GameEngine.spinPendingRoulette() — crossing the milestone only
   * ever gets it into this queue, never resolves it. A UI must show a
   * "Roulette available" prompt whenever this is non-null, and keep showing
   * it (even across F5) until the player actually spins.
   */
  pendingRouletteSpinWave: number | null;
  /** BALANCEAMENTO DEFINITIVO spec section 6 — whether the account's one free Tower Repositioning for TODAY (see engine/DailyClock.ts) is still available. false means the next reposition costs REPOSITION_GEM_COST Gems (config/repositioning.ts). */
  repositionFreeAvailable: boolean;
}

/**
 * One resolved Roulette spin (spec sections 46-48) — the reward was already
 * genuinely rolled (config/roulette.ts's real weighted rollRoulette) and
 * already granted (Castle HP raised / Gems added / skin unlocked) by the
 * time this exists; a UI's "spin" animation only ever reveals this value,
 * never determines it, per spec section 47's anti-fake-pity requirement.
 */
export interface RouletteResult {
  wave: number;
  rewardType: RouletteRewardType;
  /** > 0 only for a CASTLE_HP_* outcome. */
  castleHpGranted: number;
  /** > 0 for the GEM outcome, or for a CASTLE_SKIN roll that fell back to Gems because every real skin was already owned. */
  gemsGranted: number;
  /** Set only when a real, previously-unowned Castle Skin was granted. */
  castleSkinId: string | null;
}

/**
 * CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — surfaced once
 * `ENDGAME_WALL_ESCAPE_THRESHOLD` boss fights in a row all end in an
 * ESCAPE (boss reaches the base) rather than a KILL. Distinguishes a
 * genuine "this build cannot beat any boss it's currently facing" state
 * from an ordinary, occasional escape — never freezes the game (the run
 * keeps ticking underneath exactly as before), this is purely an
 * informational banner the UI can show and dismiss (acknowledgeEndgameWallReport)
 * without blocking anything, the same "pending banner" shape as
 * pendingItemReward/pendingRouletteResult above.
 */
export interface EndgameWallReport {
  bossId: string;
  bossNameKey: string;
  wave: number;
  bestWave: number;
  /** Best fraction (0..1) of the boss's HP actually brought down across the whole streak, not just the last attempt. */
  bestDamageFraction: number;
  consecutiveEscapes: number;
  /** Reuses the exact same rule-based diagnosis PROGRESSION_STOPPED shows — real recorded battle data, never randomized. */
  diagnosis: FailureReport;
}

export interface RenderSnapshot {
  phase: RunPhase;
  towers: readonly TowerInstance[];
  enemies: readonly EnemyInstance[];
  projectiles: readonly ProjectileInstance[];
  selectedTowerId: string | null;
  biomeId: string;
}

function hudSnapshotsEqual(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.phase === b.phase &&
    a.wave === b.wave &&
    a.phaseId === b.phaseId &&
    a.gold === b.gold &&
    a.gems === b.gems &&
    a.gemShards === b.gemShards &&
    a.baseHp === b.baseHp &&
    a.maxBaseHp === b.maxBaseHp &&
    a.speed === b.speed &&
    a.bestWave === b.bestWave &&
    a.seasonBestWave === b.seasonBestWave &&
    a.enemiesDefeated === b.enemiesDefeated &&
    a.selectedTowerId === b.selectedTowerId &&
    a.bossNameKey === b.bossNameKey &&
    a.bossHp === b.bossHp &&
    a.bossMaxHp === b.bossMaxHp &&
    a.bossIntroRemainingMs === b.bossIntroRemainingMs &&
    a.bossLastReward === b.bossLastReward &&
    a.pendingDiscoveryType === b.pendingDiscoveryType &&
    a.pendingItemReward?.instanceId === b.pendingItemReward?.instanceId &&
    a.pendingRouletteResult?.wave === b.pendingRouletteResult?.wave &&
    a.pendingRouletteResult?.rewardType === b.pendingRouletteResult?.rewardType &&
    a.pendingRouletteSpinWave === b.pendingRouletteSpinWave &&
    a.repositionFreeAvailable === b.repositionFreeAvailable
  );
}

/**
 * Single source of truth for progression. Owns all mutable game state and
 * the only public methods allowed to change it. Rendering code only ever
 * READS via getRenderSnapshot()/getHudSnapshot() — see rendering/ layer.
 *
 * Core Gameplay + Progression + Active Idle model: towers, gold and the
 * current wave/phase are PERSISTENT (see engine/SaveSystem.ts) — they
 * survive across attempts and reloads. Only the moment-to-moment battle
 * state (live enemies/projectiles, baseHp for the current attempt) resets
 * on startRun()/retryPhase(). Combat itself is fully automatic — nothing
 * in this class waits on a per-wave or per-target player action; the only
 * player-driven calls are build/upgrade decisions and retryPhase().
 *
 * Content Progression layer (phases/biomes/archetypes/elites) is entirely
 * DATA-DRIVEN from config/phaseConfig.ts + config/bossConfig.ts — this
 * class only asks "what wave is this / what spawns here", never encodes a
 * wave range or a boss identity itself.
 */
export class GameEngine {
  private phase: RunPhase = "PRE_RUN";
  private speed: GameSpeed = GAME_SPEEDS[0];
  private gold = 0;
  private baseHp = RUN_START.baseHp;
  /** RUN_START.baseHp plus every permanent CASTLE_HP_* Roulette win ever landed (this.castleHpBonus) — no longer a fixed constant, see triggerRouletteSpin. */
  private maxBaseHp = RUN_START.baseHp;
  private wave: WaveManagerState = createWaveManagerState();
  private towers: TowerInstance[] = [];
  private enemies: EnemyInstance[] = [];
  private projectiles: ProjectileInstance[] = [];
  private enemiesDefeated = 0;
  private selectedTowerId: string | null = null;
  private bestWave = 0;
  /** This Season's own high-water mark — separate from `bestWave` (the account's all-time record), reset to 0 only at a Season boundary. See SaveData.seasonBestWave's doc comment. */
  private seasonBestWave = 0;

  private bossIntroRemainingMs = 0;
  private bossIntroNameKey: string | null = null;
  private victoryRemainingMs = 0;
  private activeBossId: string | null = null;
  /** This attempt's own simulated clock (accumulates scaledDt, so it scales with game speed) — see update()'s comment. Boss/mini-boss ability timing reads this instead of a real wall-clock. */
  private simClockMs = 0;
  private miniBossSpawnedForWave: number | null = null;
  private eliteSpawnedForWave: number | null = null;
  /** Gold the main boss dropped, kept around through the VICTORY beat so the banner can show it after the boss enemy itself is gone. */
  private lastBossReward: number | null = null;

  /**
   * CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B — explicit Progression
   * Wall). The boss-escape branch below (`boss === null`) intentionally
   * keeps the run going instead of ever freezing (see its own doc comment)
   * — but a KILL and an ESCAPE are very different outcomes for the player
   * to understand, and a long unbroken streak of escapes is a genuinely
   * different situation from one unlucky fight. This counts consecutive
   * escapes with ZERO kill in between; any real kill resets it to 0 (proof
   * the current build/boss matchup isn't actually a wall). Purely in-memory
   * — like `pendingRouletteResults` above, nothing here is a reward that
   * could be "lost" on reload, only a diagnostic banner.
   */
  private consecutiveBossEscapesWithoutKill = 0;
  /** Best fraction of THIS streak's boss HP actually brought down (0..1) — reset alongside the streak counter above. */
  private bestBossDamageFractionInStreak = 0;
  private endgameWallReport: EndgameWallReport | null = null;

  private discoveredEnemyTypes = new Set<EnemyType>();
  private pendingDiscoveries: EnemyType[] = [];

  /** This save's stable local identity — see SaveSystem.SaveData.playerId. */
  private playerId = "";
  private inventory: ItemInstance[] = [];
  private bossesDefeatedTotal = 0;
  private miniBossesDefeatedTotal = 0;
  private localFirstDiscoveries: LocalFirstDiscoveries = {};
  private pendingItemRewards: ItemInstance[] = [];

  // Progression 2.0 — Gem Economy (spec sections 33-40). `gems`/`gemShards`
  // are private exactly like `gold` above: every read/write goes through
  // this class's own methods (getGemBalance/addGems/spendGems/
  // convertGemShards below), which is what satisfies spec section 37's
  // "GemManager... não pode permitir player.gems += 100 direto na UI" —
  // there simply is no path from UI code to these fields except through
  // those methods, the same guarantee `gold` already has.
  private gems = 0;
  private gemShards = 0;
  private inventoryCapacity = DEFAULT_INVENTORY_CAPACITY;
  private overflowInventory: ItemInstance[] = [];

  // HORDENOVA Season/Progression v1.0 — "Season resets progression, not
  // ownership." towerMasteryLevels is now SEASON-scoped (resets to {} at
  // every Season boundary, see AscensionManager.syncSeasonIfNeeded);
  // masteryUnlocked/unlockedSpecializationIds/Tower Skin ownership are the
  // permanent, account-wide, never-reset halves, keyed by TOWER TYPE (every
  // placed tower of a type shares its type's Mastery level/ownership and
  // equipped skin). See SaveData's doc comment for the full split.
  private towerMasteryLevels: Partial<Record<TowerType, number>> = {};
  /** Permanent per-TYPE Mastery ownership (the one-time 400 Gems purchase) — never reset by a Season boundary. */
  private masteryUnlocked: Partial<Record<TowerType, boolean>> = {};
  private ownedTowerSkinIds = new Set<string>();
  private equippedTowerSkinByType: Partial<Record<TowerType, string>> = {};

  /** Permanent per-TYPE record of every Specialization path ever purchased (the one-time 500 Gems unlock) — never reset by a Season boundary, never re-charged for a path already in this list. See config/specializations.ts's SPECIALIZATION_UNLOCK_GEM_COST/SPECIALIZATION_CHANGE_GEM_COST. */
  private unlockedSpecializationIds: Partial<Record<TowerType, SpecializationId[]>> = {};

  // Master Implementation spec sections 46-48, and AUDITORIA E CORREÇÃO
  // GERAL spec sections 1-13 — the every-10-wave Roulette.
  // `castleHpBonus`/`unlockedCastleSkinIds` are the persistent halves (see
  // SaveSystem.ts); `pendingRouletteResults` is a purely in-memory display
  // queue exactly like `pendingItemRewards` above — the reward itself is
  // already granted and persisted by the time an entry lands here, so
  // losing this queue to a reload loses only the banner, never the reward.
  //
  // `pendingRouletteSpinWaves` is the opposite: a PERSISTED queue of wave
  // milestones whose Roulette has NOT been spun/granted yet. Crossing a
  // milestone (in advanceBestWave, or a batch of them inside an Offline
  // Defense return) only ever pushes here — nothing is rolled or granted
  // until spinPendingRoulette() is explicitly called (the player's own
  // ROLETAR click). This MUST be persisted (unlike pendingRouletteResults)
  // because losing it to a reload would mean losing a reward the player
  // never got the chance to claim, not just losing a toast.
  private castleHpBonus = 0;
  private unlockedCastleSkinIds: string[] = [];
  private pendingRouletteResults: RouletteResult[] = [];
  private pendingRouletteSpinWaves: number[] = [];

  /** Master Implementation Pass spec section 7-8 — PROFILE PRESTIGE: the recurring, uncapped, purely-cosmetic Gem sink (config/prestige.ts). */
  private prestigeLevel = 0;

  /** BALANCEAMENTO DEFINITIVO spec section 6/13 — see SaveData.lastFreeRepositionDayIndex's own doc comment. */
  private lastFreeRepositionDayIndex: number | null = null;

  /** Audio spec sections 1/16 — plain data queue, drained once per tick by audio/GameAudioBridge.ts. GameEngine never imports anything from src/audio/. */
  private audioEvents: GameAudioEvent[] = [];
  private waveCompleteAudioFiredForWave: number | null = null;
  private enrageAudioFired = new Set<string>();

  private battleStats: BattleStats = createBattleStats();
  private lastFailureReport: FailureReport | null = null;
  private offlineSummary: OfflineSimulationResult | null = null;

  private readonly listeners = new Set<() => void>();

  /**
   * PRÓXIMA GRANDE FASE spec — "DECISÃO DEFINITIVA SOBRE PROGRESSÃO": there
   * is now exactly one permanent, never-reset save (SAVE_STORAGE_KEY); the
   * separate Ascension/Infinite dual-mode split (a second GameEngine
   * pointed at ASCENSION_STORAGE_KEY, with its own temporary
   * wave/gold/towers reset every season) no longer exists in the real app
   * flow. `storageKey` stays overridable — GameEngineDualMode.test.ts still
   * exercises this constructor's namespace-isolation guarantee directly,
   * a real and still-useful property of the engine — but nothing under
   * src/screens/ constructs a second instance anymore. Season-scoped
   * competitive state (`seasonBestWave`) lives as an ordinary field on THIS
   * SAME permanent save (see SaveData.seasonBestWave), not a second
   * namespace.
   */
  constructor(private readonly storageKey: string = SAVE_STORAGE_KEY) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /**
   * Resumes persistent progression from the save (or starts fresh on a
   * brand-new save). This is the ONLY entry point that loads from
   * SaveSystem — everything after it works off in-memory state, persisted
   * back out via `persist()` at meaningful checkpoints.
   */
  startRun(): void {
    // Idempotent by design: GameScreen calls this from a mount effect, which
    // React's development StrictMode invokes twice — without this guard the
    // second call would re-resume from the (already-persisted) post-offline-
    // sim save with a fresh lastPlayedAt, silently clobbering the OFFLINE_
    // RETURN summary before the player ever saw it.
    if (this.phase !== "PRE_RUN") return;

    const save = loadSave(this.storageKey);
    this.bestWave = save.bestWave;
    this.seasonBestWave = save.seasonBestWave;
    this.gold = save.gold;
    // Permanent Mastery/Skin state must be loaded BEFORE instantiating towers
    // from the (Season-scoped) loadout below — instantiateTowerFromLoadout
    // reads these maps to give each tower its permanent-by-type Mastery
    // level and equipped skin.
    this.towerMasteryLevels = { ...save.towerMasteryLevels };
    this.masteryUnlocked = { ...save.masteryUnlocked };
    this.ownedTowerSkinIds = new Set(save.ownedTowerSkinIds);
    this.equippedTowerSkinByType = { ...save.equippedTowerSkinByType };
    // Deep-copy each per-type array — a shallow spread would leave every
    // type's array as the SAME reference as the loaded save's, so pushing a
    // newly-unlocked id in chooseTowerSpecialization would mutate the save
    // object this engine is supposed to be an independent working copy of.
    this.unlockedSpecializationIds = Object.fromEntries(
      Object.entries(save.unlockedSpecializationIds).map(([type, ids]) => [type, [...(ids ?? [])]]),
    ) as Partial<Record<TowerType, SpecializationId[]>>;
    this.towers = save.towerLoadout.map((entry) => this.instantiateTowerFromLoadout(entry));
    this.discoveredEnemyTypes = new Set(save.discoveredEnemyTypes);
    this.playerId = save.playerId;
    this.inventory = save.inventory;
    this.bossesDefeatedTotal = save.bossesDefeatedTotal;
    this.miniBossesDefeatedTotal = save.miniBossesDefeatedTotal;
    this.localFirstDiscoveries = save.localFirstDiscoveries;
    this.gems = save.gems;
    this.gemShards = save.gemShards;
    this.inventoryCapacity = save.inventoryCapacity;
    this.overflowInventory = save.overflowInventory;
    this.castleHpBonus = save.castleHpBonus;
    this.unlockedCastleSkinIds = save.unlockedCastleSkinIds;
    this.prestigeLevel = save.prestigeLevel;
    this.pendingRouletteSpinWaves = [...save.pendingRouletteSpinWaves];
    this.lastFreeRepositionDayIndex = save.lastFreeRepositionDayIndex;
    this.maxBaseHp = RUN_START.baseHp + this.castleHpBonus;
    this.wave = createWaveManagerState();
    this.resetAttemptState();
    this.wave.currentWave = save.currentWave;

    const elapsed = save.lastPlayedAt !== null ? Date.now() - save.lastPlayedAt : 0;
    if (save.currentWave > 0 && save.towerLoadout.length > 0 && elapsed >= OFFLINE_RETURN_MIN_ELAPSED_MS) {
      const capacityMs = computeOfflineCapacityMs(save.lastPlayedAt as number, Date.now());
      const result = simulateOfflineDefense({
        startingWave: save.currentWave,
        towerLoadout: save.towerLoadout,
        capacityMs,
      });
      if (result.phasesCleared > 0) {
        // AUDITORIA E CORREÇÃO GERAL spec section 12 — Offline Defense can
        // jump `currentWave`/`bestWave` across several ROULETTE_MILESTONE_
        // INTERVAL boundaries in one shot (this never happens in live play,
        // where advanceBestWave is called once per single wave crossed).
        // Every milestone crossed while offline is queued as pending here —
        // NEVER auto-resolved — exactly like a milestone crossed live.
        const oldBestWave = this.bestWave;
        this.wave.currentWave = result.endingWave;
        this.gold += result.resourcesEarned;
        this.bestWave = Math.max(this.bestWave, result.endingWave);
        for (let w = oldBestWave + 1; w <= this.bestWave; w++) {
          if (w % ROULETTE_MILESTONE_INTERVAL === 0) this.pendingRouletteSpinWaves.push(w);
        }
        this.offlineSummary = result;
        this.phase = "OFFLINE_RETURN";
        this.persist();
        this.notify();
        return;
      }
    }

    this.beginCurrentOrNextWave();
    this.persist();
    this.notify();
  }

  /** Dismisses the Welcome Back summary and resumes automatic combat. */
  dismissOfflineSummary(): void {
    if (this.phase !== "OFFLINE_RETURN") return;
    this.offlineSummary = null;
    this.beginCurrentOrNextWave();
    this.persist();
    this.notify();
  }

  getOfflineSummary(): OfflineSimulationResult | null {
    return this.offlineSummary;
  }

  /**
   * Player intervention after PROGRESSION_STOPPED: retries the SAME phase
   * that failed (not a reset to Wave 1) — Active Idle progression only
   * ever moves forward; a failed attempt is retried after the player
   * upgrades towers or changes their build, per spec section 1.
   */
  retryPhase(): void {
    if (this.phase !== "PROGRESSION_STOPPED") return;
    this.resetAttemptState();
    this.beginCurrentOrNextWave();
    this.persist();
    this.notify();
  }

  private resetAttemptState(): void {
    this.enemies = [];
    this.projectiles = [];
    this.baseHp = this.maxBaseHp;
    this.enemiesDefeated = 0;
    this.selectedTowerId = null;
    this.battleStats = createBattleStats();
    this.lastFailureReport = null;
    this.miniBossSpawnedForWave = null;
    this.eliteSpawnedForWave = null;
    this.activeBossId = null;
    this.bossIntroNameKey = null;
    this.lastBossReward = null;
    this.simClockMs = 0;
    this.waveCompleteAudioFiredForWave = null;
    this.enrageAudioFired = new Set();
    // Master Implementation Pass spec section 12-13 — Tower Survival HP/
    // Shield are transient battle state, restored to full on every fresh
    // attempt exactly like Castle HP (baseHp) above — never a lingering
    // "damaged from last attempt" state carried into a retry.
    for (const tower of this.towers) resetTowerSurvival(tower);
  }

  /** Starts Wave 1 (fresh save) or resumes/retries the current wave — intercepting into BOSS_INTRO if that wave is a main-boss milestone. */
  private beginCurrentOrNextWave(): void {
    const targetWave = this.wave.currentWave === 0 ? 1 : this.wave.currentWave;
    if (isBossMilestone(targetWave)) {
      this.enterBossIntro(targetWave);
      return;
    }
    if (this.wave.currentWave === 0) activateNextWave(this.wave);
    else retryCurrentWave(this.wave);
    this.phase = "RUNNING";
    this.emitAudio({ type: "wave_start" });
  }

  private enterBossIntro(waveNumber: number): void {
    this.wave.currentWave = waveNumber;
    this.wave.phase = "IDLE";
    this.wave.spawnQueue = [];
    this.phase = "BOSS_INTRO";
    this.bossIntroRemainingMs = BOSS_INTRO_DURATION_MS;
    this.bossIntroNameKey = getMainBossForWave(waveNumber).i18nKey;
    this.emitAudio({ type: "boss_intro" });
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
    this.notify();
  }

  getAvailableSlotIds(): string[] {
    const occupied = new Set(this.towers.map((t) => t.slotId));
    return TOWER_SLOTS.filter((slot) => !occupied.has(slot.id)).map((slot) => slot.id);
  }

  /** Towers as the center of progression (spec section 3): allowed during active combat AND while PROGRESSION_STOPPED, since that's exactly when the player is expected to change their build. */
  private canModifyLoadout(): boolean {
    return this.phase === "RUNNING" || this.phase === "WAVE_TRANSITION" || this.phase === "PROGRESSION_STOPPED";
  }

  /**
   * Mastery level and equipped skin are sourced from the PERMANENT,
   * per-type maps (this.towerMasteryLevels/this.equippedTowerSkinByType),
   * never from the loadout entry itself — the entry's own equivalent
   * fields are legacy/unused now that both became account-wide-by-type
   * state instead of per-slot state (see SEASON-RESET-CORRECTION doc
   * comment on those fields above).
   */
  private instantiateTowerFromLoadout(entry: TowerLoadoutEntry): TowerInstance {
    const slot = TOWER_SLOTS.find((s) => s.id === entry.slotId);
    return createTowerInstance(
      entry.slotId,
      entry.type,
      slot ? slot.position : { x: 0, y: 0 },
      entry.level,
      entry.specializationId,
      entry.specializationLevel,
      this.equippedTowerSkinByType[entry.type] ?? null,
      this.towerMasteryLevels[entry.type] ?? 0,
      this.masteryUnlocked[entry.type] === true,
      entry.equippedItemInstanceIds,
    );
  }

  placeTower(slotId: string, type: TowerType): boolean {
    if (!this.canModifyLoadout()) return false;
    if (this.towers.some((t) => t.slotId === slotId)) return false;

    const slot = TOWER_SLOTS.find((s) => s.id === slotId);
    if (!slot) return false;

    const cost = TOWER_DEFINITIONS[type].buildCost;
    if (this.gold < cost) return false;

    this.gold -= cost;
    this.towers.push(
      createTowerInstance(
        slotId,
        type,
        slot.position,
        1,
        null,
        0,
        this.equippedTowerSkinByType[type] ?? null,
        this.towerMasteryLevels[type] ?? 0,
        this.masteryUnlocked[type] === true,
      ),
    );
    this.persist();
    this.notify();
    return true;
  }

  // ---------------------------------------------------------------------
  // BALANCEAMENTO DEFINITIVO spec section 6/13 — Tower Repositioning. See
  // config/repositioning.ts's own doc comment for the "1 change = 1 pick-
  // tower-then-pick-destination-slot action" definition (a swap with an
  // occupied slot still counts as one), and engine/DailyClock.ts for why
  // the daily boundary is a day-INDEX comparison rather than a stored flag.
  // ---------------------------------------------------------------------

  /** Whether the account's one free reposition for the CURRENT day is still unused. */
  isFreeRepositionAvailable(): boolean {
    return this.lastFreeRepositionDayIndex !== getCurrentDayIndex();
  }

  /** 0 when the free daily reposition is still available, REPOSITION_GEM_COST otherwise. UI must show this and get confirmation before ever calling repositionTower with a non-zero cost. */
  getRepositionCost(): number {
    return this.isFreeRepositionAvailable() ? 0 : REPOSITION_GEM_COST;
  }

  /**
   * Moves the tower currently at `fromSlotId` to `toSlotId` — one of the
   * map's fixed TOWER_SLOTS positions, never an arbitrary coordinate (the
   * structural min-spacing rule from FIX-5 is preserved unchanged: every
   * legal destination is already a pre-vetted slot). If `toSlotId` already
   * holds a different tower, the two SWAP positions atomically as part of
   * this SAME call — still exactly one reposition for cost/allowance
   * purposes. Touches ONLY slotId/position on the affected tower(s): level,
   * Mastery, Specialization, ownership, HP and every other field are
   * completely untouched, on both towers.
   *
   * Spends REPOSITION_GEM_COST Gems when the day's free use is already
   * spent — the caller (UI) is responsible for showing a confirmation
   * before calling this whenever getRepositionCost() > 0, exactly like
   * every other Gems purchase in this engine (switchTowerSpecialization,
   * purchaseTowerSkin, ...): this method performs the action unconditionally
   * once called, it never itself prompts.
   */
  repositionTower(fromSlotId: string, toSlotId: string): boolean {
    if (!this.canModifyLoadout()) return false;
    if (fromSlotId === toSlotId) return false;

    const fromTower = this.towers.find((t) => t.slotId === fromSlotId);
    const toSlot = TOWER_SLOTS.find((s) => s.id === toSlotId);
    if (!fromTower || !toSlot) return false;

    const isFree = this.isFreeRepositionAvailable();
    if (!isFree && !this.canAffordGems(REPOSITION_GEM_COST)) return false;

    const toTower = this.towers.find((t) => t.slotId === toSlotId);
    const fromSlot = TOWER_SLOTS.find((s) => s.id === fromSlotId)!;

    fromTower.slotId = toSlotId;
    fromTower.position = toSlot.position;
    if (toTower) {
      toTower.slotId = fromSlotId;
      toTower.position = fromSlot.position;
    }

    if (isFree) {
      this.lastFreeRepositionDayIndex = getCurrentDayIndex();
    } else {
      this.spendGems(REPOSITION_GEM_COST, "tower_reposition");
    }

    this.persist();
    this.notify();
    return true;
  }

  selectTower(towerId: string | null): void {
    this.selectedTowerId = towerId;
    this.notify();
  }

  upgradeSelectedTower(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;

    const cost = getTowerUpgradeCost(tower);
    if (cost === null || this.gold < cost) return false;

    this.gold -= cost;
    upgradeTowerEntity(tower);
    const unlock = getMilestoneUnlockForLevel(tower.type, tower.level);
    this.emitAudio(unlock ? { type: "level_unlock" } : { type: "tower_upgrade" });
    this.persist();
    this.notify();
    return true;
  }

  /**
   * HORDENOVA Season/Progression v1.0 — TOWER MASTERY: the uncapped sink
   * past MAX_TOWER_LEVEL. Deliberately available at ANY tower level (not
   * gated behind a specific level) — a player free to invest earlier if
   * they'd rather spread spending out, exactly like Specialization already
   * works once its own level gate is passed.
   *
   * Ownership (`this.masteryUnlocked`, permanent per TYPE) and progression
   * (`this.towerMasteryLevels`, SEASON-scoped per TYPE) are fully separate:
   * a one-time MASTERY_UNLOCK_GEM_COST Gems purchase (handled by
   * unlockSelectedTowerMastery below) grants ownership FOREVER — it does
   * NOT touch the level at all, including on the very first purchase. Every
   * level, in every Season including the first, is bought with Gold via
   * upgradeSelectedTowerMastery, which requires ownership but reads from
   * whatever the CURRENT (Season-scoped) level happens to be — 0 at the
   * start of every Season, owned or not. It also grants real, small,
   * bounded-weighted combat effects — see config/towerMastery.ts's
   * getMasteryBonuses doc comment for why this is still not "Gems buy
   * power": Gems only ever buy the one-time access, forever, never a level.
   */
  canUnlockSelectedTowerMastery(): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    return !!tower && this.masteryUnlocked[tower.type] !== true;
  }

  /** Pays the one-time, permanent MASTERY_UNLOCK_GEM_COST Gems to grant the selected tower's TYPE Mastery ownership forever. Never re-charged for this type again, in any future Season. Does NOT touch the current (Season-scoped) Mastery level. */
  unlockSelectedTowerMastery(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || this.masteryUnlocked[tower.type] === true) return false;
    if (!this.canAffordGems(MASTERY_UNLOCK_GEM_COST)) return false;

    this.spendGems(MASTERY_UNLOCK_GEM_COST, `tower_mastery:${tower.type}`);
    this.masteryUnlocked[tower.type] = true;
    for (const other of this.towers) {
      if (other.type === tower.type) other.masteryUnlocked = true;
    }
    this.emitAudio({ type: "level_unlock" });
    this.persist();
    this.notify();
    return true;
  }

  /** GOLD-funded, uncapped upgrade of the selected tower's TYPE mastery level (0 -> 1 -> 2 -> ... forever, resetting to 0 every Season) — requires Mastery ownership (see unlockSelectedTowerMastery), never re-checks or re-charges it. */
  upgradeSelectedTowerMastery(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canUpgradeMastery(tower)) return false;

    const cost = getMasteryUpgradeCostFor(tower);
    if (this.gold < cost) return false;

    this.gold -= cost;
    upgradeMasteryEntity(tower);
    this.towerMasteryLevels[tower.type] = tower.masteryLevel;
    for (const other of this.towers) {
      if (other.type === tower.type && other.id !== tower.id) other.masteryLevel = tower.masteryLevel;
    }
    this.emitAudio({ type: "tower_upgrade" });
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // Progression 2.0 — Specialization / Upgrade Slot (spec section 5/6).
  // The fix for "reaches phase 46 in 20 minutes": a genuine, player-chosen
  // gold sink that keeps mattering well past MAX_TOWER_LEVEL. See
  // config/specializations.ts for the full design rationale.
  //
  // HORDENOVA Season/Progression v1.0 — ownership (`this.
  // unlockedSpecializationIds`, permanent per TYPE) and progression
  // (`specializationId`/`specializationLevel`, on the tower instance,
  // SEASON-scoped) are fully separate, exactly mirroring Mastery above.
  // -------------------------------------------------------------------

  canChooseSpecializationForSelectedTower(): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    return !!tower && canChooseSpecialization(tower);
  }

  /** Every SpecializationId this account has ever purchased for `type` — permanent, never reset. Used by the UI to show an already-owned path as a free re-activation instead of another SPECIALIZATION_UNLOCK_GEM_COST charge. */
  getUnlockedSpecializationIdsForType(type: TowerType): readonly SpecializationId[] {
    return this.unlockedSpecializationIds[type] ?? [];
  }

  isSpecializationUnlocked(type: TowerType, id: SpecializationId): boolean {
    return this.getUnlockedSpecializationIdsForType(type).includes(id);
  }

  /**
   * The CHOICE of a specialization path (null -> an active pick, for THIS
   * Season) is free the moment the account already owns that exact path
   * (see isSpecializationUnlocked) — re-activating something already paid
   * for never charges Gems again. Choosing a path this account has NEVER
   * owned costs SPECIALIZATION_UNLOCK_GEM_COST Gems, once, and grants
   * PERMANENT ownership of it from that point on. Every level after the
   * choice (via upgradeSelectedTowerSpecialization below) always costs Gold.
   */
  chooseTowerSpecialization(specializationId: SpecializationId): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canChooseSpecialization(tower)) return false;

    const alreadyOwned = this.isSpecializationUnlocked(tower.type, specializationId);
    if (!alreadyOwned && !this.canAffordGems(SPECIALIZATION_UNLOCK_GEM_COST)) return false;

    const applied = chooseSpecializationEntity(tower, specializationId);
    if (!applied) return false;

    if (!alreadyOwned) {
      this.spendGems(SPECIALIZATION_UNLOCK_GEM_COST, `specialization:${specializationId}`);
      const owned = this.unlockedSpecializationIds[tower.type] ?? [];
      this.unlockedSpecializationIds[tower.type] = [...owned, specializationId];
    }
    this.emitAudio({ type: "level_unlock" });
    this.persist();
    this.notify();
    return true;
  }

  /**
   * "Trocar Especialização" — a flat, unconditional SPECIALIZATION_CHANGE_
   * GEM_COST Gems purchase that switches the selected tower's ACTIVE
   * specialization to a DIFFERENT path this account already owns. Replaces
   * the old Specialization Respec Token system entirely: there is no free
   * or earned respec anymore, only this flat Gems purchase, and it only
   * ever moves between paths already paid for once — picking a brand-new
   * path still goes through chooseTowerSpecialization (500 Gems) instead.
   */
  canSwitchSelectedTowerSpecialization(newId: SpecializationId): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canSwitchSpecialization(tower) || newId === tower.specializationId) return false;
    return this.isSpecializationUnlocked(tower.type, newId);
  }

  switchTowerSpecialization(newId: SpecializationId): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !this.canSwitchSelectedTowerSpecialization(newId)) return false;
    if (!this.canAffordGems(SPECIALIZATION_CHANGE_GEM_COST)) return false;

    this.spendGems(SPECIALIZATION_CHANGE_GEM_COST, `specialization_change:${newId}`);
    switchSpecializationEntity(tower, newId);
    this.emitAudio({ type: "tower_upgrade" });
    this.persist();
    this.notify();
    return true;
  }

  upgradeSelectedTowerSpecialization(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canUpgradeSpecialization(tower)) return false;

    const cost = getSpecializationUpgradeCostFor(tower);
    if (cost === null || this.gold < cost) return false;

    this.gold -= cost;
    upgradeSpecializationEntity(tower);
    this.emitAudio({ type: "tower_upgrade" });
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // BALANCEAMENTO DEFINITIVO spec section 7 — Tower Equipment Slots.
  // Architecture only: equipping never grants combat power in this pass
  // (see config/towerItemSlots.ts's own doc comment). GameEngine is the
  // only place that can see EVERY tower's equipped items at once, so the
  // "not already equipped on a DIFFERENT tower" duplication guard lives
  // here rather than in entities/Tower.ts.
  // -------------------------------------------------------------------

  /** The selected tower's equipment slots as real ItemInstance objects (null for an empty slot), for UI rendering. */
  getSelectedTowerItemSlots(): (ItemInstance | null)[] {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return Array(TOWER_ITEM_SLOT_COUNT).fill(null);
    return tower.equippedItemInstanceIds.map((id) => (id ? findItem(this.inventory, id) : null));
  }

  /** Whether `instanceId` (an item this account owns) can be equipped into the selected tower's `slotIndex` right now. */
  canEquipItemOnSelectedTower(instanceId: string, slotIndex: number): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    const item = findItem(this.inventory, instanceId);
    if (!item) return false;
    const equippedElsewhere = this.towers.some(
      (t) => t.id !== tower.id && t.equippedItemInstanceIds.includes(instanceId),
    );
    return canEquipItem(tower, slotIndex, item, equippedElsewhere);
  }

  /** Equips `instanceId` into the selected tower's `slotIndex`. Auto-unequips it from wherever else it currently sits on THIS same tower (an item can occupy only one slot at a time), and refuses if it's already equipped on a different tower or mid-trade. */
  equipItemOnSelectedTower(instanceId: string, slotIndex: number): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    if (!this.canEquipItemOnSelectedTower(instanceId, slotIndex)) return false;

    const currentSlot = tower.equippedItemInstanceIds.indexOf(instanceId);
    if (currentSlot !== -1) unequipItemEntity(tower, currentSlot);
    equipItemEntity(tower, slotIndex, instanceId);
    this.persist();
    this.notify();
    return true;
  }

  /** Empties the selected tower's `slotIndex` — a no-op if it was already empty. */
  unequipItemFromSelectedTower(slotIndex: number): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    unequipItemEntity(tower, slotIndex);
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // Progression 2.0 — Tower Skins (spec section 10/11). Purely cosmetic:
  // never touches gold, level, specialization, or combat.
  //
  // CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE): a skin must be PURCHASED
  // with Gems (purchaseTowerSkin below) before it can ever be equipped —
  // reaching its unlockLevel only makes it purchasable, it no longer grants
  // it for free. Ownership (this.ownedTowerSkinIds) and the equipped choice
  // (this.equippedTowerSkinByType, keyed by TYPE) are both PERMANENT and
  // survive every Season boundary untouched, unlike tower level itself.
  // -------------------------------------------------------------------

  /** Gems cost to buy `skinId`, or null if the id isn't a real skin — read by UI before calling purchaseTowerSkin. */
  getTowerSkinGemCost(skinId: string): number | null {
    return getTowerSkinDefinition(skinId)?.gemCost ?? null;
  }

  isTowerSkinOwned(skinId: string): boolean {
    return this.ownedTowerSkinIds.has(skinId);
  }

  canPurchaseSkinForSelectedTower(skinId: string): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    return !!tower && canPurchaseSkinEntity(tower, skinId, this.ownedTowerSkinIds);
  }

  /** Debits Gems atomically (spendGems already guards insufficient balance) and grants PERMANENT ownership — never revoked by a future Season's tower-level reset. */
  purchaseTowerSkin(skinId: string): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canPurchaseSkinEntity(tower, skinId, this.ownedTowerSkinIds)) return false;

    const def = getTowerSkinDefinition(skinId);
    if (!def) return false;
    if (!this.spendGems(def.gemCost, `tower_skin:${skinId}`)) return false;

    this.ownedTowerSkinIds.add(skinId);
    this.persist();
    this.notify();
    return true;
  }

  equipSkinOnSelectedTower(skinId: string | null): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    const applied = equipSkinEntity(tower, skinId, this.ownedTowerSkinIds);
    if (applied) {
      if (skinId === null) delete this.equippedTowerSkinByType[tower.type];
      else this.equippedTowerSkinByType[tower.type] = skinId;
      for (const other of this.towers) {
        if (other.type === tower.type && other.id !== tower.id) other.equippedSkinId = skinId;
      }
      this.persist();
      this.notify();
    }
    return applied;
  }

  // -------------------------------------------------------------------
  // Progression 2.0 — Gem Economy (spec section 33-40). Every mutation
  // routes through here and appends a ledger event (engine/EconomyLedger.ts)
  // — see the field-level comment on `gems`/`gemShards` above for why this
  // already satisfies the "no direct UI mutation" requirement.
  // -------------------------------------------------------------------

  getGemBalance(): number {
    return this.gems;
  }

  getGemShardBalance(): number {
    return this.gemShards;
  }

  private addGems(amount: number, source: string): void {
    if (amount <= 0) return;
    this.gems += amount;
    appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: this.playerId, source, amount });
  }

  private addGemShards(amount: number, source: string): void {
    if (amount <= 0) return;
    this.gemShards += amount;
    appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: this.playerId, source, amount });
  }

  canAffordGems(amount: number): boolean {
    return this.gems >= amount;
  }

  /**
   * The only Gems ever spend on is Specialization unlock (chooseTowerSpecialization
   * above), Convenience, and Cosmetics — never damage/HP/level/victory/phase
   * directly (spec section 23's forbidden list). Callers are responsible for
   * applying whatever the purchase unlocks; this method only owns the
   * balance mutation + ledger record.
   */
  spendGems(amount: number, reason: string): boolean {
    if (amount <= 0 || this.gems < amount) return false;
    this.gems -= amount;
    appendLedgerEvent({ eventType: "GEMS_SPENT", fromOwner: this.playerId, toOwner: null, source: reason, amount });
    this.persist();
    this.notify();
    return true;
  }

  /** Gem Shards -> Gems conversion (spec section 34: "se a conversão não fizer sentido, deixe a arquitetura preparada sem inventar uma economia arbitrária"). A conservative fixed rate, player-triggered — never automatic. */
  static readonly GEM_SHARD_TO_GEM_RATE = 10;

  /**
   * AUDITORIA E CORREÇÃO GERAL spec section 15 — "a mesma função/regra deve
   * ser usada por: UI, clique, validação. Não criar regras diferentes." This
   * static, pure, side-effect-free predicate is the ONE place that decides
   * eligibility — both convertGemShards() below and the InventoryPanel UI's
   * button-disabled state call this exact function, so they can never drift
   * apart (which was the real root cause of the reported bug: the UI used
   * to show the convert button for ANY gemShards > 0 with no disabled state
   * at all, so a balance below GEM_SHARD_TO_GEM_RATE looked clickable but
   * silently did nothing when clicked — indistinguishable from "the button
   * doesn't work" even when the underlying engine logic was already correct).
   */
  static canConvertGemShards(gemShards: number): boolean {
    return gemShards >= GameEngine.GEM_SHARD_TO_GEM_RATE;
  }

  convertGemShards(): boolean {
    if (!GameEngine.canConvertGemShards(this.gemShards)) return false;
    const rate = GameEngine.GEM_SHARD_TO_GEM_RATE;
    const shardsToConvert = Math.floor(this.gemShards / rate) * rate;
    const gemsGained = shardsToConvert / rate;
    this.gemShards -= shardsToConvert;
    this.addGems(gemsGained, "gem_shard_conversion");
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // HORDENOVA Season/Progression v1.0 — PROFILE PRESTIGE. Permanent,
  // account-wide, uncapped Gem sink, gated behind PRESTIGE_MIN_BEST_WAVE.
  // Grants small, permanently-bounded Gold/Gem Shard bonuses (see
  // config/prestige.ts's getPrestigeBonuses) — never a combat-power lever,
  // and never touches damage/HP/attack speed.
  // -------------------------------------------------------------------

  getPrestigeLevel(): number {
    return this.prestigeLevel;
  }

  /** Whether this account's all-time bestWave has ever reached PRESTIGE_MIN_BEST_WAVE — a permanent, monotonic gate (see config/prestige.ts). */
  canUpgradePrestige(): boolean {
    return canUnlockPrestige(this.bestWave);
  }

  /** Current Gold/Gem Shard income multipliers from Prestige — see config/prestige.ts's getPrestigeBonuses doc comment for why these are permanently bounded rather than another infinite economic track. */
  getCurrentPrestigeBonuses(): PrestigeBonuses {
    return getPrestigeBonuses(this.prestigeLevel);
  }

  upgradePrestige(): boolean {
    if (!canUnlockPrestige(this.bestWave)) return false;
    const cost = getPrestigeUpgradeCost(this.prestigeLevel);
    if (!this.spendGems(cost, "profile_prestige")) return false;
    this.prestigeLevel += 1;
    this.persist();
    this.notify();
    return true;
  }

  // -------------------------------------------------------------------
  // Progression 2.0 — Inventory Capacity + Overflow (spec section 36/39).
  // -------------------------------------------------------------------

  getInventoryCapacity(): number {
    return this.inventoryCapacity;
  }

  getOverflowInventory(): readonly ItemInstance[] {
    return this.overflowInventory;
  }

  /** Moves one item from the overflow waiting area into the usable inventory, if there's room. Never deletes anything either way. */
  claimOverflowItem(instanceId: string): boolean {
    const before = this.inventory.length;
    const result = claimFromOverflow(this.inventory, this.overflowInventory, instanceId, this.inventoryCapacity);
    this.inventory = result.inventory;
    this.overflowInventory = result.overflow;
    const claimed = this.inventory.length > before;
    if (claimed) {
      this.persist();
      this.notify();
    }
    return claimed;
  }

  update(dtMs: number): void {
    if (this.phase === "PRE_RUN" || this.phase === "OFFLINE_RETURN" || this.phase === "PROGRESSION_STOPPED") return;

    const scaledDt = dtMs * this.speed;
    // Boss/mini-boss ability cadence (Shield windows, Summon/Disable
    // intervals, Enrage's own re-arm) must scale with game speed exactly
    // like everything else in this tick — movement, tower cooldowns,
    // status-effect durations. A real wall-clock reference (performance.now())
    // would NOT scale with `speed`, silently making bosses relatively less
    // dangerous at 2x/4x (found while writing a test for the mini-boss
    // ability-ticking fix below: at zero real elapsed time between ticks,
    // no ability ever fired). This accumulator is this attempt's own
    // simulated clock instead — reset in resetAttemptState().
    this.simClockMs += scaledDt;
    const nowMs = this.simClockMs;

    if (this.phase === "BOSS_INTRO") {
      this.bossIntroRemainingMs -= scaledDt;
      if (this.bossIntroRemainingMs <= 0) {
        const boss = createBossInstance(getMainBossForWave(this.wave.currentWave), this.wave.currentWave, nowMs);
        this.activeBossId = boss.id;
        this.enemies.push(boss);
        this.phase = "BOSS_BATTLE";
      }
      this.notify();
      return;
    }

    if (this.phase === "VICTORY") {
      this.victoryRemainingMs -= scaledDt;
      if (this.victoryRemainingMs <= 0) {
        this.activeBossId = null;
        activateNextWave(this.wave);
        this.phase = "RUNNING";
        this.emitAudio({ type: "wave_start" });
        this.persist();
      }
      this.notify();
      return;
    }

    if (this.phase !== "BOSS_BATTLE") {
      // Boss-wave interception: about to auto-transition into a main-boss
      // milestone wave. Skip WaveManager entirely for this tick and hand
      // off to the boss ceremony instead — the next tick after VICTORY
      // resumes normal WaveManager ticking via activateNextWave() above.
      if (
        this.wave.phase === "TRANSITIONING" &&
        this.wave.transitionTimerMs <= scaledDt &&
        isBossMilestone(this.wave.currentWave + 1)
      ) {
        this.enterBossIntro(this.wave.currentWave + 1);
        this.persist();
        this.notify();
        return;
      }

      const { enemyTypeToSpawn } = tickWaveManager(this.wave, scaledDt, this.enemies.length);
      if (enemyTypeToSpawn) {
        this.enemies.push(createEnemyInstance(enemyTypeToSpawn, this.wave.currentWave));
        this.maybeDiscover(enemyTypeToSpawn);
      }
      this.maybeSpawnMiniBoss(nowMs);
      this.maybeSpawnElite();
    }

    tickEnemyDisableAbilities(this.enemies, this.towers, nowMs);

    // Tick every boss-tagged enemy's abilities — the main boss during
    // BOSS_BATTLE, AND any mini-boss currently walking through a regular
    // wave. Previously only the tracked main boss was ever ticked here, so
    // a spawned mini-boss's ability (Shield/Summon/Disable/...) never
    // actually fired after spawn — found while wiring up the new mini-boss
    // roster. Fixed by ticking uniformly instead of special-casing the
    // active boss.
    const bossSummons: EnemyInstance[] = [];
    for (const enemy of this.enemies) {
      if (enemy.boss) bossSummons.push(...tickBossAbilities(enemy, nowMs, this.wave.currentWave, this.towers));
      // Enrage SFX fires exactly once per boss instance (spec section 9) —
      // `enraged` never resets once true, so a Set of "already announced"
      // ids is all that's needed, mirroring eliteSpawnedForWave's pattern.
      if (enemy.boss?.enraged && !this.enrageAudioFired.has(enemy.id)) {
        this.enrageAudioFired.add(enemy.id);
        this.emitAudio({ type: "boss_enrage" });
      }
      // Master Implementation Pass spec section 13 — Boss Siege Attack.
      // Fully independent of tickBossAbilities' own cadence above.
      if (enemy.boss) {
        const siegeHit = tickBossSiege(enemy, nowMs, scaledDt, this.towers);
        if (siegeHit) {
          const target = this.towers.find((t) => t.id === siegeHit.targetTowerId);
          if (target) {
            applySiegeDamage(target, siegeHit.rawDamage, SIEGE_DISABLE_ON_DEPLETION_MS);
            this.emitAudio({ type: "tower_siege_hit" });
          }
        }
      }
    }
    this.enemies.push(...bossSummons);

    const reachedBaseIds = new Set<string>();
    for (const enemy of this.enemies) {
      const { reachedEnd } = advanceEnemy(enemy, scaledDt);
      if (reachedEnd) reachedBaseIds.add(enemy.id);
    }

    const { projectiles: newProjectiles, damageEvents } = tickCombat(this.towers, this.enemies, scaledDt, this.wave.currentWave);
    this.projectiles.push(...newProjectiles);
    recordDamageEvents(this.battleStats, damageEvents);

    // Real-event audio derivation (Audio spec sections 2/3) — read directly
    // off what CombatSystem actually decided this tick, never re-simulated
    // or fabricated. `this.enemies` still holds every enemy hit this tick
    // (the kill loop that removes the dead hasn't run yet), so tier lookup
    // here sees the true pre-kill roster.
    for (const projectile of newProjectiles) {
      this.emitAudio({ type: "tower_attack", towerType: projectile.towerType });
      if (projectile.towerType === "STORMCALLER" && projectile.chainTargets.length > 0) {
        this.emitAudio({ type: "stormcaller_chain" });
      }
    }
    for (const damageEvent of damageEvents) {
      const target = this.enemies.find((e) => e.id === damageEvent.enemyId);
      if (target) {
        this.emitAudio({ type: "enemy_hit", towerType: damageEvent.towerType, tier: this.classifyEnemyTier(target) });
      }
      if (damageEvent.isFreeze) this.emitAudio({ type: "frostborn_freeze" });
    }

    for (const projectile of this.projectiles) tickProjectile(projectile, scaledDt);
    this.projectiles = this.projectiles.filter((p) => !isProjectileExpired(p));

    const survivors: EnemyInstance[] = [];
    let bossDefeatedThisTick = false;
    for (const enemy of this.enemies) {
      if (reachedBaseIds.has(enemy.id)) {
        // BALANCEAMENTO DEFINITIVO spec section 5 — category-based Castle
        // Damage (config/castleDamage.ts), computed fresh at the exact
        // moment of crossing from the CURRENT wave and CURRENT max Castle
        // HP (never a flat per-archetype constant, never cached on the
        // enemy, never applied more than this one time per enemy).
        const category: CastleDamageCategory = enemy.boss?.isMainBoss ? "BOSS" : enemy.boss ? "MINI_BOSS" : "NORMAL";
        const castleDamage = computeCastleDamage(category, this.wave.currentWave, this.maxBaseHp);
        this.baseHp = Math.max(0, this.baseHp - castleDamage);
        recordBaseHit(this.battleStats, enemy, castleDamage);
        continue; // removed, no gold — it breached the base
      }
      if (isEnemyDead(enemy)) {
        // HORDENOVA Season/Progression v1.0 — Prestige's small, permanently
        // bounded Gold bonus (see config/prestige.ts's getPrestigeBonuses)
        // applies here, at the one real per-kill Gold grant. Never touches
        // enemy.goldReward itself (the frozen wave-scaling formula), only
        // the amount the player actually receives.
        this.gold += Math.round(enemy.goldReward * getPrestigeBonuses(this.prestigeLevel).goldMultiplier);
        this.enemiesDefeated += 1;
        recordKill(this.battleStats, enemy);
        const tier = this.classifyEnemyTier(enemy);
        const flavor = enemy.burn ? "fire" : enemy.slow?.percent === 1 ? "ice" : undefined;
        this.emitAudio({ type: "enemy_death", tier, flavor });
        if (tier === "boss") this.emitAudio({ type: "boss_death" });
        if (enemy.id === this.activeBossId) {
          bossDefeatedThisTick = true;
          this.lastBossReward = enemy.goldReward;
        }
        if (enemy.boss) this.grantBossDrop(enemy.boss);
        continue; // removed, killed by towers/burn
      }
      survivors.push(enemy);
    }
    this.enemies = survivors;
    // One event for the whole tick, however many enemies breached at once
    // (spec section 7: "se vários inimigos chegarem juntos, controlar o
    // número de sons") — AudioManager's own cooldown throttles this
    // further across consecutive ticks.
    if (reachedBaseIds.size > 0) this.emitAudio({ type: "castle_damage", count: reachedBaseIds.size });

    if (this.phase === "BOSS_BATTLE") {
      const boss = this.enemies.find((e) => e.id === this.activeBossId) ?? null;
      recordBossSnapshot(this.battleStats, boss);
      if (bossDefeatedThisTick) {
        this.phase = "VICTORY";
        this.victoryRemainingMs = BOSS_VICTORY_DURATION_MS;
        this.emitAudio({ type: "victory" });
        this.advanceBestWave(this.wave.currentWave);
        // CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — a real kill is
        // proof this exact build/boss matchup is NOT a wall, whatever the
        // streak was before it.
        this.consecutiveBossEscapesWithoutKill = 0;
        this.bestBossDamageFractionInStreak = 0;
        this.persist();
      } else if (boss === null) {
        // The boss reached the base and was removed via the normal leak
        // path (reachedBaseIds) instead of dying — it "escaped" rather
        // than being defeated. Found via balance simulation: without this
        // branch the engine has no way to leave BOSS_BATTLE once its one
        // tracked enemy is gone, permanently soft-locking the run. No
        // reward (it wasn't killed), but Active Idle must never stall —
        // the base already paid for it in HP, so progression continues.
        // AUDITORIA E CORREÇÃO GERAL spec sections 1, 11 — advanceBestWave
        // MUST be called for the boss wave itself (this.wave.currentWave,
        // BEFORE activateNextWave bumps it) or a milestone landing exactly
        // on a boss wave (e.g. wave 30) is silently skipped entirely: the
        // very next advanceBestWave call would already be for wave 31,
        // which is never a multiple of ROULETTE_MILESTONE_INTERVAL. This
        // bug pre-dates the pending-Roulette rework but was invisible
        // before it — a skipped auto-grant just silently gave nothing;
        // now it would have silently skipped queuing a pending spin.
        //
        // CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — this escape
        // valve itself is UNCHANGED (still never freezes the run), but a
        // long unbroken streak of escapes with no kill in between is now
        // surfaced explicitly instead of silently looking identical to one
        // unlucky fight — see EndgameWallReport's own doc comment.
        const escapedBossWave = this.wave.currentWave;
        const escapedBoss = getMainBossForWave(escapedBossWave);
        const damageFraction = 1 - (this.battleStats.bossHpPercentRemaining ?? 1);
        this.bestBossDamageFractionInStreak = Math.max(this.bestBossDamageFractionInStreak, damageFraction);
        this.consecutiveBossEscapesWithoutKill += 1;
        if (this.consecutiveBossEscapesWithoutKill >= ENDGAME_WALL_ESCAPE_THRESHOLD) {
          this.endgameWallReport = {
            bossId: escapedBoss.id,
            bossNameKey: escapedBoss.i18nKey,
            wave: escapedBossWave,
            bestWave: this.bestWave,
            bestDamageFraction: this.bestBossDamageFractionInStreak,
            consecutiveEscapes: this.consecutiveBossEscapesWithoutKill,
            diagnosis: generateFailureReport(finalizeBattleStats(this.battleStats, escapedBossWave), this.towers),
          };
        }

        this.activeBossId = null;
        this.advanceBestWave(this.wave.currentWave);
        activateNextWave(this.wave);
        this.phase = "RUNNING";
        this.persist();
      }
    } else {
      this.phase = this.wave.phase === "TRANSITIONING" ? "WAVE_TRANSITION" : "RUNNING";
      if (this.wave.phase === "TRANSITIONING") {
        this.advanceBestWave(this.wave.currentWave);
        if (this.waveCompleteAudioFiredForWave !== this.wave.currentWave) {
          this.waveCompleteAudioFiredForWave = this.wave.currentWave;
          this.emitAudio({ type: "wave_complete" });
        }
        // AUDITORIA E CORREÇÃO GERAL spec section 10/13 — advanceBestWave
        // can now enqueue a pending Roulette spin (pendingRouletteSpinWaves)
        // purely in memory; without persisting here, a reload landing
        // between this wave transition and the next boss/victory tick would
        // silently lose that pending milestone. The sibling BOSS_BATTLE
        // branches above already persist on every wave-advancing event —
        // this keeps the same guarantee for a plain (non-boss) wave clear.
        this.persist();
      }
    }

    if (this.baseHp <= 0) {
      this.stopProgression();
      return;
    }

    this.notify();
  }

  /**
   * Raises bestWave and, the first time THIS wave number is ever crossed,
   * grants its milestone bonus (config/phaseConfig.ts) — spec section 12.
   *
   * AUDITORIA E CORREÇÃO GERAL spec sections 1-3 — every
   * ROULETTE_MILESTONE_INTERVAL waves, this ONLY enqueues the milestone as
   * pending (`pendingRouletteSpinWaves`). It must NEVER roll or grant a
   * reward itself — that was the exact bug this pass fixes: Castle HP (and
   * every other Roulette reward) used to be rolled and applied the instant
   * a milestone wave was reached, with the UI only showing a toast
   * afterward. Now nothing is rolled/granted until the player explicitly
   * calls spinPendingRoulette() (their own ROLETAR click).
   */
  private advanceBestWave(wave: number): void {
    // Season high-water mark (PRÓXIMA GRANDE FASE spec — "Season possui seu
    // próprio seasonBestWave") tracked completely independently of the
    // account's all-time bestWave below: it can be lower than bestWave at
    // any moment (right after a Season boundary resets it to 0, a returning
    // veteran player's very next wave crossed is already a new SEASON best
    // long before it's anywhere near a new ACCOUNT best) — gating this on
    // `wave <= this.bestWave` would silently stop updating it the moment an
    // account's lifetime record pulls ahead, which is exactly wrong.
    if (wave > this.seasonBestWave) this.seasonBestWave = wave;

    if (wave <= this.bestWave) return;
    const bonus = getMilestoneBonus(wave);
    if (bonus > 0) {
      this.gold += bonus;
      // Gem Shards (spec section 34: "obtidos via... milestones") — a
      // small amount scaled off the SAME milestone bonus gold already
      // computed above, not an invented parallel number.
      this.addGemShards(Math.max(1, Math.round(bonus / 150)), `milestone_wave_${wave}`);
    }
    this.bestWave = wave;
    if (wave % ROULETTE_MILESTONE_INTERVAL === 0) this.pendingRouletteSpinWaves.push(wave);
  }

  /**
   * AUDITORIA E CORREÇÃO GERAL spec sections 2-3, 6, 9, 11, 13 — the ONLY
   * way any Roulette reward is ever rolled or granted: an explicit player
   * action (the ROLETAR click). Resolves the OLDEST pending milestone
   * (FIFO — spec section 11: "Roulette 20 → jogador roleta → resultado,
   * Roulette 30 → jogador roleta → resultado", never both at once). Returns
   * false (a no-op) if nothing is pending, so a UI can safely call this
   * without checking first.
   *
   * The result is determined HERE, synchronously, the instant this is
   * called (spec section 6: "o resultado deve ser determinado de maneira
   * segura" at click time) — any spin/reveal animation a UI wants to show
   * is purely a cosmetic delay on ALREADY-decided state, never something
   * that can alter the outcome.
   */
  spinPendingRoulette(): boolean {
    const wave = this.pendingRouletteSpinWaves.shift();
    if (wave === undefined) return false;

    const rewardType = rollRoulette();
    const castleHpGranted = castleHpForReward(rewardType);
    let gemsGranted = 0;
    let castleSkinId: string | null = null;

    if (castleHpGranted > 0) {
      this.castleHpBonus += castleHpGranted;
      this.maxBaseHp += castleHpGranted;
      this.baseHp += castleHpGranted;
    } else if (rewardType === "GEM") {
      gemsGranted = ROULETTE_GEM_REWARD_AMOUNT;
      this.addGems(gemsGranted, `roulette_wave_${wave}`);
    } else if (rewardType === "CASTLE_SKIN") {
      // Grant the first real skin this save doesn't already own; if every
      // real Castle Skin is already unlocked, the 1%-rarity roll falls back
      // to Gems rather than doing nothing (spec section 48).
      const unowned = CASTLE_SKINS.find((s) => !this.unlockedCastleSkinIds.includes(s.id));
      if (unowned) {
        castleSkinId = unowned.id;
        this.unlockedCastleSkinIds = [...this.unlockedCastleSkinIds, unowned.id];
      } else {
        gemsGranted = ROULETTE_CASTLE_SKIN_FALLBACK_GEMS;
        this.addGems(gemsGranted, `roulette_wave_${wave}_skin_fallback`);
      }
    }
    // else rewardType === "NOTHING" — grant absolutely nothing (spec section
    // 4-5: a real, honest chance of walking away empty-handed). Every
    // reward variable above already defaults to its "nothing granted" value.

    this.pendingRouletteResults.push({ wave, rewardType, castleHpGranted, gemsGranted, castleSkinId });
    this.persist();
    this.notify();
    return true;
  }

  /** Dismisses the currently-shown Roulette result banner (see HudSnapshot.pendingRouletteResult) so the next one, if any, can show. */
  acknowledgeRouletteResult(): void {
    this.pendingRouletteResults.shift();
    this.notify();
  }

  private maybeSpawnMiniBoss(nowMs: number): void {
    if (!isMiniBossWave(this.wave.currentWave)) return;
    if (this.miniBossSpawnedForWave === this.wave.currentWave) return;
    if (this.wave.phase !== "SPAWNING") return;
    this.miniBossSpawnedForWave = this.wave.currentWave;
    this.enemies.push(createBossInstance(getMiniBossForWave(this.wave.currentWave), this.wave.currentWave, nowMs));
  }

  /** Elite Wave (spec section 4/5): one stat-and-ability-boosted enemy on top of the wave's normal composition, not a wave-wide change. */
  private maybeSpawnElite(): void {
    const isElite = getWaveTag(this.wave.currentWave) === "ELITE" || isBonusEliteWave(this.wave.currentWave);
    if (!isElite) return;
    if (this.eliteSpawnedForWave === this.wave.currentWave) return;
    if (this.wave.phase !== "SPAWNING") return;
    this.eliteSpawnedForWave = this.wave.currentWave;
    this.enemies.push(createEliteEnemyInstance(ELITE_BASE_TYPE, this.wave.currentWave, ELITE_MODIFIER));
  }

  private maybeDiscover(type: EnemyType): void {
    if (this.discoveredEnemyTypes.has(type)) return;
    this.discoveredEnemyTypes.add(type);
    this.pendingDiscoveries.push(type);
    this.persist();
  }

  /** Dismisses the currently-shown "NEW ENEMY" banner (see HudSnapshot.pendingDiscoveryType) so the next one, if any, can show. */
  acknowledgeDiscovery(): void {
    this.pendingDiscoveries.shift();
    this.notify();
  }

  /**
   * Item System spec section 25: any boss OR mini-boss that dies rolls its
   * DropTable (config/dropTables.ts, keyed off BossDefinition.dropTableId
   * via BossState.bossId — see config/bossConfig.ts.getBossDefinitionById)
   * exactly once. A boss with no dropTableId yet (every biome past Ancient
   * Forest, for now) simply grants nothing — no placeholder loot, per spec
   * section 25's "não criar dezenas de itens agora".
   */
  private grantBossDrop(boss: BossState): void {
    if (boss.isMainBoss) this.bossesDefeatedTotal += 1;
    else this.miniBossesDefeatedTotal += 1;

    // Gem Shards (spec section 34: "obtidos via... bosses"): every boss
    // kill grants a small amount regardless of whether it also has a
    // dropTableId — this is the ONE gem-adjacent reward already wired to a
    // real, non-arbitrary event (a boss actually dying), independent of
    // the item-drop system below. HORDENOVA balance correction: base rates
    // lowered 60/24 -> 1/1 — the previous rates were too generous for an
    // infinite F2P game, especially for players who leave a run active for
    // many hours. Prestige's small, permanently bounded Gem Shard bonus
    // (config/prestige.ts's getPrestigeBonuses) still applies on top, per
    // its own unchanged formula.
    const baseShards = boss.isMainBoss ? 1 : 1;
    const shards = Math.round(baseShards * getPrestigeBonuses(this.prestigeLevel).gemShardMultiplier);
    this.addGemShards(shards, boss.isMainBoss ? "main_boss_kill" : "mini_boss_kill");

    const def = getBossDefinitionById(boss.bossId);
    if (!def || !def.dropTableId) return;
    const table = getDropTable(def.dropTableId);
    if (!table) return;

    const itemDefinitionId = rollDropTable(table);
    const item = createItemInstance(itemDefinitionId, this.playerId, {
      type: boss.isMainBoss ? "BOSS_DROP" : "MINI_BOSS_DROP",
      refId: def.id,
    });
    // Inventory Capacity + Overflow (spec section 36/39): a full inventory
    // never silently drops this reward — it lands in the overflow waiting
    // area instead, still visible in the reward banner either way.
    const result = addItemWithCapacity(this.inventory, this.overflowInventory, item, this.inventoryCapacity);
    this.inventory = result.inventory;
    this.overflowInventory = result.overflow;
    this.pendingItemRewards.push(item);

    const ledgerBase = {
      itemInstanceId: item.instanceId,
      itemDefinitionId: item.itemDefinitionId,
      source: def.id,
    };
    appendLedgerEvent({ ...ledgerBase, eventType: "ITEM_CREATED", fromOwner: null, toOwner: this.playerId });
    appendLedgerEvent({ ...ledgerBase, eventType: "ITEM_DROPPED", fromOwner: null, toOwner: this.playerId });
    appendLedgerEvent({ ...ledgerBase, eventType: "ITEM_ACQUIRED", fromOwner: null, toOwner: this.playerId });

    const firstRecord = checkLocalFirst(this.localFirstDiscoveries, item.itemDefinitionId, item.instanceId, this.playerId);
    if (firstRecord) {
      this.localFirstDiscoveries = { ...this.localFirstDiscoveries, [item.itemDefinitionId]: firstRecord };
    }

    // Persisted immediately rather than waiting for the tick's own
    // conditional persist() (e.g. a mini-boss killed mid-wave doesn't
    // otherwise save until the next wave transition) — a granted item is
    // exactly the kind of state that must never be lost to a reload that
    // happens to land between this drop and some later save point.
    this.persist();
  }

  /** Dismisses the currently-shown item-reward banner (see HudSnapshot.pendingItemReward) so the next one, if any, can show. */
  acknowledgeItemReward(): void {
    this.pendingItemRewards.shift();
    this.persist();
    this.notify();
  }

  getInventory(): readonly ItemInstance[] {
    return this.inventory;
  }

  getUnlockedCastleSkinIds(): readonly string[] {
    return this.unlockedCastleSkinIds;
  }

  getPlayerId(): string {
    return this.playerId;
  }

  getLocalFirstDiscoveries(): LocalFirstDiscoveries {
    return this.localFirstDiscoveries;
  }

  getLocalEconomyTotals(): { bossesDefeatedTotal: number; miniBossesDefeatedTotal: number } {
    return { bossesDefeatedTotal: this.bossesDefeatedTotal, miniBossesDefeatedTotal: this.miniBossesDefeatedTotal };
  }

  private stopProgression(): void {
    this.phase = "PROGRESSION_STOPPED";
    const finalized = finalizeBattleStats(this.battleStats, this.wave.currentWave);
    this.lastFailureReport = generateFailureReport(finalized, this.towers);
    this.bestWave = recordRunResult(this.wave.currentWave, this.storageKey).bestWave;
    this.emitAudio({ type: "defeat" });
    this.persist();
    this.notify();
  }

  private classifyEnemyTier(enemy: EnemyInstance): EnemyAudioTier {
    if (enemy.boss?.isMainBoss) return "boss";
    if (enemy.boss) return "mini_boss";
    if (enemy.elite) return "elite";
    return "regular";
  }

  private emitAudio(event: GameAudioEvent): void {
    this.audioEvents.push(event);
  }

  /** Audio spec section 16 — the ONLY way anything outside this class observes what happened audio-wise. Called once per real tick by audio/GameAudioBridge.ts, never from inside a render loop. */
  drainAudioEvents(): GameAudioEvent[] {
    const events = this.audioEvents;
    this.audioEvents = [];
    return events;
  }

  getFailureReport(): FailureReport | null {
    return this.lastFailureReport;
  }

  /** CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B) — non-null once ENDGAME_WALL_ESCAPE_THRESHOLD consecutive boss escapes (zero kills) have happened. The run keeps ticking regardless — this is purely informational. */
  getEndgameWallReport(): EndgameWallReport | null {
    return this.endgameWallReport;
  }

  /** Dismisses the current wall banner — a fresh one can reappear later if the streak (reset only by a real kill) reaches the threshold again. */
  acknowledgeEndgameWallReport(): void {
    this.endgameWallReport = null;
    this.notify();
  }

  private persist(): void {
    updateSave(
      {
        bestWave: this.bestWave,
        gold: this.gold,
        currentWave: this.wave.currentWave,
        towerLoadout: this.towers.map((t) => ({
          slotId: t.slotId,
          type: t.type,
          level: t.level,
          specializationId: t.specializationId,
          specializationLevel: t.specializationLevel,
          equippedSkinId: t.equippedSkinId,
          masteryLevel: t.masteryLevel,
          equippedItemInstanceIds: t.equippedItemInstanceIds,
        })),
        discoveredEnemyTypes: [...this.discoveredEnemyTypes],
        inventory: this.inventory,
        playerId: this.playerId,
        bossesDefeatedTotal: this.bossesDefeatedTotal,
        miniBossesDefeatedTotal: this.miniBossesDefeatedTotal,
        localFirstDiscoveries: this.localFirstDiscoveries,
        gems: this.gems,
        gemShards: this.gemShards,
        inventoryCapacity: this.inventoryCapacity,
        overflowInventory: this.overflowInventory,
        castleHpBonus: this.castleHpBonus,
        unlockedCastleSkinIds: this.unlockedCastleSkinIds,
        prestigeLevel: this.prestigeLevel,
        pendingRouletteSpinWaves: this.pendingRouletteSpinWaves,
        seasonBestWave: this.seasonBestWave,
        towerMasteryLevels: this.towerMasteryLevels,
        masteryUnlocked: this.masteryUnlocked,
        ownedTowerSkinIds: [...this.ownedTowerSkinIds],
        equippedTowerSkinByType: this.equippedTowerSkinByType,
        unlockedSpecializationIds: this.unlockedSpecializationIds,
        lastFreeRepositionDayIndex: this.lastFreeRepositionDayIndex,
      },
      this.storageKey,
    );
  }

  private cachedHud: HudSnapshot | null = null;

  /**
   * Returns a stable reference when nothing HUD-relevant changed since the
   * last call, so React's useSyncExternalStore (see hooks/useGameEngine)
   * doesn't re-render on every 60fps tick when e.g. only enemy positions moved.
   */
  getHudSnapshot(): HudSnapshot {
    const boss = this.activeBossId ? this.enemies.find((e) => e.id === this.activeBossId) ?? null : null;
    const next: HudSnapshot = {
      phase: this.phase,
      wave: this.wave.currentWave,
      phaseId: getPhaseForWave(this.wave.currentWave).id,
      phaseI18nKey: getPhaseForWave(this.wave.currentWave).i18nKey,
      gold: this.gold,
      gems: this.gems,
      gemShards: this.gemShards,
      baseHp: this.baseHp,
      maxBaseHp: this.maxBaseHp,
      speed: this.speed,
      bestWave: this.bestWave,
      seasonBestWave: this.seasonBestWave,
      enemiesDefeated: this.enemiesDefeated,
      selectedTowerId: this.selectedTowerId,
      bossNameKey: boss?.boss?.nameKey ?? this.bossIntroNameKey,
      bossHp: boss ? boss.hp : null,
      bossMaxHp: boss ? boss.maxHp : null,
      bossIntroRemainingMs: this.phase === "BOSS_INTRO" ? Math.max(0, this.bossIntroRemainingMs) : null,
      bossLastReward: this.phase === "VICTORY" ? this.lastBossReward : null,
      pendingDiscoveryType: this.pendingDiscoveries[0] ?? null,
      pendingItemReward: this.pendingItemRewards[0]
        ? { instanceId: this.pendingItemRewards[0].instanceId, itemDefinitionId: this.pendingItemRewards[0].itemDefinitionId }
        : null,
      pendingRouletteResult: this.pendingRouletteResults[0] ?? null,
      pendingRouletteSpinWave: this.pendingRouletteSpinWaves[0] ?? null,
      repositionFreeAvailable: this.isFreeRepositionAvailable(),
    };

    const prev = this.cachedHud;
    if (prev && hudSnapshotsEqual(prev, next)) return prev;

    this.cachedHud = next;
    return next;
  }

  getRenderSnapshot(): RenderSnapshot {
    return {
      phase: this.phase,
      towers: this.towers,
      enemies: this.enemies,
      projectiles: this.projectiles,
      selectedTowerId: this.selectedTowerId,
      biomeId: getPhaseForWave(this.wave.currentWave).biomeId,
    };
  }
}
