import { describe, expect, it } from "vitest";
import { ITEM_DEFINITIONS } from "./itemDefinitions";
import { effectRange, itemBonusFrom, itemEffectsOf, itemRollQuality, rerollCost, rollItemEffects } from "./itemRolls";
import { createItemInstance } from "@/entities/Item";

describe("item rolls", () => {
  it("every roll lands inside the range the item shows", () => {
    for (const def of Object.values(ITEM_DEFINITIONS)) {
      for (const r of [0, 0.37, 0.999]) {
        const rolls = rollItemEffects(def, () => r);
        def.effects.forEach((effect, i) => {
          const { min, max } = effectRange(effect);
          expect(rolls[i]).toBeGreaterThanOrEqual(min);
          expect(rolls[i]).toBeLessThanOrEqual(max);
        });
      }
    }
  });

  it("a new copy carries its own rolls; an old copy without rolls uses the listed value", () => {
    const item = createItemInstance("mosswood_charm", "p1", { type: "BOSS_DROP", refId: "hollow-warden" });
    expect(item.rolls).toHaveLength(1);
    const old = { itemDefinitionId: "mosswood_charm" };
    expect(itemEffectsOf(old)[0]!.value).toBe(ITEM_DEFINITIONS.mosswood_charm.effects[0]!.value);
    expect(itemRollQuality(old)).toBeCloseTo(0.5, 5);
  });

  it("items with no effects can't be re-rolled; rarer items cost more", () => {
    expect(rerollCost({ itemDefinitionId: "warden_fragment" })).toBeNull();
    expect(rerollCost({ itemDefinitionId: "wardens_eye" })!).toBeGreaterThan(rerollCost({ itemDefinitionId: "mosswood_charm" })!);
  });

  it("equipped items add up into the tower's bonus", () => {
    const bonus = itemBonusFrom([
      { itemDefinitionId: "mosswood_charm", rolls: [2.5] },
      { itemDefinitionId: "crown_of_the_hollow_king", rolls: [9] },
      { itemDefinitionId: "hollow_sigil", rolls: [6] },
    ]);
    expect(bonus.damagePct).toBeCloseTo(11.5);
    expect(bonus.bossDamagePct).toBe(6);
    expect(bonus.attackSpeedPct).toBe(0);
  });
});
