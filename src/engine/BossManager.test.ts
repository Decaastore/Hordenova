import { describe, expect, it } from "vitest";
import { createBossInstance, tickBossAbilities, tickBossSiege } from "./BossManager";
import { MAIN_BOSSES, MINI_BOSSES } from "@/config/bossConfig";
import { createTowerInstance } from "@/entities/Tower";
import { SIEGE_TELEGRAPH_MS } from "@/config/bossSiege";

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

  describe("Boss Siege Attack (Master Implementation Pass spec section 13)", () => {
    it("a main boss has siege enabled; a mini-boss does not (scoped to main bosses only)", () => {
      const main = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 10, NOW);
      const mini = createBossInstance(MINI_BOSSES["ashfen-warlord"]!, 10, NOW);
      expect(main.boss!.nextSiegeAtMs).not.toBeNull();
      expect(mini.boss!.nextSiegeAtMs).toBeNull();
    });

    it("mini-boss siege ticking is always a no-op", () => {
      const mini = createBossInstance(MINI_BOSSES["ashfen-warlord"]!, 10, NOW);
      const tower = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 });
      mini.position = { x: 0, y: 0 };
      expect(tickBossSiege(mini, NOW + 999_999, 100, [tower])).toBeNull();
    });

    it("in range: telegraphs first (no immediate hit), then resolves after SIEGE_TELEGRAPH_MS", () => {
      const boss = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 10, NOW);
      boss.position = { x: 0, y: 0 };
      const nearTower = createTowerInstance("slot-near", "IRONWOOD", { x: 10, y: 0 });

      const atDecision = tickBossSiege(boss, boss.boss!.nextSiegeAtMs!, 100, [nearTower]);
      expect(atDecision).toBeNull(); // telegraph just started, no hit yet
      expect(boss.boss!.siegeTargetTowerId).toBe(nearTower.id);
      expect(boss.boss!.siegeTelegraphRemainingMs).toBeGreaterThan(0);

      // Not yet expired.
      expect(tickBossSiege(boss, boss.boss!.nextSiegeAtMs!, SIEGE_TELEGRAPH_MS - 100, [nearTower])).toBeNull();

      // Expires now — the hit resolves.
      const hit = tickBossSiege(boss, boss.boss!.nextSiegeAtMs!, 200, [nearTower]);
      expect(hit).not.toBeNull();
      expect(hit!.targetTowerId).toBe(nearTower.id);
      expect(hit!.rawDamage).toBeCloseTo(nearTower.maxHp * 0.4, 5);
    });

    it("out of range: never telegraphs, never hits", () => {
      const boss = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 10, NOW);
      boss.position = { x: 0, y: 0 };
      const farTower = createTowerInstance("slot-far", "IRONWOOD", { x: 5000, y: 0 });

      tickBossSiege(boss, boss.boss!.nextSiegeAtMs!, 100, [farTower]);
      expect(boss.boss!.siegeTargetTowerId).toBeNull();
    });

    it("with no tower in range, the interval still re-arms for a future attempt", () => {
      const boss = createBossInstance(MAIN_BOSSES["hollow-warden"]!, 10, NOW);
      const originalNextAt = boss.boss!.nextSiegeAtMs!;
      tickBossSiege(boss, originalNextAt, 100, []);
      expect(boss.boss!.nextSiegeAtMs).toBeGreaterThan(originalNextAt);
    });
  });
});
