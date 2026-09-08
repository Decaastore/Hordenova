import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import type { EnemyInstance } from "@/entities/Enemy";
import { ENEMY_PATH } from "@/data/mapWhisperingWoods";
import { getPathLength } from "@/utils/geometry";
import { computeCastleDamage } from "@/config/castleDamage";

/**
 * BALANCEAMENTO DEFINITIVO spec section 5 — real-GameEngine integration
 * tests for Castle Damage: an enemy that actually crosses the path end
 * takes a real, category-based, wave-scaled bite out of the Castle's
 * current max HP — computed exactly once per crossing, never twice.
 */

type EngineInternals = {
  enemies: EnemyInstance[];
  baseHp: number;
  maxBaseHp: number;
  wave: { currentWave: number };
};

function internals(engine: GameEngine): EngineInternals {
  return engine as unknown as EngineInternals;
}

const PATH_LENGTH = getPathLength(ENEMY_PATH);

/** Spawns a real GameEngine with an empty build, ticks until at least one enemy exists, then forces it to the very edge of the path. */
function spawnEnemyAtPathEnd(engine: GameEngine): EnemyInstance {
  let ticks = 0;
  while (internals(engine).enemies.length === 0 && ticks < 200) {
    engine.update(50);
    ticks++;
  }
  const enemy = internals(engine).enemies[0]!;
  enemy.distanceTraveled = PATH_LENGTH - 1;
  return enemy;
}

describe("Castle Damage (real GameEngine) — BALANCEAMENTO DEFINITIVO spec section 5", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("a NORMAL enemy that reaches the Castle deals exactly the category-based, wave-scaled amount — not the old flat per-archetype number", () => {
    const engine = new GameEngine();
    engine.startRun();

    const enemy = spawnEnemyAtPathEnd(engine);
    const before = internals(engine).baseHp;
    const maxHp = internals(engine).maxBaseHp;
    const wave = internals(engine).wave.currentWave;
    const expectedDamage = computeCastleDamage("NORMAL", wave, maxHp);

    engine.update(50);
    const after = internals(engine).baseHp;

    expect(before - after).toBe(expectedDamage);
    // The enemy that breached is gone — never lingers to hit the base twice.
    expect(internals(engine).enemies.find((e) => e.id === enemy.id)).toBeUndefined();
  });

  it("never applies Castle Damage twice for the same crossing — one breach, one deduction, however many ticks follow", () => {
    const engine = new GameEngine();
    engine.startRun();
    spawnEnemyAtPathEnd(engine);

    engine.update(50);
    const afterBreach = internals(engine).baseHp;
    // Several more ticks with nothing left near the path end must not keep
    // draining the Castle any further from that same, already-removed enemy.
    engine.update(50);
    engine.update(50);
    engine.update(50);
    expect(internals(engine).baseHp).toBe(afterBreach);
  });

  it("the SAME enemy type deals strictly more Castle Damage at a much later wave — the multiplier genuinely grows with progression, unlike the old flat constant", () => {
    const early = new GameEngine();
    early.startRun();
    spawnEnemyAtPathEnd(early);
    const earlyMax = internals(early).maxBaseHp;
    const earlyBefore = internals(early).baseHp;
    early.update(50);
    const earlyDamage = earlyBefore - internals(early).baseHp;

    const lateWaveDamage = computeCastleDamage("NORMAL", 3000, earlyMax);
    const earlyWaveDamage = computeCastleDamage("NORMAL", 1, earlyMax);

    expect(earlyDamage).toBe(earlyWaveDamage);
    expect(lateWaveDamage).toBeGreaterThan(earlyWaveDamage);
  });

  it("does not punish the very start of the game unfairly — a single Normal breach at wave 1 costs only a small slice of Castle max HP", () => {
    const engine = new GameEngine();
    engine.startRun();
    const maxHp = internals(engine).maxBaseHp;
    spawnEnemyAtPathEnd(engine);
    const before = internals(engine).baseHp;
    engine.update(50);
    const damage = before - internals(engine).baseHp;

    expect(damage / maxHp).toBeLessThan(0.05);
  });
});
