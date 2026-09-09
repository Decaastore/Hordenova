import { describe, expect, it } from "vitest";
import { createTowerInstance } from "@/entities/Tower";
import { getAccountCombatPower, getBaselineCombatPowerAtWaveOne, getTowerCombatPower } from "./CombatPower";

/**
 * DIFICULDADE INDIVIDUAL POR JOGADOR spec section 1 — Combat Power must
 * distinguish real loadout differences (level distribution, Mastery,
 * Specialization) and must NEVER count an unlocked-but-unused Specialization,
 * an unplaced tower, or an item sitting only in the inventory.
 */
describe("engine/CombatPower.ts", () => {
  it("a higher tower level produces strictly more Combat Power than a lower level, all else equal", () => {
    const low = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 5);
    const high = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 30);
    expect(getTowerCombatPower(high)).toBeGreaterThan(getTowerCombatPower(low));
  });

  it("Mastery bonuses (already baked into getTowerStats) increase Combat Power over an identical tower with no Mastery", () => {
    const noMastery = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 30, null, 0, null, 0, false);
    const withMastery = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 30, null, 0, null, 25, true);
    expect(getTowerCombatPower(withMastery)).toBeGreaterThan(getTowerCombatPower(noMastery));
  });

  it("an ACTIVE Specialization (chosen AND leveled) increases Combat Power over the same tower with none", () => {
    const noSpec = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 15, null, 0);
    const withSpec = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 15, "IRONWOOD_EXECUTIONER", 10);
    expect(getTowerCombatPower(withSpec)).toBeGreaterThan(getTowerCombatPower(noSpec));
  });

  it("a Specialization chosen but at level 0 (never actually invested in) counts for NOTHING — same Combat Power as no Specialization at all", () => {
    const noSpec = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 15, null, 0);
    const chosenButLevelZero = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 15, "IRONWOOD_EXECUTIONER", 0);
    expect(getTowerCombatPower(chosenButLevelZero)).toBe(getTowerCombatPower(noSpec));
  });

  it("account Combat Power is the SUM across every tower actually placed — never just the account's single highest tower", () => {
    const oneStrongTower = [createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 25)];
    const eightModerateTowers = Array.from({ length: 8 }, (_, i) =>
      createTowerInstance(`slot-${i}`, "IRONWOOD", { x: 0, y: 0 }, 20),
    );
    // 8 towers at level 20 clearly outweighs a single tower at level 25 —
    // the account's power is a real function of DISTRIBUTION, not a max().
    expect(getAccountCombatPower(eightModerateTowers)).toBeGreaterThan(getAccountCombatPower(oneStrongTower));
  });

  it("a tower NOT in the loadout array contributes nothing — Combat Power only ever sums the real, currently-placed towers", () => {
    const placed = [createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 10)];
    const placedPower = getAccountCombatPower(placed);
    const empty = getAccountCombatPower([]);
    expect(placedPower).toBeGreaterThan(empty);
    expect(empty).toBe(0);
  });

  it("equipped items never change Combat Power — equipment grants no combat effect anywhere in this codebase yet, so getTowerStats (and thus this metric) is structurally unaffected by equippedItemInstanceIds", () => {
    const noItems = createTowerInstance("slot-1", "IRONWOOD", { x: 0, y: 0 }, 20, null, 0, null, 0, false, [null, null, null]);
    const withItems = createTowerInstance(
      "slot-1",
      "IRONWOOD",
      { x: 0, y: 0 },
      20,
      null,
      0,
      null,
      0,
      false,
      ["item-a", "item-b", "item-c"],
    );
    expect(getTowerCombatPower(withItems)).toBe(getTowerCombatPower(noItems));
  });

  it("getBaselineCombatPowerAtWaveOne is a real, finite, positive number derived from real level-1 stats", () => {
    const baseline = getBaselineCombatPowerAtWaveOne();
    expect(baseline).toBeGreaterThan(0);
    expect(Number.isFinite(baseline)).toBe(true);
  });
});
