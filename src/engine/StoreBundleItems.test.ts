import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import { applyRewardParts, rewardItemDefinitionId } from "./RewardGrant";
import { SKIN_BUNDLES } from "@/config/store";
import { getItemDefinition } from "@/config/itemDefinitions";
import { createItemInstance } from "@/entities/Item";

describe("Store bundles: items to forge", () => {
  beforeEach(() => window.localStorage.clear());

  it("every bundle brings Normal items in trios (one Forge each), and the bigger ones bring Rare ones too", () => {
    for (const b of SKIN_BUNDLES) {
      const normals = b.contents.filter((p) => p.kind === "ITEM" && p.rarity === "UNCOMMON").length;
      expect(normals, b.id).toBeGreaterThanOrEqual(3);
      expect(normals % 3, b.id).toBe(0);
    }
    const rares = SKIN_BUNDLES.map((b) => b.contents.filter((p) => p.kind === "ITEM" && p.rarity === "RARE").length);
    expect(rares.at(-1)).toBeGreaterThanOrEqual(3);
  });

  it("a bundle's items arrive account-bound: they can't be sold or traded", () => {
    const save = loadSave();
    const bundle = SKIN_BUNDLES[0]!;
    const out = applyRewardParts(save, bundle.contents, { type: "STORE", refId: bundle.id });
    const items = out.inventory!.filter((i) => i.source.type === "STORE");
    expect(items.length).toBe(bundle.contents.filter((p) => p.kind === "ITEM").length);
    expect(items.every((i) => i.tradable === false)).toBe(true);
  });

  it("forging three of them gives a normal item that can be sold", () => {
    const defId = rewardItemDefinitionId("UNCOMMON")!;
    const owner = loadSave().playerId;
    const storeItems = [0, 1, 2].map(() => {
      const it = createItemInstance(defId, owner, { type: "STORE", refId: "BUNDLE_EMBER" });
      it.tradable = false;
      return it;
    });
    updateSave({ inventory: storeItems, overflowInventory: [] });
    const engine = new GameEngine();
    engine.startRun();
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    const out = engine.attemptFusion(storeItems.map((i) => i.instanceId));
    spy.mockRestore();
    expect(out.status).toBe("SUCCESS");
    const result = loadSave().inventory.find((i) => i.source.type === "FUSION")!;
    expect(result.tradable).toBe(getItemDefinition(result.itemDefinitionId)!.tradable);
    expect(result.tradable).toBe(true);
  });
});
