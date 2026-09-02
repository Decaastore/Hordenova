import {
  BOSS_INTRO_DURATION_MS,
  BOSS_VICTORY_DURATION_MS,
  GAME_SPEEDS,
  OFFLINE_RETURN_MIN_ELAPSED_MS,
  RUN_START,
  type GameSpeed,
} from "@/config/gameBalance";
import { TOWER_DEFINITIONS, type TowerType } from "@/config/towerStats";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { isBossMilestone } from "@/config/waveConfig";
import { isMiniBossWave, MAIN_BOSS, MINI_BOSS } from "@/config/bossConfig";
import {
  createTowerInstance,
  getTowerUpgradeCost,
  upgradeTower as upgradeTowerEntity,
  type TowerInstance,
  type TowerLoadoutEntry,
} from "@/entities/Tower";
import { advanceEnemy, createEnemyInstance, isEnemyDead, type EnemyInstance } from "@/entities/Enemy";
import { isProjectileExpired, tickProjectile, type ProjectileInstance } from "@/entities/Projectile";
import { tickCombat } from "./CombatSystem";
import {
  activateNextWave,
  createWaveManagerState,
  retryCurrentWave,
  tickWaveManager,
  type WaveManagerState,
} from "./WaveManager";
import { createBossInstance, tickBossAbilities } from "./BossManager";
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

export interface HudSnapshot {
  phase: RunPhase;
  wave: number;
  gold: number;
  baseHp: number;
  maxBaseHp: number;
  speed: GameSpeed;
  bestWave: number;
  enemiesDefeated: number;
  selectedTowerId: string | null;
  bossName: string | null;
  bossHp: number | null;
  bossMaxHp: number | null;
  bossIntroRemainingMs: number | null;
}

export interface RenderSnapshot {
  phase: RunPhase;
  towers: readonly TowerInstance[];
  enemies: readonly EnemyInstance[];
  projectiles: readonly ProjectileInstance[];
  selectedTowerId: string | null;
}

function hudSnapshotsEqual(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.phase === b.phase &&
    a.wave === b.wave &&
    a.gold === b.gold &&
    a.baseHp === b.baseHp &&
    a.maxBaseHp === b.maxBaseHp &&
    a.speed === b.speed &&
    a.bestWave === b.bestWave &&
    a.enemiesDefeated === b.enemiesDefeated &&
    a.selectedTowerId === b.selectedTowerId &&
    a.bossName === b.bossName &&
    a.bossHp === b.bossHp &&
    a.bossMaxHp === b.bossMaxHp &&
    a.bossIntroRemainingMs === b.bossIntroRemainingMs
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
 */
export class GameEngine {
  private phase: RunPhase = "PRE_RUN";
  private speed: GameSpeed = GAME_SPEEDS[0];
  private gold = 0;
  private baseHp = RUN_START.baseHp;
  private readonly maxBaseHp = RUN_START.baseHp;
  private wave: WaveManagerState = createWaveManagerState();
  private towers: TowerInstance[] = [];
  private enemies: EnemyInstance[] = [];
  private projectiles: ProjectileInstance[] = [];
  private enemiesDefeated = 0;
  private selectedTowerId: string | null = null;
  private bestWave = 0;

  private bossIntroRemainingMs = 0;
  private bossIntroName: string | null = null;
  private victoryRemainingMs = 0;
  private activeBossId: string | null = null;
  private miniBossSpawnedForWave: number | null = null;

  private battleStats: BattleStats = createBattleStats();
  private lastFailureReport: FailureReport | null = null;
  private offlineSummary: OfflineSimulationResult | null = null;

  private readonly listeners = new Set<() => void>();

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

    const save = loadSave();
    this.bestWave = save.bestWave;
    this.gold = save.gold;
    this.towers = save.towerLoadout.map((entry) => this.instantiateTowerFromLoadout(entry));
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
        this.wave.currentWave = result.endingWave;
        this.gold += result.resourcesEarned;
        this.bestWave = Math.max(this.bestWave, result.endingWave);
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
    this.activeBossId = null;
    this.bossIntroName = null;
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
  }

  private enterBossIntro(waveNumber: number): void {
    this.wave.currentWave = waveNumber;
    this.wave.phase = "IDLE";
    this.wave.spawnQueue = [];
    this.phase = "BOSS_INTRO";
    this.bossIntroRemainingMs = BOSS_INTRO_DURATION_MS;
    this.bossIntroName = MAIN_BOSS.name;
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

  private instantiateTowerFromLoadout(entry: TowerLoadoutEntry): TowerInstance {
    const slot = TOWER_SLOTS.find((s) => s.id === entry.slotId);
    return createTowerInstance(entry.slotId, entry.type, slot ? slot.position : { x: 0, y: 0 }, entry.level);
  }

  placeTower(slotId: string, type: TowerType): boolean {
    if (!this.canModifyLoadout()) return false;
    if (this.towers.some((t) => t.slotId === slotId)) return false;

    const slot = TOWER_SLOTS.find((s) => s.id === slotId);
    if (!slot) return false;

    const cost = TOWER_DEFINITIONS[type].buildCost;
    if (this.gold < cost) return false;

    this.gold -= cost;
    this.towers.push(createTowerInstance(slotId, type, slot.position));
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
    this.persist();
    this.notify();
    return true;
  }

  update(dtMs: number): void {
    if (this.phase === "PRE_RUN" || this.phase === "OFFLINE_RETURN" || this.phase === "PROGRESSION_STOPPED") return;

    const scaledDt = dtMs * this.speed;
    const nowMs = performance.now();

    if (this.phase === "BOSS_INTRO") {
      this.bossIntroRemainingMs -= scaledDt;
      if (this.bossIntroRemainingMs <= 0) {
        const boss = createBossInstance(MAIN_BOSS, this.wave.currentWave, nowMs);
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
        this.persist();
      }
      this.notify();
      return;
    }

    if (this.phase === "BOSS_BATTLE") {
      const boss = this.enemies.find((e) => e.id === this.activeBossId);
      if (boss) {
        const summons = tickBossAbilities(boss, nowMs, this.wave.currentWave);
        this.enemies.push(...summons);
      }
    } else {
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
      }
      this.maybeSpawnMiniBoss(nowMs);
    }

    const reachedBaseIds = new Set<string>();
    for (const enemy of this.enemies) {
      const { reachedEnd } = advanceEnemy(enemy, scaledDt);
      if (reachedEnd) reachedBaseIds.add(enemy.id);
    }

    const { projectiles: newProjectiles, damageEvents } = tickCombat(this.towers, this.enemies, scaledDt);
    this.projectiles.push(...newProjectiles);
    recordDamageEvents(this.battleStats, damageEvents);

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
        if (enemy.id === this.activeBossId) bossDefeatedThisTick = true;
        continue; // removed, killed by towers/burn
      }
      survivors.push(enemy);
    }
    this.enemies = survivors;

    if (this.phase === "BOSS_BATTLE") {
      const boss = this.enemies.find((e) => e.id === this.activeBossId) ?? null;
      recordBossSnapshot(this.battleStats, boss);
      if (bossDefeatedThisTick) {
        this.phase = "VICTORY";
        this.victoryRemainingMs = BOSS_VICTORY_DURATION_MS;
        this.bestWave = Math.max(this.bestWave, this.wave.currentWave);
        this.persist();
      }
    } else {
      this.phase = this.wave.phase === "TRANSITIONING" ? "WAVE_TRANSITION" : "RUNNING";
      if (this.wave.phase === "TRANSITIONING") {
        this.bestWave = Math.max(this.bestWave, this.wave.currentWave);
      }
    }

    if (this.baseHp <= 0) {
      this.stopProgression();
      return;
    }

    this.notify();
  }

  private maybeSpawnMiniBoss(nowMs: number): void {
    if (!isMiniBossWave(this.wave.currentWave)) return;
    if (this.miniBossSpawnedForWave === this.wave.currentWave) return;
    if (this.wave.phase !== "SPAWNING") return;
    this.miniBossSpawnedForWave = this.wave.currentWave;
    this.enemies.push(createBossInstance(MINI_BOSS, this.wave.currentWave, nowMs));
  }

  private stopProgression(): void {
    this.phase = "PROGRESSION_STOPPED";
    const finalized = finalizeBattleStats(this.battleStats, this.wave.currentWave);
    this.lastFailureReport = generateFailureReport(finalized, this.towers);
    this.bestWave = recordRunResult(this.wave.currentWave).bestWave;
    this.persist();
    this.notify();
  }

  getFailureReport(): FailureReport | null {
    return this.lastFailureReport;
  }

  private persist(): void {
    updateSave({
      bestWave: this.bestWave,
      gold: this.gold,
      currentWave: this.wave.currentWave,
      towerLoadout: this.towers.map((t) => ({ slotId: t.slotId, type: t.type, level: t.level })),
    });
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
      gold: this.gold,
      baseHp: this.baseHp,
      maxBaseHp: this.maxBaseHp,
      speed: this.speed,
      bestWave: this.bestWave,
      enemiesDefeated: this.enemiesDefeated,
      selectedTowerId: this.selectedTowerId,
      bossName: boss?.boss?.name ?? this.bossIntroName,
      bossHp: boss ? boss.hp : null,
      bossMaxHp: boss ? boss.maxHp : null,
      bossIntroRemainingMs: this.phase === "BOSS_INTRO" ? Math.max(0, this.bossIntroRemainingMs) : null,
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
    };
  }
}
