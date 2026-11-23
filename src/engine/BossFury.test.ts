import { describe, expect, it } from "vitest";
import { createBossInstance, tickBossFury } from "./BossManager";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";
import { BARRIER, MINI_HARDEN, ROAR, ROAR_IMMUNITY_MS } from "@/config/bossFury";
import { createTowerInstance, tickTowerCooldown, isTowerReadyToAttack } from "@/entities/Tower";

const at = (boss: ReturnType<typeof createBossInstance>) => boss.position;
function towersAround(boss: ReturnType<typeof createBossInstance>, n: number, d: number) {
  return Array.from({ length: n }, (_, i) => createTowerInstance(`t${i}`, "IRONWOOD", { x: at(boss).x + d + i, y: at(boss).y }));
}

describe("BOSS FURY — stun roar", () => {
  it("a main boss winds up (readable warning), then stuns the nearest towers in range — capped, and only after the wind-up", () => {
    const boss = createBossInstance(Object.values(MAIN_BOSSES)[0]!, 30, 0);
    const near = towersAround(boss, 6, 50);
    const far = createTowerInstance("far", "IRONWOOD", { x: at(boss).x + ROAR.main.radius + 60, y: at(boss).y });
    const towers = [...near, far];
    expect(tickBossFury(boss, ROAR.main.firstMs - 1, 16, 30, towers).roarWindup).toBe(false);
    expect(tickBossFury(boss, ROAR.main.firstMs, 16, 30, towers).roarWindup).toBe(true);
    // nothing is stunned during the wind-up
    tickBossFury(boss, ROAR.main.firstMs + 500, 500, 30, towers);
    expect(towers.every((t) => t.disabledRemainingMs === 0)).toBe(true);
    const ev = tickBossFury(boss, ROAR.main.firstMs + ROAR.main.telegraphMs, ROAR.main.telegraphMs, 30, towers);
    expect(ev.roarStunned).toHaveLength(ROAR.main.maxTowers);
    expect(far.disabledRemainingMs).toBe(0);
    const hit = towers.filter((t) => t.disabledRemainingMs > 0);
    expect(hit).toHaveLength(ROAR.main.maxTowers);
    for (const t of hit) {
      expect(isTowerReadyToAttack(t)).toBe(false);
      expect(t.roarStunMs).toBe(ROAR.main.stunMs);
    }
  });

  it("no stun-lock: a tower just stunned is immune to the next roar, then the stun wears off", () => {
    const boss = createBossInstance(Object.values(MINI_BOSSES)[0]!, 20, 0);
    const [tower] = towersAround(boss, 1, 40);
    const t0 = ROAR.mini.firstMs;
    tickBossFury(boss, t0, 16, 20, [tower!]);
    tickBossFury(boss, t0 + ROAR.mini.telegraphMs, ROAR.mini.telegraphMs, 20, [tower!]);
    expect(tower!.disabledRemainingMs).toBe(ROAR.mini.stunMs);
    expect(tower!.roarImmuneMs).toBe(ROAR.mini.stunMs + ROAR_IMMUNITY_MS);
    tickTowerCooldown(tower!, ROAR.mini.stunMs);
    expect(isTowerReadyToAttack(tower!)).toBe(true);
    // force an immediate second roar while still immune: it hits nothing
    boss.boss!.nextRoarAtMs = 0;
    tickBossFury(boss, t0 + 5000, 16, 20, [tower!]);
    const ev = tickBossFury(boss, t0 + 5000 + ROAR.mini.telegraphMs, ROAR.mini.telegraphMs, 20, [tower!]);
    expect(ev.roarStunned).toEqual([]);
  });
});

describe("BOSS FURY — barrier and harden", () => {
  it("a main boss raises its barrier once at the threshold: near-unhittable for a moment, calls guards, roars; then drops back", () => {
    const boss = createBossInstance(Object.values(MAIN_BOSSES)[0]!, 30, 0);
    const base = boss.damageReduction;
    boss.hp = boss.maxHp * (BARRIER.hpFraction - 0.01);
    const ev = tickBossFury(boss, 1000, 16, 30, []);
    expect(ev.barrierUp).toBe(true);
    expect(ev.summons).toHaveLength(BARRIER.guards);
    expect(boss.damageReduction).toBeGreaterThanOrEqual(BARRIER.damageReduction);
    expect(boss.boss!.nextRoarAtMs).toBe(1000);
    tickBossFury(boss, 1000 + BARRIER.durationMs, 16, 30, []);
    expect(boss.boss!.barrierUntilMs).toBeNull();
    expect(boss.damageReduction).toBe(base);
    boss.hp = boss.maxHp * 0.2;
    expect(tickBossFury(boss, 9000, 16, 30, []).barrierUp).toBe(false);
  });

  it("a mini-boss hardens at half HP (no guards)", () => {
    const boss = createBossInstance(Object.values(MINI_BOSSES)[0]!, 20, 0);
    boss.hp = boss.maxHp * (MINI_HARDEN.hpFraction - 0.01);
    const ev = tickBossFury(boss, 500, 16, 20, []);
    expect(ev.barrierUp).toBe(true);
    expect(ev.summons).toHaveLength(0);
    expect(boss.damageReduction).toBeGreaterThanOrEqual(MINI_HARDEN.damageReduction);
  });
});
