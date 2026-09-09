import { describe, expect, it } from "vitest";
import { FUSION_ITEM_COUNT, getFusionSuccessChance, getNextRarity } from "./itemFusion";

/**
 * SISTEMA DE FUSÃO DE ITENS — the exact, FINAL chance table from the task
 * spec. These numbers are never a balance lever — see this file's own
 * header comment.
 */
describe("config/itemFusion.ts", () => {
  it("FUSION_ITEM_COUNT is exactly 3", () => {
    expect(FUSION_ITEM_COUNT).toBe(3);
  });

  it("exact success chances per source rarity, per the task spec", () => {
    expect(getFusionSuccessChance("COMMON")).toBe(0.4); // 3 Comuns -> Normal (Uncommon): 40%
    expect(getFusionSuccessChance("UNCOMMON")).toBe(0.2); // 3 Normais -> Raro: 20%
    expect(getFusionSuccessChance("RARE")).toBe(0.03); // 3 Raros -> Épico: 3%
    expect(getFusionSuccessChance("EPIC")).toBe(0.01); // 3 Épicos -> Lendário: 1%
    expect(getFusionSuccessChance("LEGENDARY")).toBe(0.0025); // 3 Lendários -> Mítico: 0.25%
  });

  it("getNextRarity walks up the real 6-tier ladder", () => {
    expect(getNextRarity("COMMON")).toBe("UNCOMMON");
    expect(getNextRarity("UNCOMMON")).toBe("RARE");
    expect(getNextRarity("RARE")).toBe("EPIC");
    expect(getNextRarity("EPIC")).toBe("LEGENDARY");
    expect(getNextRarity("LEGENDARY")).toBe("MYTHIC");
  });

  it("MYTHIC has no next rarity — the exact condition that blocks fusion at max rarity", () => {
    expect(getNextRarity("MYTHIC")).toBeNull();
  });
});
