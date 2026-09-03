import { describe, expect, it } from "vitest";
import { addItem, countByDefinition, findItem, getItemsByCategory, getItemsByRarity, removeItem } from "./InventoryManager";
import { createItemInstance } from "@/entities/Item";

function item(defId: string) {
  return createItemInstance(defId, "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
}

describe("InventoryManager", () => {
  it("addItem returns a NEW array (pure) containing the added item", () => {
    const original = [item("warden_fragment")];
    const added = item("ancient_core");
    const next = addItem(original, added);
    expect(next).toHaveLength(2);
    expect(original).toHaveLength(1); // untouched
    expect(findItem(next, added.instanceId)).toEqual(added);
  });

  it("removeItem drops exactly the matching instance, nothing else", () => {
    const a = item("warden_fragment");
    const b = item("ancient_core");
    const next = removeItem([a, b], a.instanceId);
    expect(next).toEqual([b]);
  });

  it("findItem returns null for a missing instanceId", () => {
    expect(findItem([item("warden_fragment")], "does-not-exist")).toBeNull();
  });

  it("getItemsByCategory filters by the definition's category", () => {
    const material = item("warden_fragment"); // MATERIAL
    const relic = item("mosswood_charm"); // RELIC
    const result = getItemsByCategory([material, relic], "MATERIAL");
    expect(result).toEqual([material]);
  });

  it("getItemsByRarity filters by the definition's rarity", () => {
    const common = item("warden_fragment"); // COMMON
    const mythic = item("crown_of_the_hollow_king"); // MYTHIC
    const result = getItemsByRarity([common, mythic], "MYTHIC");
    expect(result).toEqual([mythic]);
  });

  it("countByDefinition counts duplicate copies of the same definition", () => {
    const inventory = [item("warden_fragment"), item("warden_fragment"), item("ancient_core")];
    expect(countByDefinition(inventory, "warden_fragment")).toBe(2);
    expect(countByDefinition(inventory, "ancient_core")).toBe(1);
    expect(countByDefinition(inventory, "hollow_sigil")).toBe(0);
  });
});
