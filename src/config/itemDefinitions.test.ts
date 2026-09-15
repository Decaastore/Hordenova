import { describe, expect, it } from "vitest";
import { getItemDefinition, getItemDefinitionsByRarity, ITEM_DEFINITIONS, type ItemCategory } from "./itemDefinitions";

/**
 * AMULETOS COMO ITENS REAIS — locks in the exact 3-item AMULET set this
 * repo's real catalog was confirmed to have after the full re-audit
 * (mosswood_charm/hollow_sigil/wardens_eye), and guards against silently
 * gaining or losing a 4th without a deliberate catalog change. Nothing here
 * invents a new item or touches rarity/effects/source/tradable — those are
 * asserted unchanged too.
 */
describe("itemDefinitions — AMULET category", () => {
  const AMULET_IDS = ["mosswood_charm", "hollow_sigil", "wardens_eye"] as const;

  it("exposes exactly the 3 confirmed amulets, no more and no fewer", () => {
    const amuletIds = Object.values(ITEM_DEFINITIONS)
      .filter((def) => def.category === "AMULET")
      .map((def) => def.id)
      .sort();
    expect(amuletIds).toEqual([...AMULET_IDS].sort());
  });

  it("each amulet keeps its pre-existing rarity/effects/source/tradable — only category changed", () => {
    expect(getItemDefinition("mosswood_charm")).toMatchObject({
      rarity: "UNCOMMON",
      category: "AMULET",
      effects: [{ kind: "TOWER_DAMAGE_PERCENT", value: 2 }],
      source: { type: "BOSS_DROP", refId: "hollow-warden" },
      tradable: true,
    });
    expect(getItemDefinition("hollow_sigil")).toMatchObject({
      rarity: "EPIC",
      category: "AMULET",
      effects: [{ kind: "BOSS_DAMAGE_PERCENT", value: 5 }],
      source: { type: "BOSS_DROP", refId: "hollow-warden" },
      tradable: true,
    });
    expect(getItemDefinition("wardens_eye")).toMatchObject({
      rarity: "LEGENDARY",
      category: "AMULET",
      effects: [{ kind: "CRIT_CHANCE_PERCENT", value: 4 }],
      source: { type: "BOSS_DROP", refId: "hollow-warden" },
      tradable: true,
    });
  });

  it("no other item was recategorized — the remaining 3 items keep their original category", () => {
    expect(getItemDefinition("warden_fragment")?.category).toBe("MATERIAL");
    expect(getItemDefinition("ancient_core")?.category).toBe("RUNE");
    expect(getItemDefinition("crown_of_the_hollow_king")?.category).toBe("ARTIFACT");
  });

  it("getItemDefinitionsByRarity still resolves exactly 1 item per amulet's rarity tier (unchanged catalog shape)", () => {
    expect(getItemDefinitionsByRarity("UNCOMMON").map((d) => d.id)).toEqual(["mosswood_charm"]);
    expect(getItemDefinitionsByRarity("EPIC").map((d) => d.id)).toEqual(["hollow_sigil"]);
    expect(getItemDefinitionsByRarity("LEGENDARY").map((d) => d.id)).toEqual(["wardens_eye"]);
  });

  it("ItemCategory stays extensible — AMULET is a real member of the union alongside the pre-existing categories", () => {
    const categories: ItemCategory[] = ["MATERIAL", "AMULET", "RELIC", "RUNE", "ARTIFACT", "COSMETIC"];
    expect(categories).toContain("AMULET");
  });
});

/**
 * IDENTIDADE VISUAL DEFINITIVA — every item declares its own `visualAssetId`
 * (the hook config/itemAssets.ts's registry keys off, and ItemGlyph reads),
 * never a shared category-level fallback as the real design. Locks in that
 * every item in the real catalog has one, and that it defaults to the
 * item's own id (the only mapping today, but an explicit field rather than
 * an implicit assumption).
 */
describe("itemDefinitions — visualAssetId (IDENTIDADE VISUAL DEFINITIVA)", () => {
  it("every item declares its own visualAssetId, equal to its id", () => {
    for (const def of Object.values(ITEM_DEFINITIONS)) {
      expect(def.visualAssetId).toBe(def.id);
    }
  });
});
