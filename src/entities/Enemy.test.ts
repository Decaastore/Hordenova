import { describe, expect, it } from "vitest";
import { advanceEnemy, applyDamageToEnemy, applySlow, createEnemyInstance, createEliteEnemyInstance, getEffectiveSpeed, isEnemyDead, REGEN_SUPPRESSION_MS } from "./Enemy";
import { createBossInstance } from "@/engine/BossManager";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";
import { CC_DR_DECAY_MS } from "@/config/ccResistance";

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

/**
 * AUDITORIA E CORREÇÃO GERAL spec sections 23-28 — the REAL, still-live
 * cause of "a boss gets permanently stuck": a Frostborn tower landing a
 * SAME-OR-STRONGER freeze (a fresh 100% freeze on an already-100%-frozen
 * target) legitimately renews the timer to full (see the "same-or-stronger
 * reapplication... correctly renews" test above — that's intended, NOT a
 * bug). Against a normal enemy this is harmless because the enemy is a
 * one-off individual; against a BOSS being repeatedly hit while stuck at 0
 * speed in range, a high enough freeze chance means this can refresh
 * indefinitely in practice. These tests prove the fix: CC resistance +
 * diminishing returns (config/ccResistance.ts) guarantee a Boss/Mini-Boss/
 * Elite ALWAYS resumes moving, no matter how many same-or-stronger freezes
 * land back-to-back — while a plain (NORMAL-tier) enemy is completely
 * unaffected, preserving every test above unchanged.
 */
describe("CC resistance + diminishing returns (AUDITORIA E CORREÇÃO GERAL spec sections 23-28)", () => {
  const ELITE_MODIFIER = { hpMultiplier: 1.5, speedMultiplier: 1, damageMultiplier: 1.5, rewardMultiplier: 2, regenPercentPerSecond: 0 };

  it("THE BUG, reproduced and fixed: a Boss hit with a constant 100% freeze chance every 100ms is NEVER stuck forever — it eventually resumes moving", () => {
    const boss = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 30, 0);
    expect(boss.boss?.isMainBoss).toBe(true);

    // Simulate a Frostborn tower landing a full (percent=1) freeze on this
    // exact same boss every 100ms, forever — the worst realistic case (a
    // 100% freeze chance, an attack interval far shorter than the freeze
    // duration itself) that would have produced a truly permanent freeze
    // under the pre-fix logic (every hit is same-or-stronger, so it always
    // legitimately renews... unless resistance eventually refuses it).
    let everMovedAgain = false;
    for (let t = 0; t < 20_000; t += 100) {
      applySlow(boss, 1, 2200); // Frostborn's real freezeDurationMs
      advanceEnemy(boss, 100);
      if (getEffectiveSpeed(boss) > 0) {
        everMovedAgain = true;
        break;
      }
    }
    expect(everMovedAgain).toBe(true);
  });

  it("a NORMAL-tier enemy (no boss/elite tag) is completely unaffected by CC resistance — every existing freeze test above stays valid", () => {
    const enemy = createEnemyInstance("CRAWLER", 1);
    applySlow(enemy, 1, 1000);
    expect(enemy.slow!.remainingMs).toBe(1000); // full duration, no reduction
    expect(enemy.ccResistanceStacks).toBe(0); // never tracked for NORMAL tier
  });

  it("an ELITE enemy's first freeze is already reduced by its tier's baseline resistance", () => {
    const elite = createEliteEnemyInstance("CRAWLER", 1, ELITE_MODIFIER);
    applySlow(elite, 1, 1000);
    expect(elite.slow!.remainingMs).toBeLessThan(1000);
    expect(elite.slow!.remainingMs).toBeGreaterThan(0);
  });

  it("repeated freezes on the same Boss apply strictly shrinking durations, then stop extending the timer at all once fully resisted", () => {
    const boss = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 30, 0);
    // Freshly-APPLIED duration (read immediately, before any tick) at each
    // successive hit — must strictly shrink as the stack climbs.
    const appliedDurations: number[] = [];
    for (let i = 0; i < 3; i++) {
      applySlow(boss, 1, 2000);
      appliedDurations.push(boss.slow!.remainingMs);
    }
    for (let i = 1; i < appliedDurations.length; i++) {
      expect(appliedDurations[i]).toBeLessThan(appliedDurations[i - 1]!);
    }
    expect(boss.ccResistanceStacks).toBe(3); // capped

    // Once fully resisted, a further "freeze" attempt must be a genuine
    // no-op — it neither extends nor otherwise touches the already-ticking
    // timer; the boss's remaining freeze just keeps counting down exactly
    // as if the attempt never happened (the real fix: no infinite refresh).
    const remainingBeforeResistedHit = boss.slow!.remainingMs;
    applySlow(boss, 1, 2000); // fully resisted (stack already at cap)
    expect(boss.slow!.remainingMs).toBe(remainingBeforeResistedHit); // untouched
    advanceEnemy(boss, remainingBeforeResistedHit);
    expect(boss.slow).toBeNull(); // and it still expires on schedule
  });

  it("resistance decays back to baseline after CC_DR_DECAY_MS without any further hit", () => {
    const boss = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 30, 0);
    applySlow(boss, 1, 100); // first hit — reaches stack 1
    applySlow(boss, 1, 100); // second hit — reaches stack 2
    expect(boss.ccResistanceStacks).toBe(2);

    advanceEnemy(boss, CC_DR_DECAY_MS + 10);
    expect(boss.ccResistanceStacks).toBe(1); // decayed by exactly one stack

    advanceEnemy(boss, CC_DR_DECAY_MS + 10);
    expect(boss.ccResistanceStacks).toBe(0); // fully recovered
  });

  it("a Mini-Boss has non-zero but less severe resistance than a Main Boss (a real hierarchy)", () => {
    const mainBoss = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 30, 0);
    const miniBoss = createBossInstance(MINI_BOSSES["ashfen-warlord"]!, 10, 0);

    applySlow(mainBoss, 1, 1000);
    applySlow(miniBoss, 1, 1000);
    expect(mainBoss.slow!.remainingMs).toBeLessThan(miniBoss.slow!.remainingMs);
  });

  it("BUG 6 (AUDITORIA spec sections 39-49): the 'stuck blue enemy' report — EntityRenderer draws a light-blue ring around ANY enemy with an active `slow`/freeze effect (see EntityRenderer.ts's `if (enemy.slow)` ring), regardless of the enemy's own archetype color. A permanently-refreshed freeze (Bug 3, already fixed above) is therefore indistinguishable, visually, from 'a distinct blue-colored enemy frozen on the path forever' — this test proves the actual path/movement layer is sound: under the exact worst-case constant-refreeze pressure that used to never release, distanceTraveled still keeps climbing over a long simulated battle and the enemy genuinely reaches the end of the path in finite time, never soft-locked.", () => {
    const boss = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 30, 0);
    let reachedEnd = false;
    for (let t = 0; t < 300_000 && !reachedEnd; t += 100) {
      applySlow(boss, 1, 2200); // constant worst-case re-freeze pressure, every single tick
      const result = advanceEnemy(boss, 100);
      if (result.reachedEnd) reachedEnd = true;
    }
    expect(reachedEnd).toBe(true);
  });
});

/**
 * P0 root-cause fix: mini-boss HP "stuck at ~4420" report. Root cause
 * confirmed via a corrected single-instance-tracked simulation (see
 * Enemy.ts's REGEN_SUPPRESSION_MS doc comment): passive regen used to apply
 * unconditionally every tick, so a REGENERATOR-archetype mini-boss
 * (mossback-regenerator, regenPercentPerSecond 0.02) under weak-enough
 * sustained DPS could have its HP climb to and then permanently pin at
 * exactly maxHp — a real, mathematically-guaranteed stalemate, NOT a
 * display/caching/stale-reference bug (those were all directly ruled out
 * by reading getRenderSnapshot/CanvasRenderer/CombatSystem — no caching,
 * no React-state involvement, no copy-instead-of-reference passing).
 * These tests exercise the entity layer directly (real `enemy.hp` mutation
 * via the real applyDamageToEnemy/advanceEnemy functions), not a fake or
 * a rendering mock — proving both the bug's old mechanism and the fix.
 */
describe("Regen suppression window (P0 fix: mini-boss HP appearing stuck at maxHp)", () => {
  it("a fresh mini-boss with regen can still passively heal when truly undamaged (the mechanic itself is NOT removed)", () => {
    const boss = createBossInstance(MINI_BOSSES["mossback-regenerator"]!, 13, 0);
    expect(boss.regenPerSecond).toBeGreaterThan(0);
    boss.hp = boss.maxHp - 100;
    advanceEnemy(boss, 1000);
    expect(boss.hp).toBeGreaterThan(boss.maxHp - 100); // regenerated — undamaged, nothing to suppress
  });

  it("regen is suppressed immediately after taking direct damage", () => {
    const boss = createBossInstance(MINI_BOSSES["mossback-regenerator"]!, 13, 0);
    boss.hp = boss.maxHp - 500;
    applyDamageToEnemy(boss, 1); // any real hit resets the suppression window
    const hpAfterHit = boss.hp;
    advanceEnemy(boss, 1000); // well within the suppression window
    expect(boss.hp).toBe(hpAfterHit); // must NOT have regenerated yet
  });

  it("regen is suppressed immediately after taking burn-tick damage", () => {
    const boss = createBossInstance(MINI_BOSSES["mossback-regenerator"]!, 13, 0);
    boss.hp = boss.maxHp - 500;
    boss.burn = { damagePerSecond: 10, remainingMs: 100, stacks: 1 };
    const beforeTick = boss.hp;
    advanceEnemy(boss, 100); // burn tick fires and expires this same tick
    expect(boss.hp).toBeLessThan(beforeTick); // burn damage applied
    expect(boss.burn).toBeNull();
    const afterBurnTick = boss.hp;
    advanceEnemy(boss, 500); // still well within the suppression window, no more burn
    expect(boss.hp).toBe(afterBurnTick); // no regen crept in during the suppressed window
  });

  it("regen resumes once the suppression window fully elapses without further damage", () => {
    const boss = createBossInstance(MINI_BOSSES["mossback-regenerator"]!, 13, 0);
    boss.hp = boss.maxHp - 500;
    applyDamageToEnemy(boss, 1);
    const hpRightAfterHit = boss.hp;
    advanceEnemy(boss, REGEN_SUPPRESSION_MS); // counter reaches the threshold; still gated THIS tick (checked pre-increment)
    expect(boss.hp).toBe(hpRightAfterHit);
    advanceEnemy(boss, 100); // counter now exceeds the threshold going into this tick — regen resumes
    expect(boss.hp).toBeGreaterThan(hpRightAfterHit);
  });

  it("THE BUG, reproduced and fixed: sustained fire that used to permanently pin HP at exactly maxHp now keeps grinding HP down instead", () => {
    const boss = createBossInstance(MINI_BOSSES["mossback-regenerator"]!, 13, 0);
    // A hit landing more often than REGEN_SUPPRESSION_MS, with damage-per-hit
    // far below the regen's absolute per-tick rate — the exact worst-case
    // "weak but real" pressure that used to be fully cancelled out forever.
    const hitIntervalMs = 500;
    let msSinceHit = 0;
    let minHpSeen = boss.hp;
    for (let t = 0; t < 60_000; t += 100) {
      advanceEnemy(boss, 100);
      msSinceHit += 100;
      if (msSinceHit >= hitIntervalMs) {
        applyDamageToEnemy(boss, 1); // tiny hit, way under the regen's own healing rate
        msSinceHit = 0;
      }
      minHpSeen = Math.min(minHpSeen, boss.hp);
      if (boss.hp <= 0) break;
    }
    // Under the OLD (buggy) code this would climb to and permanently sit at
    // exactly boss.maxHp. Under the fix, since every hit lands well within
    // the suppression window, regen never gets a chance to fire at all.
    expect(boss.hp).toBeLessThan(boss.maxHp);
    expect(minHpSeen).toBeLessThan(boss.maxHp);
  });

  it("multiple hits keep reducing HP — it never bounces back up to a prior higher value without a legitimate un-suppressed regen tick", () => {
    const boss = createBossInstance(MINI_BOSSES["mossback-regenerator"]!, 13, 0);
    let lastHp = boss.hp;
    for (let i = 0; i < 20; i++) {
      applyDamageToEnemy(boss, 50);
      expect(boss.hp).toBeLessThanOrEqual(lastHp); // never increases from a hit
      lastHp = boss.hp;
      advanceEnemy(boss, 100); // well within suppression window after each hit
      expect(boss.hp).toBeLessThanOrEqual(lastHp); // and ticking forward doesn't sneak in a heal either
      lastHp = boss.hp;
    }
    expect(boss.hp).toBeLessThan(boss.maxHp);
  });

  it("a mini-boss with regen can still die under sustained real damage — no infinite stalemate is possible", () => {
    const boss = createBossInstance(MINI_BOSSES["mossback-regenerator"]!, 13, 0);
    let ticks = 0;
    while (boss.hp > 0 && ticks < 100_000) {
      advanceEnemy(boss, 50);
      applyDamageToEnemy(boss, 20); // sustained fire every tick, dwarfing the regen rate
      ticks += 1;
    }
    expect(boss.hp).toBe(0);
    expect(isEnemyDead(boss)).toBe(true);
  });

  it("the HP bar's source of truth is the real enemy.hp/maxHp — no independent cached copy exists on the instance", () => {
    const boss = createBossInstance(MINI_BOSSES["mossback-regenerator"]!, 13, 0);
    const hpBefore = boss.hp;
    applyDamageToEnemy(boss, 300);
    // Exactly one hp field, exactly one maxHp field — nothing else on the
    // instance could visually diverge from this real, mutated value.
    expect(boss.hp).toBe(hpBefore - 300 * (1 - boss.damageReduction));
    expect(Object.keys(boss).filter((k) => k.toLowerCase().includes("hp"))).toEqual(
      expect.arrayContaining(["hp", "maxHp"]),
    );
  });
});
