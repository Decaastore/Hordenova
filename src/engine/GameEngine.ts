import { GAME_SPEEDS, RUN_START, type GameSpeed } from "@/config/gameBalance";
import { TOWER_DEFINITIONS, type TowerType } from "@/config/towerStats";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import {
  createTowerInstance,
  getTowerUpgradeCost,
  upgradeTower as upgradeTowerEntity,
  type TowerInstance,
} from "@/entities/Tower";
import { advanceEnemy, createEnemyInstance, isEnemyDead, type EnemyInstance } from "@/entities/Enemy";
import { isProjectileExpired, tickProjectile, type ProjectileInstance } from "@/entities/Projectile";
import { tickCombat } from "./CombatSystem";
import { activateNextWave, createWaveManagerState, tickWaveManager, type WaveManagerState } from "./WaveManager";
import { loadSave, recordRunResult } from "./SaveSystem";
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
}

export interface RenderSnapshot {
  phase: RunPhase;
  towers: readonly TowerInstance[];
  enemies: readonly EnemyInstance[];
  projectiles: readonly ProjectileInstance[];
  selectedTowerId: string | null;
}

/**
 * Single source of truth for one run. Owns all mutable game state and the
 * only public methods allowed to change it. Rendering code only ever
 * READS via getRenderSnapshot()/getHudSnapshot() — see rendering/ layer.
 */
export class GameEngine {
  private phase: RunPhase = "PRE_RUN";
  private speed: GameSpeed = GAME_SPEEDS[0];
  private gold = RUN_START.gold;
  private baseHp = RUN_START.baseHp;
  private readonly maxBaseHp = RUN_START.baseHp;
  private wave: WaveManagerState = createWaveManagerState();
  private towers: TowerInstance[] = [];
  private enemies: EnemyInstance[] = [];
  private projectiles: ProjectileInstance[] = [];
  private enemiesDefeated = 0;
  private selectedTowerId: string | null = null;
  private bestWave = loadSave().bestWave;

  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  startRun(): void {
    this.phase = "RUNNING";
    this.speed = GAME_SPEEDS[0];
    this.gold = RUN_START.gold;
    this.baseHp = RUN_START.baseHp;
    this.wave = createWaveManagerState();
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.enemiesDefeated = 0;
    this.selectedTowerId = null;

    activateNextWave(this.wave); // sole entry point that starts Wave 1
    this.notify();
  }

  restart(): void {
    this.phase = "PRE_RUN";
    this.notify();
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
    this.notify();
  }

  getAvailableSlotIds(): string[] {
    const occupied = new Set(this.towers.map((t) => t.slotId));
    return TOWER_SLOTS.filter((slot) => !occupied.has(slot.id)).map((slot) => slot.id);
  }

  placeTower(slotId: string, type: TowerType): boolean {
    if (this.phase !== "RUNNING" && this.phase !== "WAVE_TRANSITION") return false;
    if (this.towers.some((t) => t.slotId === slotId)) return false;

    const slot = TOWER_SLOTS.find((s) => s.id === slotId);
    if (!slot) return false;

    const cost = TOWER_DEFINITIONS[type].buildCost;
    if (this.gold < cost) return false;

    this.gold -= cost;
    this.towers.push(createTowerInstance(slotId, type, slot.position));
    this.notify();
    return true;
  }

  selectTower(towerId: string | null): void {
    this.selectedTowerId = towerId;
    this.notify();
  }

  upgradeSelectedTower(): boolean {
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return false;

    const cost = getTowerUpgradeCost(tower);
    if (cost === null || this.gold < cost) return false;

    this.gold -= cost;
    upgradeTowerEntity(tower);
    this.notify();
    return true;
  }

  update(dtMs: number): void {
    if (this.phase !== "RUNNING" && this.phase !== "WAVE_TRANSITION") return;

    const scaledDt = dtMs * this.speed;

    const { enemyTypeToSpawn } = tickWaveManager(this.wave, scaledDt, this.enemies.length);
    if (enemyTypeToSpawn) {
      this.enemies.push(createEnemyInstance(enemyTypeToSpawn, this.wave.currentWave));
    }

    const reachedBaseIds = new Set<string>();
    for (const enemy of this.enemies) {
      const { reachedEnd } = advanceEnemy(enemy, scaledDt);
      if (reachedEnd) reachedBaseIds.add(enemy.id);
    }

    const newProjectiles = tickCombat(this.towers, this.enemies, scaledDt);
    this.projectiles.push(...newProjectiles);

    for (const projectile of this.projectiles) tickProjectile(projectile, scaledDt);
    this.projectiles = this.projectiles.filter((p) => !isProjectileExpired(p));

    const survivors: EnemyInstance[] = [];
    for (const enemy of this.enemies) {
      if (reachedBaseIds.has(enemy.id)) {
        this.baseHp = Math.max(0, this.baseHp - enemy.damageToBase);
        continue; // removed, no gold — it breached the base
      }
      if (isEnemyDead(enemy)) {
        this.gold += enemy.goldReward;
        this.enemiesDefeated += 1;
        continue; // removed, killed by towers/burn
      }
      survivors.push(enemy);
    }
    this.enemies = survivors;

    this.phase = this.wave.phase === "TRANSITIONING" ? "WAVE_TRANSITION" : "RUNNING";

    if (this.baseHp <= 0) {
      this.phase = "DEFEAT";
      this.bestWave = recordRunResult(this.wave.currentWave).bestWave;
    }

    this.notify();
  }

  private cachedHud: HudSnapshot | null = null;

  /**
   * Returns a stable reference when nothing HUD-relevant changed since the
   * last call, so React's useSyncExternalStore (see hooks/useGameEngine)
   * doesn't re-render on every 60fps tick when e.g. only enemy positions moved.
   */
  getHudSnapshot(): HudSnapshot {
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
    };

    const prev = this.cachedHud;
    if (
      prev &&
      prev.phase === next.phase &&
      prev.wave === next.wave &&
      prev.gold === next.gold &&
      prev.baseHp === next.baseHp &&
      prev.maxBaseHp === next.maxBaseHp &&
      prev.speed === next.speed &&
      prev.bestWave === next.bestWave &&
      prev.enemiesDefeated === next.enemiesDefeated &&
      prev.selectedTowerId === next.selectedTowerId
    ) {
      return prev;
    }

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
