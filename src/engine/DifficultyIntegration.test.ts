import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { DIFFICULTY_MULTIPLIER_MAX, DIFFICULTY_MULTIPLIER_MIN } from "@/config/difficultyScaling";
import { getScaledEnemyStats } from "@/config/enemyStats";

const TICK_MS = 50;

/**
 * DIFICULDADE INDIVIDUAL POR JOGADOR — end-to-end proof through the REAL
 * GameEngine tick loop: a strong loadout and a weak loadout, on the exact
 * same global wave, spawn enemies at DIFFERENT (but boundedly different) HP
 * — never identical (that would mean no individual adjustment happened),
 * never wildly divergent (that would mean the bound broke), and never equal
 * to the player's own DPS.
 */
describe("Individual difficulty adjustment — real GameEngine integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function setupAtWave(wave: number, towerLevel: number | null): GameEngine {
    updateSave({ gold: 1_000_000, currentWave: wave, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    if (towerLevel !== null) {
      engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
      const tower = engine.getRenderSnapshot().towers[0]!;
      engine.selectTower(tower.id);
      while (engine.getRenderSnapshot().towers[0]!.level < towerLevel) {
        if (!engine.upgradeSelectedTower()) break;
      }
    }
    return engine;
  }

  /**
   * Reads `maxHp` (never decremented by damage, unlike `hp`) off the first
   * CRAWLER-type enemy seen across the whole array on any tick — scanning
   * every tick (not just checking index 0 once) so a strong build that
   * kills its first target within a tick or two can't make this miss it
   * before it's removed from the array.
   */
  function findCrawlerMaxHp(engine: GameEngine, maxTicks = 400): number | null {
    for (let i = 0; i < maxTicks; i++) {
      engine.update(TICK_MS);
      const crawler = engine.getRenderSnapshot().enemies.find((e) => !e.boss && e.type === "CRAWLER");
      if (crawler) return crawler.maxHp;
    }
    return null;
  }

  it("a strong, maxed-level loadout spawns tougher normal enemies at the same wave than an empty loadout — but only within the bounded range", () => {
    // Wave 45 is deliberately NOT a boss milestone (30/50/70/90/110/130...)
    // so the engine resumes directly into a normal-spawn RUNNING phase,
    // letting placeTower/upgrade succeed immediately after resume.
    const weak = setupAtWave(45, null); // no towers at all placed
    const weakHp = findCrawlerMaxHp(weak);

    const strong = setupAtWave(45, 60); // one maxed-level IRONWOOD
    const strongHp = findCrawlerMaxHp(strong);

    expect(weakHp).not.toBeNull();
    expect(strongHp).not.toBeNull();
    expect(strongHp!).toBeGreaterThan(weakHp!);

    // Bound check: neither can stray outside [MIN, MAX] × the frozen global baseline.
    const baselineHp = getScaledEnemyStats("CRAWLER", 45).hp;
    expect(weakHp!).toBeGreaterThanOrEqual(Math.round(baselineHp * DIFFICULTY_MULTIPLIER_MIN) - 1);
    expect(strongHp!).toBeLessThanOrEqual(Math.round(baselineHp * DIFFICULTY_MULTIPLIER_MAX) + 1);
  });

  it("Boss HP is completely unaffected by the individual difficulty adjustment — Boss/Mini-Boss formulas stay frozen", () => {
    updateSave({ gold: 1_000_000, currentWave: 30, towerLoadout: [] });
    const weak = new GameEngine();
    weak.startRun();

    // Build and max the tower BEFORE jumping to the boss wave — wave 30
    // itself starts the engine directly in BOSS_INTRO (canModifyLoadout()
    // is false there), so the loadout must be assembled at a normal wave
    // first, then the save's currentWave is advanced directly and a fresh
    // engine resumes into the boss fight with that already-built tower.
    updateSave({ gold: 1_000_000, currentWave: 1, towerLoadout: [] });
    const seed = new GameEngine();
    seed.startRun();
    seed.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    const seedTower = seed.getRenderSnapshot().towers[0]!;
    seed.selectTower(seedTower.id);
    while (seed.getRenderSnapshot().towers[0]!.level < 60) {
      if (!seed.upgradeSelectedTower()) break;
    }
    updateSave({ currentWave: 30 });
    const strong = new GameEngine();
    strong.startRun();

    let weakBossHp: number | null = null;
    let strongBossHp: number | null = null;
    for (let i = 0; i < 400 && (weakBossHp === null || strongBossHp === null); i++) {
      weak.update(TICK_MS);
      strong.update(TICK_MS);
      weakBossHp ??= weak.getRenderSnapshot().enemies.find((e) => e.boss?.isMainBoss)?.maxHp ?? null;
      strongBossHp ??= strong.getRenderSnapshot().enemies.find((e) => e.boss?.isMainBoss)?.maxHp ?? null;
    }

    expect(weakBossHp).not.toBeNull();
    expect(strongBossHp).not.toBeNull();
    expect(strongBossHp).toBe(weakBossHp); // identical — the difficulty adjustment never reaches Boss HP
  });
});
