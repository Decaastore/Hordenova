import { describe, expect, it, vi, afterEach } from "vitest";
import { tickCombat } from "./CombatSystem";
import { createTowerInstance, isTowerReadyForSpecial, isTowerReadyToAttack } from "@/entities/Tower";
import { createEnemyInstance } from "@/entities/Enemy";
import { SPECIAL_ATTACK_COOLDOWN_MS } from "@/config/towerSpecials";
import { MANA_MAX, MANA_OVERCHARGE_MAX, MANA_PER_KILL, getManaUpgradeCost, manaGainMultiplier, MANA_UPGRADE_MAX_LEVEL } from "@/config/towerMana";
import { TOWER_TYPES } from "@/config/towerStats";

describe("Special Attack system (Master Implementation spec section 26-28)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a freshly-built tower's special is NOT ready immediately — it must charge up first", () => {
    for (const type of TOWER_TYPES) {
      const tower = createTowerInstance("slot-test", type, { x: 0, y: 0 });
      expect(isTowerReadyForSpecial(tower)).toBe(false);
      expect(tower.mana).toBe(0);
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
    withSpecial.mana = MANA_MAX;
    withoutSpecial.mana = 0;

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

  it("firing the special spends ONLY the mana bar, never the normal attack's own cooldown", () => {
    const tower = createTowerInstance("slot-test", "STORMCALLER", { x: 0, y: 0 });
    tower.mana = MANA_MAX;
    tower.cooldownRemainingMs = 400; // normal attack mid-cooldown, not ready

    const target = createEnemyInstance("CRAWLER", 1);
    target.position = { x: 20, y: 0 };

    tickCombat([tower], [target], 50);

    expect(tower.mana).toBe(0);
    // Only ticked down by dtMs (50), never reset by the special firing.
    expect(tower.cooldownRemainingMs).toBe(350);
  });

  it.each(TOWER_TYPES)("a %s that keeps attacking fires its special once per special interval, whatever the tick size", (type) => {
    for (const tick of [16, 50, 100]) {
      const tower = createTowerInstance("slot-test", type, { x: 0, y: 0 }, 20);
      const target = createEnemyInstance("BRUTE", 1);
      target.hp = target.maxHp = 1e12; // never dies, so no kill bonus
      target.position = { x: 20, y: 0 };
      let specials = 0;
      const window = SPECIAL_ATTACK_COOLDOWN_MS[type] * 10;
      for (let t = 0; t < window; t += tick) specials += tickCombat([tower], [target], tick).projectiles.filter((p) => p.isSpecial).length;
      expect(specials, `tick ${tick}`).toBeGreaterThanOrEqual(9);
      expect(specials, `tick ${tick}`).toBeLessThanOrEqual(10);
    }
  });

  it("a kill adds extra mana to the tower that landed it", () => {
    const tower = createTowerInstance("slot-test", "IRONWOOD", { x: 0, y: 0 }, 30);
    const target = createEnemyInstance("CRAWLER", 1);
    target.hp = 1;
    target.position = { x: 20, y: 0 };

    tickCombat([tower], [target], 50);

    // the very first attack has only this tick behind it, so most of this is the kill
    expect(tower.mana).toBeGreaterThanOrEqual(MANA_PER_KILL);
  });

  it("no target, no mana — an idle tower doesn't charge", () => {
    const tower = createTowerInstance("slot-test", "INFERNO", { x: 0, y: 0 });
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.position = { x: 9999, y: 9999 };
    for (let i = 0; i < 100; i++) tickCombat([tower], [enemy], 50);
    expect(tower.mana).toBe(0);
  });

  it("HOLD: while specials are held a full tower doesn't fire and keeps charging up to the overcharge cap; released, it hits harder", () => {
    const held = createTowerInstance("slot-a", "IRONWOOD", { x: 0, y: 0 });
    held.mana = MANA_MAX;
    held.cooldownRemainingMs = 9999;
    const target = createEnemyInstance("BRUTE", 1);
    target.hp = target.maxHp = 1e9;
    target.position = { x: 20, y: 0 };

    tickCombat([held], [target], 50, 0, true);
    expect(target.hp).toBe(target.maxHp); // nothing fired
    expect(held.mana).toBe(MANA_MAX);

    held.cooldownRemainingMs = 0;
    for (let i = 0; i < 400; i++) {
      tickCombat([held], [target], 50, 0, true);
    }
    expect(held.mana).toBe(MANA_OVERCHARGE_MAX);
    expect(target.hp).toBeLessThan(target.maxHp); // normal attacks kept firing

    // Release: one full special vs one overcharged special on identical fresh targets.
    const normal = createTowerInstance("slot-b", "IRONWOOD", { x: 0, y: 0 });
    normal.mana = MANA_MAX;
    normal.cooldownRemainingMs = 9999;
    held.cooldownRemainingMs = 9999;
    const t1 = createEnemyInstance("BRUTE", 1);
    t1.hp = t1.maxHp = 1e9;
    t1.position = { x: 20, y: 0 };
    const t2 = createEnemyInstance("BRUTE", 1);
    t2.hp = t2.maxHp = 1e9;
    t2.position = { x: 20, y: 0 };
    tickCombat([normal], [t1], 50);
    tickCombat([held], [t2], 50);
    expect(t2.maxHp - t2.hp).toBeCloseTo((t1.maxHp - t1.hp) * 1.5, 0);
    expect(held.mana).toBe(0);
  });

  it("MANA UPGRADE: +5% gain per level up to +50%, a paid skin adds +10%, and the Gold cost climbs to a hard top", () => {
    expect(manaGainMultiplier(0, null)).toBe(1);
    expect(manaGainMultiplier(MANA_UPGRADE_MAX_LEVEL, null)).toBeCloseTo(1.5, 9);
    expect(manaGainMultiplier(99, null)).toBeCloseTo(1.5, 9);
    for (const type of TOWER_TYPES) {
      let prev = 0;
      for (let level = 0; level < MANA_UPGRADE_MAX_LEVEL; level++) {
        const cost = getManaUpgradeCost(type, level)!;
        expect(cost).toBeGreaterThan(prev);
        prev = cost;
      }
      expect(getManaUpgradeCost(type, MANA_UPGRADE_MAX_LEVEL)).toBeNull();
    }
  });

  it("FROSTBORN's special is an area nova centered on the TOWER, freezing every enemy in range — even below level 10, unlike the normal attack's level-gated freeze chance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // rule out the normal attack's own freeze-chance RNG
    const tower = createTowerInstance("slot-test", "FROSTBORN", { x: 0, y: 0 }, 1); // level 1 — normal attack can never freeze
    tower.mana = MANA_MAX;
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
    tower.mana = MANA_MAX;
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
    tower.mana = MANA_MAX;
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
    tower.mana = MANA_MAX;
    tower.disabledRemainingMs = 1000;

    expect(isTowerReadyForSpecial(tower)).toBe(false);
  });

  it("no enemy in range — special stays charged and simply doesn't fire (no wasted mana)", () => {
    const tower = createTowerInstance("slot-test", "IRONWOOD", { x: 0, y: 0 });
    tower.mana = MANA_MAX;
    const enemy = createEnemyInstance("CRAWLER", 1);
    enemy.position = { x: 9999, y: 9999 };

    tickCombat([tower], [enemy], 50);

    expect(tower.mana).toBe(MANA_MAX); // still ready, waiting for a target
  });
});
