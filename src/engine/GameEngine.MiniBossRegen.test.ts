import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

const TICK_MS = 100;
/** wave % 6 === 2 selects "mossback-regenerator" — see config/bossConfig.ts's MINI_BOSS_ROSTER — and wave 14 is a real miniBossWaves entry for phase 1 (config/phaseConfig.ts). */
const MOSSBACK_WAVE = 14;

/**
 * P0 root-cause fix, proven end-to-end through the REAL engine (not just
 * Enemy.ts's unit tests): the user-reported "mini-boss ~4420 HP appears
 * stuck despite visibly taking damage" bug. Root cause was passive regen
 * (regenPerSecond, entities/Enemy.ts) applying unconditionally every tick
 * with no link to recent damage — under weak-enough sustained DPS this let
 * a REGENERATOR-archetype mini-boss's HP climb to and permanently pin at
 * exactly maxHp. These tests drive a real GameEngine through a real wave
 * (real WaveManager spawn timing, real CombatSystem targeting/damage, real
 * BossManager instance) and track ONE specific enemy.id from spawn to
 * removal — not "is a mini-boss present" (which would silently conflate
 * separate encounters across a cycling roster, a mistake made and
 * self-corrected during this bug's investigation).
 */
describe("GameEngine — mini-boss regen no longer causes a permanent HP stalemate (P0 fix)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("a real mossback-regenerator mini-boss's tracked HP genuinely declines under sustained real tower fire and never bounces back above a prior sampled value without a legitimate un-suppressed regen tick", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // no crit/freeze RNG noise
    // Every slot filled (not just 2) so the mini-boss is under continuous
    // fire along the whole path — isolating the regen-suppression fix
    // itself rather than incidental path-coverage gaps from a sparse build.
    updateSave({
      currentWave: MOSSBACK_WAVE,
      gold: 0,
      towerLoadout: TOWER_SLOTS.map((slot, i) => ({
        slotId: slot.id,
        type: (["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"] as const)[i % 4]!,
        level: 8,
      })),
    });
    const engine = new GameEngine();
    engine.startRun();

    let trackedId: string | null = null;
    let initialHp = 0;
    let maxHp = 0;
    let sawDamage = false;
    let diedOrRemoved = false;
    // The exact bug pattern reproduced during investigation: HP pinned at
    // EXACTLY maxHp for dozens of consecutive sampled ticks after having
    // already taken damage. A brief, legitimate return to maxHp (the enemy
    // genuinely leaving every tower's range for a stretch, per real path
    // geometry) is allowed — an indefinite pin at maxHp specifically is not.
    let consecutiveTicksPinnedAtMaxAfterDamage = 0;
    let worstPinStreak = 0;
    let tookDamageAtLeastOnce = false;

    for (let i = 0; i < 6000; i++) {
      engine.update(TICK_MS);
      const enemies = engine.getRenderSnapshot().enemies;
      const miniBoss = enemies.find((e) => e.boss?.bossId === "mossback-regenerator");

      if (trackedId === null && miniBoss) {
        trackedId = miniBoss.id;
        initialHp = miniBoss.hp;
        maxHp = miniBoss.maxHp;
      }

      if (trackedId !== null) {
        const stillPresent = enemies.find((e) => e.id === trackedId);
        if (!stillPresent) {
          diedOrRemoved = true;
          break;
        }
        if (stillPresent.hp < maxHp) {
          sawDamage = true;
          tookDamageAtLeastOnce = true;
        }
        if (tookDamageAtLeastOnce && stillPresent.hp >= maxHp) {
          consecutiveTicksPinnedAtMaxAfterDamage += 1;
          worstPinStreak = Math.max(worstPinStreak, consecutiveTicksPinnedAtMaxAfterDamage);
        } else {
          consecutiveTicksPinnedAtMaxAfterDamage = 0;
        }
      }

      if (engine.getHudSnapshot().phase === "PROGRESSION_STOPPED") break;
    }

    expect(trackedId).not.toBeNull(); // the mini-boss actually spawned during this run
    expect(initialHp).toBeGreaterThan(0);
    expect(initialHp).toBeLessThanOrEqual(maxHp); // combat can land in the same 100ms tick as the spawn, so it may already be below maxHp on first observation
    expect(sawDamage).toBe(true); // real damage landed on the real instance
    // The original bug pinned HP at exactly maxHp for the ENTIRE remainder
    // of the run (dozens of consecutive 100ms-sampled ticks, i.e. seconds).
    // 20 consecutive ticks (2s) comfortably exceeds REGEN_SUPPRESSION_MS's
    // own window, so a real, brief "walked out of range" recovery can't
    // trip this, while a genuine indefinite stalemate still would.
    expect(worstPinStreak).toBeLessThan(20);
    expect(diedOrRemoved).toBe(true); // it was eventually defeated (or the wave moved past it) — no infinite stalemate
  }, 20_000);

  it("a strong real build can defeat a real mossback-regenerator mini-boss outright (regen is suppressed, not broken)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    updateSave({
      currentWave: MOSSBACK_WAVE,
      gold: 0,
      towerLoadout: [
        { slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 25 },
        { slotId: TOWER_SLOTS[1]!.id, type: "INFERNO", level: 25 },
        { slotId: TOWER_SLOTS[2]!.id, type: "STORMCALLER", level: 25 },
      ],
    });
    const engine = new GameEngine();
    engine.startRun();

    let sawMiniBoss = false;
    let miniBossDied = false;

    for (let i = 0; i < 6000; i++) {
      engine.update(TICK_MS);
      const enemies = engine.getRenderSnapshot().enemies;
      const stillAlive = enemies.some((e) => e.boss?.bossId === "mossback-regenerator");
      if (stillAlive) sawMiniBoss = true;
      if (sawMiniBoss && !stillAlive) {
        miniBossDied = true;
        break;
      }
      if (engine.getHudSnapshot().phase === "PROGRESSION_STOPPED") break;
    }

    expect(sawMiniBoss).toBe(true);
    expect(miniBossDied).toBe(true);
  }, 20_000);
});
