import { afterEach, describe, expect, it, vi } from "vitest";
import { detectVfxEvents } from "./CanvasRenderer";
import { VfxManager } from "./vfx";
import { createEnemyInstance } from "@/entities/Enemy";
import type { RenderSnapshot } from "@/engine/GameEngine";
import type { RunPhase } from "@/engine/types";

function emptySnapshot(phase: RunPhase = "RUNNING"): RenderSnapshot {
  return { phase, towers: [], enemies: [], projectiles: [], selectedTowerId: null, biomeId: "ANCIENT_FOREST" };
}

describe("CanvasRenderer.detectVfxEvents — camera shake gating (integration)", () => {
  it("a quiet tick with no state changes triggers no shake at all", () => {
    const vfx = new VfxManager();
    detectVfxEvents(emptySnapshot(), 100, 1, "RUNNING", "RUNNING", vfx, new Map(), new Map(), new Map(), 100, { x: 0, y: 0 });
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("transitioning INTO BOSS_INTRO triggers shake exactly once (on the transition, not every frame spent in it)", () => {
    const vfx = new VfxManager();
    detectVfxEvents(emptySnapshot("BOSS_INTRO"), 100, 1, "BOSS_INTRO", "RUNNING", vfx, new Map(), new Map(), new Map(), 100, { x: 0, y: 0 });
    const firedMagnitude = (vfx as unknown as { shakeMagnitude: number }).shakeMagnitude;
    expect(firedMagnitude).toBeGreaterThan(0);

    // Let the shake fully decay, then simulate several more frames still
    // inside BOSS_INTRO (prevPhase === phase === "BOSS_INTRO") — it must
    // NOT keep re-triggering every frame.
    vfx.update(10_000);
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
    for (let i = 0; i < 5; i++) {
      detectVfxEvents(emptySnapshot("BOSS_INTRO"), 100, 1, "BOSS_INTRO", "BOSS_INTRO", vfx, new Map(), new Map(), new Map(), 100, { x: 0, y: 0 });
    }
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("the very first frame ever drawn (prevPhase null) never fires the boss-entrance shake, even if it happens to start in BOSS_INTRO", () => {
    const vfx = new VfxManager();
    detectVfxEvents(emptySnapshot("BOSS_INTRO"), 100, 1, "BOSS_INTRO", null, vfx, new Map(), new Map(), new Map(), 100, { x: 0, y: 0 });
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("normal phases (RUNNING, WAVE_TRANSITION, VICTORY) never trigger shake on their own transitions", () => {
    const vfx = new VfxManager();
    const transitions: [RunPhase, RunPhase][] = [
      ["RUNNING", "WAVE_TRANSITION"],
      ["WAVE_TRANSITION", "RUNNING"],
      ["BOSS_BATTLE", "VICTORY"],
    ];
    for (const [prev, next] of transitions) {
      detectVfxEvents(emptySnapshot(next), 100, 1, next, prev, vfx, new Map(), new Map(), new Map(), 100, { x: 0, y: 0 });
    }
    expect(vfx.getShakeOffset()).toEqual({ x: 0, y: 0 });
  });
});

describe("CanvasRenderer.detectVfxEvents — Freeze SHATTER VFX (spec section 11/12)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fires SHATTER the instant a full freeze naturally expires (was frozen last frame, isn't anymore, still alive)", () => {
    const shatterSpy = vi.spyOn(VfxManager.prototype, "spawnFreezeShatter");
    const vfx = new VfxManager();
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.slow = null; // the freeze already expired via entities/Enemy.ts's real, time-based logic — this test only checks the VFX layer reacts correctly to that

    const prevEnemies = new Map([
      [enemy.id, { hp: enemy.hp, position: enemy.position, type: enemy.type, direction: enemy.direction, lastHitTimestamp: -Infinity, isBoss: false, wasFrozen: true }],
    ]);

    detectVfxEvents(
      { phase: "RUNNING", towers: [], enemies: [enemy], projectiles: [], selectedTowerId: null, biomeId: "ANCIENT_FOREST" },
      100,
      1,
      "RUNNING",
      "RUNNING",
      vfx,
      prevEnemies,
      new Map(),
      new Map(),
      100,
      { x: 0, y: 0 },
    );

    expect(shatterSpy).toHaveBeenCalledTimes(1);
    expect(shatterSpy).toHaveBeenCalledWith(enemy.position);
  });

  it("does NOT fire while still frozen (no change)", () => {
    const shatterSpy = vi.spyOn(VfxManager.prototype, "spawnFreezeShatter");
    const vfx = new VfxManager();
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.slow = { percent: 1, remainingMs: 500 }; // still fully frozen this frame too

    const prevEnemies = new Map([
      [enemy.id, { hp: enemy.hp, position: enemy.position, type: enemy.type, direction: enemy.direction, lastHitTimestamp: -Infinity, isBoss: false, wasFrozen: true }],
    ]);

    detectVfxEvents(
      { phase: "RUNNING", towers: [], enemies: [enemy], projectiles: [], selectedTowerId: null, biomeId: "ANCIENT_FOREST" },
      100,
      1,
      "RUNNING",
      "RUNNING",
      vfx,
      prevEnemies,
      new Map(),
      new Map(),
      100,
      { x: 0, y: 0 },
    );

    expect(shatterSpy).not.toHaveBeenCalled();
  });

  it("does NOT fire for an enemy that was never frozen", () => {
    const shatterSpy = vi.spyOn(VfxManager.prototype, "spawnFreezeShatter");
    const vfx = new VfxManager();
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.slow = null;

    const prevEnemies = new Map([
      [enemy.id, { hp: enemy.hp, position: enemy.position, type: enemy.type, direction: enemy.direction, lastHitTimestamp: -Infinity, isBoss: false, wasFrozen: false }],
    ]);

    detectVfxEvents(
      { phase: "RUNNING", towers: [], enemies: [enemy], projectiles: [], selectedTowerId: null, biomeId: "ANCIENT_FOREST" },
      100,
      1,
      "RUNNING",
      "RUNNING",
      vfx,
      prevEnemies,
      new Map(),
      new Map(),
      100,
      { x: 0, y: 0 },
    );

    expect(shatterSpy).not.toHaveBeenCalled();
  });

  it("a mere partial slow following a freeze (percent < 1) still counts as the freeze having ended, and fires SHATTER", () => {
    const shatterSpy = vi.spyOn(VfxManager.prototype, "spawnFreezeShatter");
    const vfx = new VfxManager();
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.slow = { percent: 0.35, remainingMs: 2000 }; // downgraded from full freeze to a normal partial slow

    const prevEnemies = new Map([
      [enemy.id, { hp: enemy.hp, position: enemy.position, type: enemy.type, direction: enemy.direction, lastHitTimestamp: -Infinity, isBoss: false, wasFrozen: true }],
    ]);

    detectVfxEvents(
      { phase: "RUNNING", towers: [], enemies: [enemy], projectiles: [], selectedTowerId: null, biomeId: "ANCIENT_FOREST" },
      100,
      1,
      "RUNNING",
      "RUNNING",
      vfx,
      prevEnemies,
      new Map(),
      new Map(),
      100,
      { x: 0, y: 0 },
    );

    expect(shatterSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire for an enemy that died while frozen (handled by the normal death-burst path instead)", () => {
    const shatterSpy = vi.spyOn(VfxManager.prototype, "spawnFreezeShatter");
    const vfx = new VfxManager();
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.hp = 0; // dead this frame

    const prevEnemies = new Map([
      [enemy.id, { hp: 5, position: enemy.position, type: enemy.type, direction: enemy.direction, lastHitTimestamp: -Infinity, isBoss: false, wasFrozen: true }],
    ]);

    // A dead enemy is removed from the engine's array the same tick — it's
    // no longer in `snapshot.enemies` at all, so it can't be double-VFX'd
    // by both the shatter branch AND the death-burst branch.
    detectVfxEvents(
      { phase: "RUNNING", towers: [], enemies: [], projectiles: [], selectedTowerId: null, biomeId: "ANCIENT_FOREST" },
      100,
      1,
      "RUNNING",
      "RUNNING",
      vfx,
      prevEnemies,
      new Map(),
      new Map(),
      100,
      { x: 0, y: 0 },
    );

    expect(shatterSpy).not.toHaveBeenCalled();
  });
});
