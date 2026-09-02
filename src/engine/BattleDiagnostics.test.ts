import { describe, expect, it } from "vitest";
import {
  createBattleStats,
  finalizeBattleStats,
  generateFailureReport,
  recordBaseHit,
  recordBossSnapshot,
  recordDamageEvents,
} from "./BattleDiagnostics";
import { createTowerInstance } from "@/entities/Tower";
import { createEnemyInstance } from "@/entities/Enemy";
import type { DamageEvent } from "./CombatSystem";

describe("BattleDiagnostics", () => {
  it("recommends Frostborn (Slow/CC) when Runners are the enemies leaking through", () => {
    const stats = createBattleStats();
    const runner = createEnemyInstance("RUNNER", 5);
    recordBaseHit(stats, runner);
    recordBaseHit(stats, runner);

    const finalized = finalizeBattleStats(stats, 5);
    const towers = [createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 })];
    const report = generateFailureReport(finalized, towers);

    expect(report.reasonKeys).toContain("fastEnemiesLeaked");
    expect(report.recommendations.some((r) => r.towerType === "FROSTBORN")).toBe(true);
  });

  it("recommends boss/single-target damage when the boss survived the run", () => {
    const stats = createBattleStats();
    const boss = createEnemyInstance("BRUTE", 30);
    boss.hp = boss.maxHp * 0.4;
    boss.boss = {
      bossId: "test-boss",
      name: "Test Boss",
      isMainBoss: true,
      ability: "NONE",
      abilityIntervalMs: 1000,
      baseDamageReduction: 0,
      shieldUntilMs: null,
      nextAbilityAtMs: 0,
    };
    recordBossSnapshot(stats, boss);

    const finalized = finalizeBattleStats(stats, 30);
    const towers = [createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 })];
    const report = generateFailureReport(finalized, towers);

    expect(report.reasonKeys).toContain("bossSurvived");
    expect(report.recommendations.some((r) => r.towerType === "IRONWOOD")).toBe(true);
  });

  it("computes a real, non-random percent damage gain from actual tower level stats", () => {
    const stats = createBattleStats();
    const runner = createEnemyInstance("RUNNER", 5);
    recordBaseHit(stats, runner);
    const finalized = finalizeBattleStats(stats, 5);

    const tower = createTowerInstance("slot-1", "FROSTBORN", { x: 0, y: 0 }, 5);
    const report = generateFailureReport(finalized, [tower]);

    const rec = report.recommendations.find((r) => r.towerType === "FROSTBORN");
    expect(rec).toBeDefined();
    expect(rec!.fromLevel).toBe(5);
    expect(rec!.toLevel).toBe(6);
    expect(rec!.damagePercentGain).toBeGreaterThan(0);
  });

  it("recommends building the tower type when none is owned yet", () => {
    const stats = createBattleStats();
    const runner = createEnemyInstance("RUNNER", 5);
    recordBaseHit(stats, runner);
    const finalized = finalizeBattleStats(stats, 5);

    const report = generateFailureReport(finalized, []);
    const rec = report.recommendations.find((r) => r.towerType === "FROSTBORN");
    expect(rec).toBeDefined();
    expect(rec!.towerId).toBeNull();
  });

  it("flags high-resistance hits and attributes damage/kills to the right tower type", () => {
    const stats = createBattleStats();
    const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 });
    const enemy = createEnemyInstance("SHIELDBEARER", 1);

    const events: DamageEvent[] = [
      { towerId: tower.id, towerType: "IRONWOOD", enemyId: enemy.id, amount: 5, targetDamageReduction: 0.35 },
    ];
    recordDamageEvents(stats, events);

    expect(stats.highResistanceHits).toBe(1);
    expect(stats.damageDealtByTowerType.IRONWOOD).toBe(5);
  });
});
