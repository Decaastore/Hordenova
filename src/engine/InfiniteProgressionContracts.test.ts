import { describe, expect, it } from "vitest";
import { getScaledEnemyStats, ENEMY_TYPES } from "@/config/enemyStats";
import { getEndgameBossHpMultiplierBonus, getEndgameCycleLapCount } from "@/config/phaseConfig";
import { specializationEffectScale, SPECIALIZATION_EFFECT_EXPONENT, getSpecializationUpgradeCost, getSpecializationsForTower } from "@/config/specializations";
import { masteryEffectScale, MASTERY_EFFECT_EXPONENT, getMasteryUpgradeCost } from "@/config/towerMastery";
import { windowedBossDamageBump } from "@/config/bossPowerBudget";
import { MAIN_BOSSES, type BossDefinition } from "@/config/bossConfig";
import { createBossInstance, tickBossAbilities, tickBossSiege } from "@/engine/BossManager";
import { createTowerInstance, applySiegeDamage, type TowerInstance } from "@/entities/Tower";
import { advanceEnemy, isEnemyDead, type EnemyInstance } from "@/entities/Enemy";
import { tickCombat } from "@/engine/CombatSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";

/**
 * v1.0 Infinite Progression Mathematical Specification — R1-R6 automated
 * regression contracts (the "congelamento matemático" audit's final
 * deliverable). These encode, as permanent tests, the exact invariants the
 * frozen spec requires to hold forever: no NaN/Infinity at extreme waves
 * (R1/R6), every asymptotic exponent locked within tolerance (R2), the Gold
 * economy's linear fixed point (R3), the Boss Kill Margin contract inside
 * and outside the wave 300-800 window (R4), CC uptime staying under U6's
 * 55% alert threshold for a realistic composition (R5), and Boss HP always
 * exceeding same-wave Enemy HP (part of R1's numerical-safety family).
 *
 * A failure here is a genuine regression against the frozen spec, not
 * something to "fix" by tweaking these tests — see the spec's own failure
 * protocol.
 */

function logLogSlope(x1: number, y1: number, x2: number, y2: number): number {
  return (Math.log(y2) - Math.log(y1)) / (Math.log(x2) - Math.log(x1));
}

describe("R1/R6 — no NaN/Infinity at extreme waves/levels (up to 1e9)", () => {
  const EXTREME_WAVES = [1, 10, 100, 1000, 1e4, 1e6, 1e8, 1e9];

  it.each(ENEMY_TYPES)("getScaledEnemyStats('%s', wave) stays finite for every extreme wave", (type) => {
    for (const wave of EXTREME_WAVES) {
      const stats = getScaledEnemyStats(type, wave);
      expect(Number.isFinite(stats.hp), `hp at wave ${wave}`).toBe(true);
      expect(Number.isFinite(stats.goldReward), `goldReward at wave ${wave}`).toBe(true);
      expect(Number.isFinite(stats.speed), `speed at wave ${wave}`).toBe(true);
      expect(stats.hp).toBeGreaterThan(0);
    }
  });

  it("Main Boss HP (Brute baseline * hpMultiplierVsBrute * endgame lap bonus) stays finite for every extreme wave", () => {
    const def = MAIN_BOSSES["hollow-warden"]!;
    for (const wave of EXTREME_WAVES) {
      const bruteHp = getScaledEnemyStats("BRUTE", wave).hp;
      const bonus = getEndgameBossHpMultiplierBonus(wave);
      const bossHp = bruteHp * def.hpMultiplierVsBrute * bonus;
      expect(Number.isFinite(bossHp), `bossHp at wave ${wave}`).toBe(true);
      expect(Number.isFinite(bonus), `endgame lap bonus at wave ${wave}`).toBe(true);
      expect(bossHp).toBeGreaterThan(0);
    }
  });

  it("specializationEffectScale/masteryEffectScale stay finite for extreme levels", () => {
    for (const level of [0, 1, 100, 1e4, 1e6, 1e8, 1e9]) {
      expect(Number.isFinite(specializationEffectScale(level)), `spec scale at level ${level}`).toBe(true);
      expect(Number.isFinite(masteryEffectScale(level)), `mastery scale at level ${level}`).toBe(true);
    }
  });

  it("getSpecializationUpgradeCost/getMasteryUpgradeCost stay finite for extreme levels", () => {
    for (const level of [0, 1, 100, 1e4, 1e6, 1e8, 1e9]) {
      expect(Number.isFinite(getSpecializationUpgradeCost("IRONWOOD", level)), `spec cost at level ${level}`).toBe(true);
      expect(Number.isFinite(getMasteryUpgradeCost("IRONWOOD", level)), `mastery cost at level ${level}`).toBe(true);
    }
  });

  it("windowedBossDamageBump stays finite (and exactly 1 outside the window) for extreme waves", () => {
    for (const wave of EXTREME_WAVES) {
      const bump = windowedBossDamageBump(wave);
      expect(Number.isFinite(bump), `bump at wave ${wave}`).toBe(true);
      expect(bump).toBe(1); // every EXTREME_WAVES entry sits outside [300,800]
    }
  });

  it("Boss HP always exceeds same-wave Enemy HP, for every enemy type, at every extreme wave", () => {
    const def = MAIN_BOSSES["hollow-warden"]!;
    for (const wave of EXTREME_WAVES) {
      const bruteHp = getScaledEnemyStats("BRUTE", wave).hp;
      const bossHp = bruteHp * def.hpMultiplierVsBrute * getEndgameBossHpMultiplierBonus(wave);
      for (const type of ENEMY_TYPES) {
        const enemyHp = getScaledEnemyStats(type, wave).hp;
        expect(bossHp, `wave ${wave}, ${type}`).toBeGreaterThan(enemyHp);
      }
    }
  });
});

describe("R2 — every frozen asymptotic exponent stays locked within tolerance", () => {
  const LATE_1 = 1e8;
  const LATE_2 = 1e9;

  it("Enemy HP late exponent stays at 0.72 ± 0.01 (measured via log-log slope between wave 1e8 and 1e9)", () => {
    const hp1 = getScaledEnemyStats("BRUTE", LATE_1).hp;
    const hp2 = getScaledEnemyStats("BRUTE", LATE_2).hp;
    const slope = logLogSlope(LATE_1, hp1, LATE_2, hp2);
    expect(slope).toBeGreaterThan(0.72 - 0.01);
    expect(slope).toBeLessThan(0.72 + 0.01);
  });

  it("Specialization effect exponent stays at 0.50 ± 0.005 (measured via log-log slope between level 1e8 and 1e9)", () => {
    const v1 = specializationEffectScale(LATE_1);
    const v2 = specializationEffectScale(LATE_2);
    const slope = logLogSlope(LATE_1, v1, LATE_2, v2);
    expect(slope).toBeGreaterThan(SPECIALIZATION_EFFECT_EXPONENT - 0.005);
    expect(slope).toBeLessThan(SPECIALIZATION_EFFECT_EXPONENT + 0.005);
  });

  it("Mastery effect exponent stays at 0.45 ± 0.005 (measured via log-log slope between level 1e8 and 1e9)", () => {
    const v1 = masteryEffectScale(LATE_1);
    const v2 = masteryEffectScale(LATE_2);
    const slope = logLogSlope(LATE_1, v1, LATE_2, v2);
    expect(slope).toBeGreaterThan(MASTERY_EFFECT_EXPONENT - 0.005);
    expect(slope).toBeLessThan(MASTERY_EFFECT_EXPONENT + 0.005);
  });

  it("Gold reward exponent stays at 1.00 ± 0.01 (measured via log-log slope between wave 1e8 and 1e9)", () => {
    const g1 = getScaledEnemyStats("BRUTE", LATE_1).goldReward;
    const g2 = getScaledEnemyStats("BRUTE", LATE_2).goldReward;
    const slope = logLogSlope(LATE_1, g1, LATE_2, g2);
    expect(slope).toBeGreaterThan(1.0 - 0.01);
    expect(slope).toBeLessThan(1.0 + 0.01);
  });

  it("Boss endgame HP-lap exponent stays at 0.15 ± 0.01 (measured via log-log slope of the bonus against lap count between wave 1e8 and 1e9)", () => {
    const laps1 = getEndgameCycleLapCount(LATE_1);
    const laps2 = getEndgameCycleLapCount(LATE_2);
    expect(laps2).toBeGreaterThan(laps1); // sanity: the endgame rotation is actually underway by 1e8
    const bonus1 = getEndgameBossHpMultiplierBonus(LATE_1);
    const bonus2 = getEndgameBossHpMultiplierBonus(LATE_2);
    const slope = logLogSlope(1 + laps1, bonus1, 1 + laps2, bonus2);
    expect(slope).toBeGreaterThan(0.15 - 0.01);
    expect(slope).toBeLessThan(0.15 + 0.01);
  });
});

describe("R3 — economy fixed point: Gold income and Gold cost-per-level both converge to exactly linear (exponent 1.00), preserving the level(wave) ∝ wave equilibrium", () => {
  const LATE_1 = 1e8;
  const LATE_2 = 1e9;

  it("Specialization upgrade cost's linear tail (past the compounding cap) grows with exponent 1.00 ± 0.01", () => {
    const c1 = getSpecializationUpgradeCost("IRONWOOD", LATE_1);
    const c2 = getSpecializationUpgradeCost("IRONWOOD", LATE_2);
    const slope = logLogSlope(LATE_1, c1, LATE_2, c2);
    expect(slope).toBeGreaterThan(1.0 - 0.01);
    expect(slope).toBeLessThan(1.0 + 0.01);
  });

  it("Mastery upgrade cost's linear tail (past the compounding cap) grows with exponent 1.00 ± 0.01", () => {
    const c1 = getMasteryUpgradeCost("IRONWOOD", LATE_1);
    const c2 = getMasteryUpgradeCost("IRONWOOD", LATE_2);
    const slope = logLogSlope(LATE_1, c1, LATE_2, c2);
    expect(slope).toBeGreaterThan(1.0 - 0.01);
    expect(slope).toBeLessThan(1.0 + 0.01);
  });
});

// ---------------------------------------------------------------------------
// R4 — Boss Kill Margin: real-engine damage-budget measurement, reusing the
// same coverage-adjusted methodology as BossKillability.test.ts (never an
// idealized DPS estimate). A realistic F2P-paced round-robin build's levels
// at any wave are derived by piecewise-linear interpolation of a real
// GameEngine economic trace (see the frozen spec's U1 calibration).
// ---------------------------------------------------------------------------

/** [wave, specLevel, masteryLevel, towerLevel] — real ticks of a greedy always-cheapest-Gold-action F2P bot. */
const F2P_TRACE: readonly [number, number, number, number][] = [
  [29, 0, 0, 3.6],
  [58, 0, 0, 6.4],
  [303, 0, 14.3, 16.7],
  [842, 0, 54.3, 30],
  [2140, 84.6, 70.0, 30],
  [3510, 183.3, 82.5, 30],
  [4825, 245.7, 99.8, 30],
];

function interpolateTrace(wave: number): { specLevel: number; masteryLevel: number; towerLevel: number } {
  if (wave <= F2P_TRACE[0]![0]) {
    const [, s, m, t] = F2P_TRACE[0]!;
    return { specLevel: s, masteryLevel: m, towerLevel: t };
  }
  for (let i = 0; i < F2P_TRACE.length - 1; i++) {
    const [w1, s1, m1, t1] = F2P_TRACE[i]!;
    const [w2, s2, m2, t2] = F2P_TRACE[i + 1]!;
    if (wave >= w1 && wave <= w2) {
      const f = (wave - w1) / (w2 - w1);
      return { specLevel: s1 + f * (s2 - s1), masteryLevel: m1 + f * (m2 - m1), towerLevel: t1 + f * (t2 - t1) };
    }
  }
  const [wLast, sLast, mLast, tLast] = F2P_TRACE[F2P_TRACE.length - 1]!;
  const [wPrev, sPrev, mPrev, tPrev] = F2P_TRACE[F2P_TRACE.length - 2]!;
  const rate = (wave - wLast) / (wLast - wPrev);
  return {
    specLevel: Math.max(0, sLast + rate * (sLast - sPrev)),
    masteryLevel: Math.max(0, mLast + rate * (mLast - mPrev)),
    towerLevel: Math.min(30, Math.max(1, tLast + rate * (tLast - tPrev))),
  };
}

function f2pBuildForWave(wave: number): TowerInstance[] {
  const { specLevel, masteryLevel, towerLevel } = interpolateTrace(wave);
  const level = Math.round(Math.min(30, Math.max(1, towerLevel)));
  return TOWER_SLOTS.map((slot, i) => {
    const type = TOWER_TYPES[i % TOWER_TYPES.length]!;
    return createTowerInstance(
      slot.id,
      type,
      slot.position,
      level,
      getSpecializationsForTower(type)[0]!.id,
      Math.round(specLevel),
      null,
      Math.round(masteryLevel),
    );
  });
}

/** Real, coverage-adjusted damage a build can land on a single boss target during one full path traversal — boss HP is set effectively unkillable so the traversal always runs to completion (budget, not luck-dependent kill/no-kill). Reuses `waveNumber` for BOTH the boss's own stat scaling and CombatSystem's windowedBump lookup, exactly mirroring the real game. */
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

      const { damageEvents } = tickCombat(towers, enemies, DT, waveNumber);
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

describe("R4 — Boss Kill Margin contract (U1/U3, real GameEngine)", () => {
  const CHECKPOINTS = [300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800];
  const def = MAIN_BOSSES["hollow-warden"]!;

  it("every wave 300-800 checkpoint reaches a Boss Kill Margin of at least 1.5x for a realistic F2P-paced round-robin build", () => {
    for (const wave of CHECKPOINTS) {
      const build = f2pBuildForWave(wave);
      const budget = measureDamageBudget(build, def, wave);
      const bossHp = realBossHp(def, wave);
      const margin = budget / bossHp;
      expect(margin, `wave ${wave}`).toBeGreaterThanOrEqual(1.5);
    }
  }, 120_000);

  it("windowedBossDamageBump introduces no regression past wave 800 — it is exactly 1 there, so margin is unaffected by U1's fix", () => {
    for (const wave of [801, 1000, 5000]) {
      expect(windowedBossDamageBump(wave)).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// R5 — CC uptime: for a composition with up to 4/12 same-type (Frostborn)
// towers, the fraction of time the Main Boss spends under an active
// slow/freeze must stay at or below U6's 55% alert threshold.
// ---------------------------------------------------------------------------

describe("R5 — CC uptime stays within U6's 55% alert threshold for <=4/12 same-type towers", () => {
  it("4 Frostborn towers (max composition covered by U6's reference case) keep Main Boss CC uptime at or below 55%", () => {
    const originalRandom = Math.random;
    let s = 42;
    Math.random = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    try {
      const wave = 500;
      const def = MAIN_BOSSES["hollow-warden"]!;
      const boss = createBossInstance(def, wave, 0);
      boss.hp = 1e18;
      boss.maxHp = 1e18;
      boss.regenPerSecond = 0;

      const towers: TowerInstance[] = Array.from({ length: 4 }, (_, i) =>
        createTowerInstance(TOWER_SLOTS[i]!.id, "FROSTBORN" as TowerType, TOWER_SLOTS[i]!.position, 30),
      );

      const DT = 50;
      let now = 0;
      let msUnderCc = 0;
      let msTotal = 0;
      const WARMUP_MS = 5_000; // let CC-resistance stacks reach steady state before measuring
      const MEASURE_MS = 60_000;

      while (now < WARMUP_MS + MEASURE_MS) {
        now += DT;
        const { reachedEnd } = advanceEnemy(boss, DT);
        if (reachedEnd) boss.position = { x: -1e9, y: -1e9 }; // keep it in range indefinitely for this measurement
        tickCombat(towers, [boss], DT, wave);
        if (now > WARMUP_MS) {
          msTotal += DT;
          if (boss.slow) msUnderCc += DT;
        }
      }

      const uptime = msUnderCc / msTotal;
      expect(uptime).toBeLessThanOrEqual(0.55);
    } finally {
      Math.random = originalRandom;
    }
  }, 30_000);
});

describe("windowedBossDamageBump — direct contract checks", () => {
  it("is exactly 1 for every wave outside (300,800)", () => {
    for (const wave of [0, 1, 100, 299, 801, 900, 5000, 1e6]) {
      expect(windowedBossDamageBump(wave)).toBe(1);
    }
  });

  it("is strictly greater than 1 for every wave inside [300,800]", () => {
    for (let wave = 300; wave <= 800; wave += 25) {
      expect(windowedBossDamageBump(wave)).toBeGreaterThan(1);
    }
  });

  it("peaks at wave 300 (the checkpoint with the worst pre-fix margin) and never exceeds the calibrated maximum", () => {
    let max = 0;
    for (let wave = 300; wave <= 800; wave++) max = Math.max(max, windowedBossDamageBump(wave));
    expect(max).toBeCloseTo(windowedBossDamageBump(300), 6);
    expect(max).toBeLessThan(3.6); // calibrated peak is ~3.556x — guard against a silent re-tune
  });
});
