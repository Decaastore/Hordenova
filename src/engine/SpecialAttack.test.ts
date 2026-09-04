import { describe, expect, it, vi, afterEach } from "vitest";
import { tickCombat } from "./CombatSystem";
import { createTowerInstance, isTowerReadyForSpecial, isTowerReadyToAttack } from "@/entities/Tower";
import { createEnemyInstance } from "@/entities/Enemy";
import { SPECIAL_ATTACK_COOLDOWN_MS } from "@/config/towerSpecials";
import { TOWER_TYPES } from "@/config/towerStats";

describe("Special Attack system (Master Implementation spec section 26-28)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a freshly-built tower's special is NOT ready immediately — it must charge up first", () => {
    for (const type of TOWER_TYPES) {
      const tower = createTowerInstance("slot-test", type, { x: 0, y: 0 });
      expect(isTowerReadyForSpecial(tower)).toBe(false);
      expect(tower.specialCooldownRemainingMs).toBe(SPECIAL_ATTACK_COOLDOWN_MS[type]);
    }
  });

  it("the normal attack is still ready immediately on a fresh tower — the special's charge-up doesn't delay it", () => {
    const tower = createTowerInstance("slot-test", "IRONWOOD", { x: 0, y: 0 });
    expect(isTowerReadyToAttack(tower)).toBe(true);
  });

  it.each(TOWER_TYPES)("a %s's special fires exactly once it finishes charging, dealing extra damage beyond the normal attack alone", (type) => {
    const withSpecial = createTowerInstance("slot-a", type, { x: 0, y: 0 });
    const withoutSpecial = createTowerInstance("slot-b", type, { x: 0, y: 0 });
    // Force the special ready immediately on one tower only, to isolate its contribution.
    withSpecial.specialCooldownRemainingMs = 0;
    withoutSpecial.specialCooldownRemainingMs = SPECIAL_ATTACK_COOLDOWN_MS[type];

    const targetA = createEnemyInstance("BRUTE", 1); // high HP so neither dies mid-comparison
    targetA.position = { x: 20, y: 0 };
    const targetB = createEnemyInstance("BRUTE", 1);
    targetB.position = { x: 20, y: 0 };

    tickCombat([withSpecial], [targetA], 50);
    tickCombat([withoutSpecial], [targetB], 50);

    const damageWithSpecial = targetA.maxHp - targetA.hp;
    const damageWithoutSpecial = targetB.maxHp - targetB.hp;
    expect(damageWithSpecial).toBeGreaterThan(damageWithoutSpecial);
  });

  it("firing the special resets ONLY the special cooldown, never the normal attack's own cooldown", () => {
    const tower = createTowerInstance("slot-test", "STORMCALLER", { x: 0, y: 0 });
    tower.specialCooldownRemainingMs = 0;
    tower.cooldownRemainingMs = 400; // normal attack mid-cooldown, not ready

    const target = createEnemyInstance("CRAWLER", 1);
    target.position = { x: 20, y: 0 };

    tickCombat([tower], [target], 50);

    expect(tower.specialCooldownRemainingMs).toBe(SPECIAL_ATTACK_COOLDOWN_MS.STORMCALLER);
    // Only ticked down by dtMs (50), never reset by the special firing.
    expect(tower.cooldownRemainingMs).toBe(350);
  });

  it("firing the normal attack never touches the special cooldown", () => {
    const tower = createTowerInstance("slot-test", "INFERNO", { x: 0, y: 0 });
    tower.specialCooldownRemainingMs = 5000; // special mid-charge, not ready
    tower.cooldownRemainingMs = 0; // normal ready

    const target = createEnemyInstance("CRAWLER", 1);
    target.position = { x: 20, y: 0 };

    tickCombat([tower], [target], 50);

    expect(tower.specialCooldownRemainingMs).toBe(4950); // only ticked by dtMs
  });

  it("FROSTBORN's special is an area nova centered on the TOWER, freezing every enemy in range — even below level 10, unlike the normal attack's level-gated freeze chance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // rule out the normal attack's own freeze-chance RNG
    const tower = createTowerInstance("slot-test", "FROSTBORN", { x: 0, y: 0 }, 1); // level 1 — normal attack can never freeze
    tower.specialCooldownRemainingMs = 0;
    tower.cooldownRemainingMs = 9999; // normal attack not ready this tick — isolates the special

    const near = createEnemyInstance("CRAWLER", 1);
    near.position = { x: 30, y: 0 };
    const far = createEnemyInstance("CRAWLER", 1);
    far.position = { x: 9999, y: 9999 }; // well outside range

    tickCombat([tower], [near, far], 50);

    expect(near.slow).not.toBeNull();
    expect(near.slow!.percent).toBe(1); // fully frozen by the special, regardless of level
    expect(far.slow).toBeNull();
  });

  it("INFERNO's special ignites a much larger radius than the normal attack's own aoeRadius", () => {
    const tower = createTowerInstance("slot-test", "INFERNO", { x: 0, y: 0 });
    tower.specialCooldownRemainingMs = 0;
    tower.cooldownRemainingMs = 9999;

    const primary = createEnemyInstance("CRAWLER", 1);
    primary.position = { x: 20, y: 0 };
    // Well beyond the normal aoeRadius (~55 at level 1) but within the special's 2.4x radius.
    const farBystander = createEnemyInstance("CRAWLER", 1);
    farBystander.position = { x: 20 + 100, y: 0 };

    tickCombat([tower], [primary, farBystander], 50);

    expect(primary.hp).toBeLessThan(primary.maxHp);
    expect(farBystander.hp).toBeLessThan(farBystander.maxHp);
  });

  it("STORMCALLER's special chains through more targets than the normal attack", () => {
    const tower = createTowerInstance("slot-test", "STORMCALLER", { x: 0, y: 0 }, 1);
    tower.specialCooldownRemainingMs = 0;
    tower.cooldownRemainingMs = 9999;

    const enemies = Array.from({ length: 6 }, (_, i) => {
      const e = createEnemyInstance("CRAWLER", 1);
      e.position = { x: 20 + i * 10, y: 0 };
      return e;
    });

    tickCombat([tower], enemies, 50);

    const hitCount = enemies.filter((e) => e.hp < e.maxHp).length;
    // Level 1 Stormcaller's normal chainTargets is small; the special adds
    // +3 extra chain targets on top, so it should reach noticeably more
    // than just the primary target alone.
    expect(hitCount).toBeGreaterThan(2);
  });

  it("a disabled (jammed) tower cannot fire its special either", () => {
    const tower = createTowerInstance("slot-test", "IRONWOOD", { x: 0, y: 0 });
    tower.specialCooldownRemainingMs = 0;
    tower.disabledRemainingMs = 1000;

    expect(isTowerReadyForSpecial(tower)).toBe(false);
  });

  it("no enemy in range — special stays charged and simply doesn't fire (no wasted cooldown reset)", () => {
    const tower = createTowerInstance("slot-test", "IRONWOOD", { x: 0, y: 0 });
    tower.specialCooldownRemainingMs = 0;
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.position = { x: 9999, y: 9999 };

    tickCombat([tower], [enemy], 50);

    expect(tower.specialCooldownRemainingMs).toBe(0); // still ready, waiting for a target
  });
});
