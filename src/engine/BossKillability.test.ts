import { describe, expect, it } from "vitest";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { createTowerInstance, applySiegeDamage, type TowerInstance } from "@/entities/Tower";
import { createBossInstance, tickBossAbilities, tickBossSiege } from "@/engine/BossManager";
import { tickCombat } from "@/engine/CombatSystem";
import { advanceEnemy, isEnemyDead, type EnemyInstance } from "@/entities/Enemy";
import { MAIN_BOSSES, MINI_BOSSES, type BossDefinition } from "@/config/bossConfig";
import { getScaledEnemyStats } from "@/config/enemyStats";
import { getEndgameBossHpMultiplierBonus } from "@/config/phaseConfig";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { getSpecializationsForTower, type SpecializationId } from "@/config/specializations";

/**
 * INFINITE BALANCE OVERHAUL — mandatory permanent regression suite (spec
 * section 37's "Boss: continua matável, scaling acompanha player power").
 * Runs the REAL CombatSystem/BossManager/map geometry, coverage-adjusted —
 * never an idealized `12 x tower DPS` estimate. This is the load-bearing
 * proof behind two real structural fixes made this pass:
 *   1. enemyStats.ts's HP curve replaced with an early-surge x late-power-law
 *      formula that decelerates but never freezes/caps.
 *   2. phaseConfig.ts's getEndgameBossHpMultiplierBonus replaced from
 *      exponential-per-lap (which silently out-raced player power and
 *      recreated a wall around wave ~2000-10,000) to a bounded power-law.
 * Real simulation is what caught #2 — a build whose Specialization/Mastery
 * levels grow with wave saw its damage-budget/boss-HP ratio collapse from
 * ~84x at wave 2000 to ~3x at wave 10,000 under the old formula. This suite
 * locks in the fixed behavior so that regression can never silently return.
 */

interface BuildSlot {
  type: TowerType;
  level: number;
  specializationId: SpecializationId | null;
  specializationLevel: number;
  masteryLevel: number;
}

function makeBuild(slots: readonly BuildSlot[]): TowerInstance[] {
  return slots.slice(0, TOWER_SLOTS.length).map((s, i) =>
    createTowerInstance(
      TOWER_SLOTS[i]!.id,
      s.type,
      TOWER_SLOTS[i]!.position,
      s.level,
      s.specializationId,
      s.specializationLevel,
      null,
      s.masteryLevel,
    ),
  );
}

/** A round-robin, moderately-built roster — never optimized, never F2P-minimal. */
function roundRobinBuild(level: number, specLevel: number, masteryLevel: number): BuildSlot[] {
  return Array.from({ length: 12 }, (_, i) => {
    const type = TOWER_TYPES[i % TOWER_TYPES.length]!;
    return {
      type,
      level,
      specializationId: getSpecializationsForTower(type)[0]!.id,
      specializationLevel: specLevel,
      masteryLevel,
    };
  });
}

/** Specialization/Mastery levels grow with wave — a rough proxy for a player who keeps reinvesting Gold as they progress, rather than a frozen early-game snapshot. */
function growingBuild(wave: number): BuildSlot[] {
  return roundRobinBuild(30, Math.max(1, Math.round(wave / 2)), Math.max(0, Math.round(wave / 3)));
}

/**
 * The real, coverage-adjusted damage a build can land on a single boss
 * target during one full path traversal at `waveNumber` — measured by
 * making the boss effectively unkillable so the traversal always runs to
 * completion (so this measures budget, not luck-dependent kill/no-kill).
 */
function measureDamageBudget(towers: readonly TowerInstance[], def: BossDefinition, waveNumber: number, seed = 1): number {
  const originalRandom = Math.random;
  let s = seed;
  Math.random = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  try {
    const boss = createBossInstance(def, waveNumber, 0);
    boss.hp = 1e18;
    boss.maxHp = 1e18;
    boss.regenPerSecond = 0;
    const enemies: EnemyInstance[] = [boss];

    const DT = 50;
    let now = 0;
    let damageDealt = 0;
    const MAX_MS = 20 * 60 * 1000;

    while (now < MAX_MS) {
      now += DT;

      const summons: EnemyInstance[] = [];
      for (const e of enemies) {
        if (e.boss) {
          summons.push(...tickBossAbilities(e, now, waveNumber, towers));
          const siege = tickBossSiege(e, now, DT, towers);
          if (siege) {
            const target = towers.find((t) => t.id === siege.targetTowerId);
            if (target) applySiegeDamage(target, siege.rawDamage, 2000);
          }
        }
      }
      enemies.push(...summons);

      let bossReachedEnd = false;
      const reached = new Set<string>();
      for (const e of enemies) {
        const { reachedEnd } = advanceEnemy(e, DT);
        if (reachedEnd) {
          reached.add(e.id);
          if (e.id === boss.id) bossReachedEnd = true;
        }
      }

      const { damageEvents } = tickCombat(towers, enemies, DT);
      for (const ev of damageEvents) if (ev.enemyId === boss.id) damageDealt += ev.amount;

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]!;
        if (reached.has(e.id) || isEnemyDead(e)) enemies.splice(i, 1);
      }

      if (bossReachedEnd) break;
    }

    return damageDealt;
  } finally {
    Math.random = originalRandom;
  }
}

function realBossHp(def: BossDefinition, wave: number): number {
  const bruteHp = getScaledEnemyStats("BRUTE", wave).hp;
  return Math.round(bruteHp * def.hpMultiplierVsBrute * getEndgameBossHpMultiplierBonus(wave));
}

describe("Boss killability across the full wave range (real GameEngine, coverage-adjusted DPS)", () => {
  it("a build that keeps reinvesting (Specialization/Mastery scale with wave) can ALWAYS out-damage the main boss's HP budget — the ratio must never collapse toward 1, at any wave from 30 to 10,000", () => {
    const waves = [30, 100, 300, 800, 2000, 5000, 10_000];
    const def = MAIN_BOSSES["hollow-warden"]!;
    for (const wave of waves) {
      const build = makeBuild(growingBuild(wave));
      const budget = measureDamageBudget(build, def, wave);
      const bossHp = realBossHp(def, wave);
      const ratio = budget / bossHp;
      // A healthy margin, not just "barely above 1" — real data at these
      // waves comfortably clears 30x; guard well below that so the test
      // only fails on an actual regression, not routine tuning noise.
      expect(ratio).toBeGreaterThan(5);
    }
  }, 60_000);

  /**
   * BALANCEAMENTO DEFINITIVO audit — the complementary UPPER-bound guard
   * this suite never had: real-GameEngine simulation at wave 1595 (the
   * exact wave a live account reported clearing "trivially") found a
   * round-robin 12/12 reinvesting build's boss margin at ~564x before the
   * fix (config/specializations.ts's IRONWOOD_EXECUTIONER combining two of
   * its own unbounded fields — see that file's own regression test) — an
   * order of magnitude past the "fácil demais" (>30x) contract line. The
   * fix (bossDamageMultiplier saturation) brings this SAME build down to
   * ~32x — right at the "confortável" (20-30x) contract boundary instead
   * of an order of magnitude past "fácil demais" (>30x). This
   * guard catches any FUTURE reintroduction of runaway multiplicative
   * stacking without re-litigating the exact number balance passes may
   * still retune deliberately — the ceiling here is set well above the
   * currently-measured value specifically so it never fires on routine
   * tuning, only on a real regression back toward the old order of magnitude.
   */
  it("BALANCE CEILING: a reinvesting round-robin 12/12 build's boss margin at wave 1595 stays well below the old ~564x blowup — guards against re-introducing runaway multiplicative stacking", () => {
    const def = MAIN_BOSSES["hollow-warden"]!;
    const wave = 1595;
    const build = makeBuild(growingBuild(wave));
    const budget = measureDamageBudget(build, def, wave);
    const bossHp = realBossHp(def, wave);
    const ratio = budget / bossHp;
    expect(ratio).toBeLessThan(60);
  }, 60_000);

  it("EVERY main boss is killable (real damage budget exceeds its HP) by a moderate, non-optimized round-robin build at wave 130", () => {
    const build = makeBuild(roundRobinBuild(30, 5, 0));
    for (const [id, def] of Object.entries(MAIN_BOSSES)) {
      const budget = measureDamageBudget(build, def, 130);
      const bossHp = realBossHp(def, 130);
      expect(budget, `${id} should be killable`).toBeGreaterThan(bossHp);
    }
  }, 60_000);

  it("EVERY mini-boss is killable, and comfortably easier than the equivalent-wave main boss, for the same moderate build — the intended difficulty hierarchy (Normal < Mini-Boss < Main Boss is inverted here: Mini-Boss must be EASIER than Main Boss)", () => {
    const build = makeBuild(roundRobinBuild(30, 5, 0));
    const mainBossRatios = Object.values(MAIN_BOSSES).map((def) => measureDamageBudget(build, def, 130) / realBossHp(def, 130));
    const minMainBossRatio = Math.min(...mainBossRatios);

    for (const [id, def] of Object.entries(MINI_BOSSES)) {
      const budget = measureDamageBudget(build, def, 130);
      const bossHp = realBossHp(def, 130);
      const ratio = budget / bossHp;
      expect(ratio, `${id} should be killable`).toBeGreaterThan(1);
      expect(ratio, `${id} should be easier than the hardest main boss`).toBeGreaterThan(minMainBossRatio);
    }
  }, 60_000);

  it("a fixed, never-reinvested build (level 30, spec 5, mastery 0 forever) EVENTUALLY loses its edge as waves climb — the natural incentive to keep investing, not a bug", () => {
    const build = makeBuild(roundRobinBuild(30, 5, 0));
    const def = MAIN_BOSSES["hollow-warden"]!;
    const earlyRatio = measureDamageBudget(build, def, 30) / realBossHp(def, 30);
    const lateRatio = measureDamageBudget(build, def, 450) / realBossHp(def, 450);
    expect(lateRatio).toBeLessThan(earlyRatio);
  }, 30_000);
});
