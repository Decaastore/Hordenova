import { describe, expect, it } from "vitest";
import { advanceEnemy, applySlow, createEnemyInstance, getEffectiveSpeed, isEnemyDead } from "./Enemy";

/**
 * Frostborn Freeze bug fix — see entities/Enemy.ts's applySlow doc
 * comment for the full root-cause writeup. Root cause: applySlow's
 * "weaker reapplication" branch used to extend the ACTIVE (stronger)
 * effect's remainingMs with `Math.max(remainingMs, durationMs)`, using the
 * weaker hit's own duration. Since a frozen enemy has 0 effective speed
 * and can never leave a tower's range, every later hit — freeze or not —
 * kept re-extending the freeze before it could naturally expire, so a
 * target frozen once next to an active tower never actually unfroze.
 * These tests exercise the fixed, deterministic, time-based expiry
 * directly on the entity layer (no rendering/setTimeout involved).
 */
describe("Freeze / Slow status effect (Frostborn)", () => {
  it("freezes on application (percent 1 = 0 effective speed) and unfreezes exactly when the duration elapses", () => {
    const enemy = createEnemyInstance("CRAWLER", 1);
    applySlow(enemy, 1, 1000);

    expect(enemy.slow).not.toBeNull();
    expect(getEffectiveSpeed(enemy)).toBe(0);

    advanceEnemy(enemy, 999);
    expect(enemy.slow).not.toBeNull(); // still frozen, 1ms left
    expect(getEffectiveSpeed(enemy)).toBe(0);

    advanceEnemy(enemy, 1);
    expect(enemy.slow).toBeNull(); // exactly expired
    expect(getEffectiveSpeed(enemy)).toBe(enemy.baseSpeed);
  });

  it("stays frozen for the full correct duration, not a tick early or a tick late", () => {
    const enemy = createEnemyInstance("CRAWLER", 1);
    applySlow(enemy, 1, 500);

    for (let elapsed = 0; elapsed < 480; elapsed += 20) {
      advanceEnemy(enemy, 20);
      expect(enemy.slow, `should still be frozen at ${elapsed + 20}ms`).not.toBeNull();
    }
    advanceEnemy(enemy, 20); // crosses 500ms
    expect(enemy.slow).toBeNull();
  });

  it("REGRESSION: a weaker slow landing on an already-frozen target never re-extends the freeze (the permanent-freeze bug)", () => {
    const enemy = createEnemyInstance("CRAWLER", 1);
    applySlow(enemy, 1, 900); // Deep Freeze-style full freeze

    // Simulate a Frostborn tower that keeps re-hitting the target it just
    // froze (it can't flee at 0 speed) with its NORMAL partial slow —
    // e.g. attacking every 300ms with a 2000ms partial-slow duration, far
    // longer than what remains of the freeze. Before the fix this
    // continuously refreshed remainingMs via Math.max(remaining, 2000)
    // and the freeze never expired. Every weaker hit here lands strictly
    // BEFORE the freeze's own natural expiry (300ms, 600ms — never 900ms)
    // so this isolates "does a weaker hit extend an active freeze" from
    // "a fresh hit landing after the freeze already expired is legitimate".
    advanceEnemy(enemy, 300); // 600ms of the freeze remain
    applySlow(enemy, 0.35, 2000); // weaker than the active freeze — must be a no-op
    expect(enemy.slow!.percent).toBe(1); // still frozen, not downgraded
    expect(enemy.slow!.remainingMs).toBeLessThanOrEqual(600); // not extended past what naturally remained

    advanceEnemy(enemy, 300); // 300ms of the freeze remain
    applySlow(enemy, 0.35, 2000); // weaker again — still a no-op
    expect(enemy.slow!.percent).toBe(1);
    expect(enemy.slow!.remainingMs).toBeLessThanOrEqual(300);

    // The freeze must still expire on its ORIGINAL schedule (900ms total),
    // regardless of how many weaker hits landed during that window.
    advanceEnemy(enemy, 300);
    expect(enemy.slow).toBeNull();
    expect(getEffectiveSpeed(enemy)).toBe(enemy.baseSpeed);
  });

  it("a same-or-stronger reapplication during an active freeze correctly renews/replaces the duration", () => {
    const enemy = createEnemyInstance("CRAWLER", 1);
    applySlow(enemy, 1, 500);
    advanceEnemy(enemy, 400); // 100ms remaining

    applySlow(enemy, 1, 500); // a fresh freeze proc — should reset to a full 500ms
    advanceEnemy(enemy, 400);
    expect(enemy.slow).not.toBeNull(); // would have expired under the OLD 100ms remainder, but was renewed
    advanceEnemy(enemy, 100);
    expect(enemy.slow).toBeNull();
  });

  it("dying while frozen leaves no residual state — hp<=0 and slow can coexist safely, and the effect is simply discarded with the enemy", () => {
    const enemy = createEnemyInstance("CRAWLER", 1);
    applySlow(enemy, 1, 5000);
    enemy.hp = 0;

    expect(isEnemyDead(enemy)).toBe(true);
    // advanceEnemy must not throw or behave oddly on a dead-but-still-frozen enemy
    // (GameEngine removes dead enemies from its array the same tick, but the
    // entity layer itself must stay well-defined regardless).
    expect(() => advanceEnemy(enemy, 100)).not.toThrow();
    expect(isEnemyDead(enemy)).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity, 0, -100, undefined as unknown as number])(
    "an invalid duration (%s) never creates a freeze/slow at all",
    (invalidDuration) => {
      const enemy = createEnemyInstance("CRAWLER", 1);
      applySlow(enemy, 1, invalidDuration);
      expect(enemy.slow).toBeNull();
    },
  );

  it("an invalid duration also can't corrupt an ALREADY active freeze into a permanent one", () => {
    const enemy = createEnemyInstance("CRAWLER", 1);
    applySlow(enemy, 1, 500);
    applySlow(enemy, 1, NaN); // a corrupted follow-up application
    applySlow(enemy, 1, Infinity);

    advanceEnemy(enemy, 500);
    expect(enemy.slow).toBeNull();
  });

  it("expires correctly under a single large, irregular tick (simulating a laggy/uneven loop — e.g. right after a backgrounded tab regains focus)", () => {
    const enemy = createEnemyInstance("CRAWLER", 1);
    applySlow(enemy, 1, 1000);

    // One big catch-up tick, far larger than the remaining freeze duration —
    // the real GameLoop clamps a single frame to 100ms (see engine/GameLoop.ts),
    // but many such ticks accumulate the same way; what matters is that the
    // status effect is purely time-based (remainingMs -= dtMs), never
    // frame-count-based, so it releases the instant enough simulated time
    // has passed, in exactly one decrement.
    advanceEnemy(enemy, 5000);
    expect(enemy.slow).toBeNull();
    expect(getEffectiveSpeed(enemy)).toBe(enemy.baseSpeed);
  });

  it("property check: no sequence of applications and ticks ever leaves an enemy permanently frozen", () => {
    const enemy = createEnemyInstance("CRAWLER", 1);
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    // A chaotic mix of freezes, partial slows, and irregular tick sizes —
    // reapplied far more often than any single duration used below (max
    // 1500ms) — for a long stretch of simulated time.
    let simulatedMs = 0;
    const HORIZON_MS = 60_000;
    while (simulatedMs < HORIZON_MS) {
      const dt = 20 + Math.floor(rand() * 200);
      advanceEnemy(enemy, dt);
      simulatedMs += dt;
      if (rand() < 0.5) {
        const percent = rand() < 0.4 ? 1 : rand() * 0.8;
        applySlow(enemy, percent, 200 + rand() * 1300);
      }
    }

    // Applications stop here; nothing further can refresh the effect, so
    // it must fully clear within, at most, the largest duration used above.
    advanceEnemy(enemy, 1500);
    expect(enemy.slow).toBeNull();
  });
});
