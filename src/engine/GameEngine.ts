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
import {
  castleHpForReward,
  rollRoulette,
  ROULETTE_CASTLE_SKIN_FALLBACK_GEMS,
  ROULETTE_GEM_REWARD_AMOUNT,
  ROULETTE_MILESTONE_INTERVAL,
  type RouletteRewardType,
} from "@/config/roulette";
import { CASTLE_SKINS } from "@/config/castleSkins";
import { getPrestigeUpgradeCost } from "@/config/prestige";
import type { EnemyType } from "@/config/enemyStats";
import { getDropTable, rollDropTable } from "@/config/dropTables";
import { createItemInstance, type ItemInstance } from "@/entities/Item";
import { addItemWithCapacity, claimFromOverflow, DEFAULT_INVENTORY_CAPACITY } from "./InventoryManager";
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
  getMasteryUpgradeCostFor,
  upgradeMastery as upgradeMasteryEntity,
  canRespecSpecialization,
  respecSpecialization as respecSpecializationEntity,
  applySiegeDamage,
  resetTowerSurvival,
  type TowerInstance,
  type TowerLoadoutEntry,
} from "@/entities/Tower";
import { getAvailableRespecTokens } from "@/config/towerMastery";
import { getTowerSkinDefinition } from "@/config/towerSkins";
import { SPECIALIZATION_UNLOCK_GEM_COST, type SpecializationId } from "@/config/specializations";
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
  damageMultiplier: 1.25,
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
  /** Current phase's id (config/phaseConfig.ts) — also its i18n key (`phases.<phaseId>.name`) and its biome's registry key. */
  phaseId: string;
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
    a.pendingRouletteSpinWave === b.pendingRouletteSpinWave
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

  // CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE) — Tower Mastery and Tower
  // Skin ownership are PERMANENT, account-wide, keyed by TOWER TYPE (every
  // placed tower of a type shares its type's Mastery level and equipped
  // skin) — unlike `towers[].level`/`specializationLevel`, which live in the
  // Season-scoped towerLoadout and reset to 0 at every Season boundary (see
  // AscensionManager.syncSeasonIfNeeded). See SaveData's doc comment for the
  // full PERMANENT vs SEASONAL split this mirrors.
  private towerMasteryLevels: Partial<Record<TowerType, number>> = {};
  private ownedTowerSkinIds = new Set<string>();
  private equippedTowerSkinByType: Partial<Record<TowerType, string>> = {};

  /**
   * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — Specialization Respec
   * Tokens spent so far, PER TOWER TYPE — the exact same permanent,
   * account-wide-by-type persistence shape as towerMasteryLevels above
   * (spec's own suggestion: "mesma filosofia de persistência já usada para
   * Mastery"). How many tokens are AVAILABLE is never stored directly —
   * it's always recomputed as getAvailableRespecTokens(masteryLevel,
   * spent), so a reload/restart can never re-grant a token that was
   * already spent (idempotent by construction, not by a guard flag).
   */
  private towerRespecTokensSpent: Partial<Record<TowerType, number>> = {};

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
    this.ownedTowerSkinIds = new Set(save.ownedTowerSkinIds);
    this.equippedTowerSkinByType = { ...save.equippedTowerSkinByType };
    this.towerRespecTokensSpent = { ...save.towerRespecTokensSpent };
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
      ),
    );
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
   * Master Implementation Pass spec sections 3-6 — TOWER MASTERY: the
   * uncapped sink past MAX_TOWER_LEVEL. Deliberately available at ANY tower
   * level (not gated behind level 30) — a player free to invest earlier if
   * they'd rather spread spending out, exactly like Specialization already
   * works once its own level gate is passed.
   *
   * CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE / SEASON COMPETITIVA):
   * Mastery is PERMANENT and funded by GEMS, never Gold — but grants ZERO
   * combat power (see config/towerMastery.ts's doc comment for what it
   * grants instead: Specialization Respec Tokens + cosmetic-only visual
   * tiers). This is therefore an ordinary Gems purchase, not an exception
   * to the "Gems never buy combat power" contract. The level lives in
   * `this.towerMasteryLevels` (keyed by TYPE, not by tower instance),
   * applied to every placed tower of that type immediately so two Ironwood
   * towers never silently disagree on their own Mastery level.
   */
  upgradeSelectedTowerMastery(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;

    const cost = getMasteryUpgradeCostFor(tower);
    if (!this.spendGems(cost, `tower_mastery:${tower.type}`)) return false;

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

  /** How many Specialization Respec Tokens the selected tower's TYPE currently has available (earned by masteryLevel, minus spent) — 0 if nothing selected. */
  getAvailableRespecTokensForSelectedTower(): number {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return 0;
    return getAvailableRespecTokens(tower.masteryLevel, this.towerRespecTokensSpent[tower.type] ?? 0);
  }

  canRespecSelectedTowerSpecialization(): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    return canRespecSpecialization(tower, this.towerRespecTokensSpent[tower.type] ?? 0);
  }

  /**
   * Spends 1 Specialization Respec Token to reset the SELECTED tower's
   * specialization path back to unchosen (specializationId -> null,
   * specializationLevel -> 0) — everything else (level, masteryLevel,
   * unlock status, HP, equipped skin) is untouched. The token pool itself
   * is per TYPE (mirrors towerMasteryLevels), so spending here reduces
   * what every tower of this type has available, exactly like Mastery
   * itself is shared account-wide-by-type.
   */
  respecSelectedTowerSpecialization(): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;
    const spent = this.towerRespecTokensSpent[tower.type] ?? 0;
    if (!canRespecSpecialization(tower, spent)) return false;

    respecSpecializationEntity(tower);
    this.towerRespecTokensSpent[tower.type] = spent + 1;
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
  // -------------------------------------------------------------------

  canChooseSpecializationForSelectedTower(): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    return !!tower && canChooseSpecialization(tower);
  }

  /**
   * Visual Overhaul spec section 21: the CHOICE of a specialization path
   * (null -> level 1) is a premium, Gems-gated strategic decision, not
   * another gold sink — Gems can unlock a build direction, never buy
   * damage/level/HP/victory directly, and this is the one place that
   * unlock lives. Every level AFTER the choice (1->2, ..., 4->5, via
   * upgradeSelectedTowerSpecialization below) still costs Gold, unchanged.
   * Permanent once chosen — no re-spec in this pass, matching the spec's
   * "escolha real".
   */
  chooseTowerSpecialization(specializationId: SpecializationId): boolean {
    if (!this.canModifyLoadout()) return false;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower || !canChooseSpecialization(tower)) return false;
    if (!this.canAffordGems(SPECIALIZATION_UNLOCK_GEM_COST)) return false;

    const applied = chooseSpecializationEntity(tower, specializationId);
    if (!applied) return false;

    this.spendGems(SPECIALIZATION_UNLOCK_GEM_COST, `specialization:${specializationId}`);
    this.emitAudio({ type: "level_unlock" });
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
  // Master Implementation Pass spec section 7-8 — PROFILE PRESTIGE. The
  // recurring, uncapped Gem sink: purely cosmetic (a display tier/color,
  // see config/prestige.ts), never a combat-power lever, exactly like
  // every other Gem spend this class exposes.
  // -------------------------------------------------------------------

  getPrestigeLevel(): number {
    return this.prestigeLevel;
  }

  upgradePrestige(): boolean {
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

    const { projectiles: newProjectiles, damageEvents } = tickCombat(this.towers, this.enemies, scaledDt);
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
        this.baseHp = Math.max(0, this.baseHp - enemy.damageToBase);
        recordBaseHit(this.battleStats, enemy);
        continue; // removed, no gold — it breached the base
      }
      if (isEnemyDead(enemy)) {
        this.gold += enemy.goldReward;
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
    // the item-drop system below.
    this.addGemShards(boss.isMainBoss ? 5 : 2, boss.isMainBoss ? "main_boss_kill" : "mini_boss_kill");

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
        ownedTowerSkinIds: [...this.ownedTowerSkinIds],
        equippedTowerSkinByType: this.equippedTowerSkinByType,
        towerRespecTokensSpent: this.towerRespecTokensSpent,
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
