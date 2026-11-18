import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { createEnemyInstance, type EnemyInstance } from "@/entities/Enemy";
import { garrisonUpgradeCost, GARRISON_STUN_MS } from "@/config/garrison";
import { loadSave } from "./SaveSystem";

type Internals = { enemies: EnemyInstance[]; layout: { length: number }; garrisonLevel: number; gold: number; tickGarrison: (dt: number) => void; garrisonStunMs: number };

function nearGate(e: EnemyInstance, internals: Internals): EnemyInstance {
  e.distanceTraveled = internals.layout.length - 40;
  return e;
}

describe("Garrison (castle soldiers vs bosses only)", () => {
  beforeEach(() => window.localStorage.clear());

  it("upgrades with gold and is saved on the castle", () => {
    const engine = new GameEngine();
    engine.startRun();
    const i = engine as unknown as Internals;
    i.gold = 100000;
    expect(engine.upgradeGarrison()).toBe(true);
    expect(i.gold).toBe(100000 - garrisonUpgradeCost(0)!);
    expect(engine.getHudSnapshot().garrison?.level).toBe(1);
    expect(loadSave().garrisonLevel).toBe(1);
  });

  it("never shoots the ordinary horde, only bosses near the gate", () => {
    const engine = new GameEngine();
    engine.startRun();
    const i = engine as unknown as Internals;
    i.garrisonLevel = 10;
    const grunt = nearGate(createEnemyInstance("BRUTE", 50), i);
    const boss = nearGate(createEnemyInstance("BRUTE", 50), i);
    boss.boss = { bossId: "hollow-warden", nameKey: "HOLLOW_WARDEN", isMainBoss: true, ability: "NONE", abilityIntervalMs: 6000, baseDamageReduction: 0, shieldUntilMs: null, nextAbilityAtMs: 0, enraged: false } as EnemyInstance["boss"];
    boss.damageReduction = 0;
    i.enemies = [grunt, boss];
    const gruntHp = grunt.hp;
    const bossHp = boss.hp;
    i.tickGarrison(1000);
    expect(grunt.hp).toBe(gruntHp);
    expect(boss.hp).toBeLessThan(bossHp);
  });

  it("a boss blow knocks the soldiers down for a while", () => {
    const engine = new GameEngine();
    engine.startRun();
    const i = engine as unknown as Internals;
    i.garrisonLevel = 5;
    const boss = nearGate(createEnemyInstance("BRUTE", 50), i);
    boss.boss = { bossId: "ashfen-warlord", nameKey: "ASHFEN_WARLORD", isMainBoss: false, ability: "NONE", abilityIntervalMs: 6000, baseDamageReduction: 0, shieldUntilMs: null, nextAbilityAtMs: 0, enraged: false } as EnemyInstance["boss"];
    i.enemies = [boss];
    i.garrisonStunMs = GARRISON_STUN_MS;
    const hp = boss.hp;
    i.tickGarrison(500);
    expect(boss.hp).toBe(hp);
  });
});
