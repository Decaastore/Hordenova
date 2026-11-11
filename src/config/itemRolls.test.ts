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

  it("rarer items give much more, and the top ones carry several effects", () => {
    const total = (id: keyof typeof ITEM_DEFINITIONS) => ITEM_DEFINITIONS[id].effects.reduce((s, e) => s + e.value, 0);
    expect(total("crown_of_the_hollow_king")).toBeGreaterThan(total("wardens_eye"));
    expect(total("wardens_eye")).toBeGreaterThan(total("ancient_core"));
    expect(ITEM_DEFINITIONS.crown_of_the_hollow_king.effects.length).toBe(3);
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
      { itemDefinitionId: "mosswood_charm", rolls: [3] },
      { itemDefinitionId: "crown_of_the_hollow_king", rolls: [30, 15, 10] },
      { itemDefinitionId: "hollow_sigil", rolls: [20, 5] },
    ]);
    expect(bonus.damagePct).toBeCloseTo(3 + 30 + 5);
    expect(bonus.bossDamagePct).toBe(15 + 20);
    expect(bonus.attackSpeedPct).toBe(10);
  });
});
