import {
  getTowerLevelStats,
  getUpgradeCost,
  MAX_TOWER_LEVEL,
  type TowerLevelStats,
  type TowerType,
} from "@/config/towerStats";
import type { Vector2 } from "@/utils/geometry";

export interface TowerInstance {
  id: string;
  slotId: string;
  type: TowerType;
  level: number;
  position: Vector2;
  cooldownRemainingMs: number;
}

let nextTowerId = 1;

export function createTowerInstance(
  slotId: string,
  type: TowerType,
  position: Vector2,
): TowerInstance {
  return {
    id: `tower-${nextTowerId++}`,
    slotId,
    type,
    level: 1,
    position,
    cooldownRemainingMs: 0,
  };
}

export function getTowerStats(tower: TowerInstance): TowerLevelStats {
  return getTowerLevelStats(tower.type, tower.level);
}

export function canUpgradeTower(tower: TowerInstance): boolean {
  return tower.level < MAX_TOWER_LEVEL;
}

export function getTowerUpgradeCost(tower: TowerInstance): number | null {
  return getUpgradeCost(tower.type, tower.level);
}

/** Mutates `tower` in place, incrementing its level (caller owns gold deduction). */
export function upgradeTower(tower: TowerInstance): void {
  if (canUpgradeTower(tower)) tower.level += 1;
}

/** Mutates `tower` in place, ticking its attack cooldown down. */
export function tickTowerCooldown(tower: TowerInstance, dtMs: number): void {
  tower.cooldownRemainingMs = Math.max(0, tower.cooldownRemainingMs - dtMs);
}

export function isTowerReadyToAttack(tower: TowerInstance): boolean {
  return tower.cooldownRemainingMs <= 0;
}

/** Resets the cooldown based on the tower's current attack speed (attacks/second). */
export function resetTowerCooldown(tower: TowerInstance): void {
  const stats = getTowerStats(tower);
  tower.cooldownRemainingMs = 1000 / stats.attackSpeed;
}
