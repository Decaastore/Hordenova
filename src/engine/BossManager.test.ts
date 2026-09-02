import { describe, expect, it } from "vitest";
import { createBossInstance, tickBossAbilities } from "./BossManager";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";
import { createTowerInstance } from "@/entities/Tower";

const NOW = 100_000;

describe("BossManager", () => {
  it("createBossInstance bakes the definition's resistance into damageReduction", () => {
    const boss = createBossInstance(MINI_BOSSES["ashfen-warlord"]!, 10, NOW);
    expect(boss.damageReduction).toBe(0.15);
    expect(boss.boss!.baseDamageReduction).toBe(0.15);
  });

  it("SHIELD ability grants a temporary near-invulnerability window that expires", () => {
    const boss = createBossInstance(MINI_BOSSES["ashfen-warlord"]!, 10, NOW);
    tickBossAbilities(boss, boss.boss!.nextAbilityAtMs, 10, []);
    expect(boss.damageReduction).toBeCloseTo(0.85);

    tickBossAbilities(boss, boss.boss!.shieldUntilMs! + 1, 10, []);
    expect(boss.damageReduction).toBe(0.15);
  });

  it("SUMMON ability spawns reinforcements", () => {
    const boss = createBossInstance(MINI_BOSSES["briar-summoner"]!, 10, NOW);
    const summons = tickBossAbilities(boss, boss.boss!.nextAbilityAtMs, 10, []);
    expect(summons.length).toBeGreaterThan(0);
  });

  it("DISABLE ability jams the nearest tower", () => {
    const boss = createBossInstance(MINI_BOSSES["gloom-jammer"]!, 10, NOW);
    boss.position = { x: 0, y: 0 };
    const nearTower = createTowerInstance("slot-near", "IRONWOOD", { x: 10, y: 0 });
    const farTower = createTowerInstance("slot-far", "IRONWOOD", { x: 5000, y: 0 });

    tickBossAbilities(boss, boss.boss!.nextAbilityAtMs, 10, [nearTower, farTower]);

    expect(nearTower.disabledRemainingMs).toBeGreaterThan(0);
    expect(farTower.disabledRemainingMs).toBe(0);
  });

  it("REGEN mini-bosses heal passively via regenPerSecond rather than an ability tick", () => {
    const boss = createBossInstance(MINI_BOSSES["mossback-regenerator"]!, 10, NOW);
    expect(boss.regenPerSecond).toBeGreaterThan(0);
  });

  it("Every main boss enrages below 30% HP (a second phase for free)", () => {
    const boss = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 30, NOW);
    const speedBefore = boss.baseSpeed;
    boss.hp = boss.maxHp * 0.29;

    tickBossAbilities(boss, boss.boss!.nextAbilityAtMs, 30, []);

    expect(boss.boss!.enraged).toBe(true);
    expect(boss.baseSpeed).toBeGreaterThan(speedBefore);
  });

  it("A mini-boss WITHOUT the Berserker ability does not enrage, even at low HP", () => {
    const boss = createBossInstance(MINI_BOSSES["ashfen-warlord"]!, 10, NOW);
    const speedBefore = boss.baseSpeed;
    boss.hp = boss.maxHp * 0.1;

    tickBossAbilities(boss, boss.boss!.nextAbilityAtMs, 10, []);

    expect(boss.boss!.enraged).toBe(false);
    expect(boss.baseSpeed).toBe(speedBefore);
  });

  it("A Berserker mini-boss DOES enrage at low HP, same as a main boss", () => {
    const boss = createBossInstance(MINI_BOSSES["ferocious-berserker"]!, 10, NOW);
    const speedBefore = boss.baseSpeed;
    boss.hp = boss.maxHp * 0.1;

    tickBossAbilities(boss, boss.boss!.nextAbilityAtMs, 10, []);

    expect(boss.boss!.enraged).toBe(true);
    expect(boss.baseSpeed).toBeGreaterThan(speedBefore);
  });
});
