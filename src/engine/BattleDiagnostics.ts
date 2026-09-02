import type { TowerInstance } from "@/entities/Tower";
import type { EnemyInstance } from "@/entities/Enemy";
import type { EnemyType } from "@/config/enemyStats";
import { getTowerLevelStats, MAX_TOWER_LEVEL, TOWER_DEFINITIONS, type TowerType } from "@/config/towerStats";
import type { DamageEvent } from "./CombatSystem";

/**
 * Records only what PROGRESSION_STOPPED needs to diagnose a loss and
 * recommend a fix (spec section 12) — not a general analytics system.
 */

const HIGH_RESISTANCE_THRESHOLD = 0.25;

export interface BattleStats {
  damageDealtByTowerType: Record<TowerType, number>;
  killsByTowerType: Record<TowerType, number>;
  enemiesReachedBaseByType: Partial<Record<EnemyType, number>>;
  totalBaseDamageTaken: number;
  bossEncountered: boolean;
  bossName: string | null;
  bossHpPercentRemaining: number | null;
  highResistanceHits: number;
  totalHits: number;
  /** enemyId -> the tower type that most recently damaged it, for last-hit kill attribution. */
  lastHitTowerType: Record<string, TowerType>;
}

export function createBattleStats(): BattleStats {
  return {
    damageDealtByTowerType: { IRONWOOD: 0, INFERNO: 0, FROSTBORN: 0, STORMCALLER: 0 },
    killsByTowerType: { IRONWOOD: 0, INFERNO: 0, FROSTBORN: 0, STORMCALLER: 0 },
    enemiesReachedBaseByType: {},
    totalBaseDamageTaken: 0,
    bossEncountered: false,
    bossName: null,
    bossHpPercentRemaining: null,
    highResistanceHits: 0,
    totalHits: 0,
    lastHitTowerType: {},
  };
}

export function recordDamageEvents(stats: BattleStats, events: readonly DamageEvent[]): void {
  for (const event of events) {
    stats.damageDealtByTowerType[event.towerType] += event.amount;
    stats.lastHitTowerType[event.enemyId] = event.towerType;
    stats.totalHits += 1;
    if (event.targetDamageReduction >= HIGH_RESISTANCE_THRESHOLD) stats.highResistanceHits += 1;
  }
}

export function recordKill(stats: BattleStats, enemy: EnemyInstance): void {
  const towerType = stats.lastHitTowerType[enemy.id];
  if (towerType) stats.killsByTowerType[towerType] += 1;
  delete stats.lastHitTowerType[enemy.id];
}

export function recordBaseHit(stats: BattleStats, enemy: EnemyInstance): void {
  stats.totalBaseDamageTaken += enemy.damageToBase;
  stats.enemiesReachedBaseByType[enemy.type] = (stats.enemiesReachedBaseByType[enemy.type] ?? 0) + 1;
}

export function recordBossSnapshot(stats: BattleStats, boss: EnemyInstance | null): void {
  if (!boss?.boss) return;
  stats.bossEncountered = true;
  stats.bossName = boss.boss.name;
  stats.bossHpPercentRemaining = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
}

export interface FinalizedBattleStats extends BattleStats {
  waveReached: number;
}

export function finalizeBattleStats(stats: BattleStats, waveReached: number): FinalizedBattleStats {
  return { ...stats, waveReached };
}

export type RecommendationReasonKey =
  | "fastEnemiesLeaked"
  | "highResistance"
  | "bossSurvived"
  | "overwhelmedByNumbers"
  | "tankyEnemiesLeaked"
  | "lowDps";

export interface UpgradeRecommendation {
  id: string;
  reasonKey: RecommendationReasonKey;
  towerType: TowerType;
  /** null when the player has no tower of this type built yet — recommendation is "build one" rather than "upgrade". */
  towerId: string | null;
  fromLevel: number | null;
  toLevel: number | null;
  damagePercentGain: number | null;
}

export interface FailureReport {
  waveReached: number;
  reasonKeys: RecommendationReasonKey[];
  recommendations: UpgradeRecommendation[];
}

function buildRecommendation(
  towers: readonly TowerInstance[],
  type: TowerType,
  reasonKey: RecommendationReasonKey,
): UpgradeRecommendation | null {
  const owned = towers.filter((t) => t.type === type).sort((a, b) => a.level - b.level)[0];

  if (!owned) {
    return {
      id: `${reasonKey}-build-${type}`,
      reasonKey,
      towerType: type,
      towerId: null,
      fromLevel: null,
      toLevel: null,
      damagePercentGain: null,
    };
  }

  if (owned.level >= MAX_TOWER_LEVEL) return null;

  const current = getTowerLevelStats(type, owned.level);
  const next = getTowerLevelStats(type, owned.level + 1);
  const damagePercentGain = current.damage > 0 ? Math.round(((next.damage - current.damage) / current.damage) * 100) : 0;

  return {
    id: `${reasonKey}-${owned.id}`,
    reasonKey,
    towerType: type,
    towerId: owned.id,
    fromLevel: owned.level,
    toLevel: owned.level + 1,
    damagePercentGain,
  };
}

/**
 * Deterministic, rule-based diagnosis from real recorded battle data — spec
 * section 2's explicit mapping table, e.g. "enemies too fast -> Slow/CC",
 * "boss survived -> Boss/Single-Target damage". Never randomized.
 */
export function generateFailureReport(
  stats: FinalizedBattleStats,
  towers: readonly TowerInstance[],
): FailureReport {
  const reasonKeys: RecommendationReasonKey[] = [];
  const recommendations: UpgradeRecommendation[] = [];
  const seenTowerTypes = new Set<TowerType>();

  const addRecommendation = (type: TowerType, reasonKey: RecommendationReasonKey) => {
    if (seenTowerTypes.has(type)) return;
    const rec = buildRecommendation(towers, type, reasonKey);
    if (rec) {
      recommendations.push(rec);
      seenTowerTypes.add(type);
    }
  };

  const fastLeaks = stats.enemiesReachedBaseByType.RUNNER ?? 0;
  const tankyLeaks = (stats.enemiesReachedBaseByType.BRUTE ?? 0) + (stats.enemiesReachedBaseByType.SHIELDBEARER ?? 0);
  const totalLeaks = Object.values(stats.enemiesReachedBaseByType).reduce((sum, count) => sum + (count ?? 0), 0);
  const resistanceRatio = stats.totalHits > 0 ? stats.highResistanceHits / stats.totalHits : 0;
  const totalDamageDealt = Object.values(stats.damageDealtByTowerType).reduce((sum, amount) => sum + amount, 0);

  if (fastLeaks > 0) {
    reasonKeys.push("fastEnemiesLeaked");
    addRecommendation("FROSTBORN", "fastEnemiesLeaked");
  }

  if (stats.bossEncountered && (stats.bossHpPercentRemaining ?? 0) > 0) {
    reasonKeys.push("bossSurvived");
    addRecommendation("IRONWOOD", "bossSurvived");
  }

  if (resistanceRatio > 0.3) {
    reasonKeys.push("highResistance");
    addRecommendation("IRONWOOD", "highResistance");
  }

  if (tankyLeaks > 0) {
    reasonKeys.push("tankyEnemiesLeaked");
    addRecommendation("IRONWOOD", "tankyEnemiesLeaked");
  }

  if (totalLeaks >= 4) {
    reasonKeys.push("overwhelmedByNumbers");
    addRecommendation("INFERNO", "overwhelmedByNumbers");
  }

  if (reasonKeys.length === 0 || totalDamageDealt < stats.totalBaseDamageTaken * 4) {
    reasonKeys.push("lowDps");
    addRecommendation(weakestTowerType(stats.damageDealtByTowerType, towers), "lowDps");
  }

  return {
    waveReached: stats.waveReached,
    reasonKeys: dedupe(reasonKeys),
    recommendations: recommendations.slice(0, 4),
  };
}

function weakestTowerType(
  damageDealtByTowerType: Record<TowerType, number>,
  towers: readonly TowerInstance[],
): TowerType {
  const builtTypes = new Set(towers.map((t) => t.type));
  const candidates = builtTypes.size > 0 ? [...builtTypes] : (Object.keys(TOWER_DEFINITIONS) as TowerType[]);
  return candidates.reduce((weakest, type) =>
    damageDealtByTowerType[type] < damageDealtByTowerType[weakest] ? type : weakest,
  );
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}
