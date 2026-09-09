import { afterEach, describe, expect, it, vi } from "vitest";
import { checkFusionEligibility, pickFusionResultDefinitionId, rollFusion } from "./ItemFusion";
import { createItemInstance, type ItemInstance } from "@/entities/Item";

const OWNER = "player-1";

function makeItem(itemDefinitionId: string, overrides: Partial<ItemInstance> = {}): ItemInstance {
  return { ...createItemInstance(itemDefinitionId, OWNER, { type: "BOSS_DROP", refId: "hollow-warden" }), ...overrides };
}

describe("engine/ItemFusion.ts — checkFusionEligibility (SISTEMA DE FUSÃO DE ITENS)", () => {
  it("exactly 3 items of the same rarity, all owned, is eligible", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    const result = checkFusionEligibility(items, items.map((i) => i.instanceId), OWNER);
    expect(result.ok).toBe(true);
    expect(result.rarity).toBe("COMMON");
    expect(result.nextRarity).toBe("UNCOMMON");
  });

  it("fewer than 3 selected items is blocked (WRONG_COUNT)", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment")];
    const result = checkFusionEligibility(items, items.map((i) => i.instanceId), OWNER);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("WRONG_COUNT");
  });

  it("more than 3 selected items is blocked (WRONG_COUNT) — the extras are never touched since the whole attempt is rejected", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    const result = checkFusionEligibility(items, items.map((i) => i.instanceId), OWNER);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("WRONG_COUNT");
  });

  it("the same item selected twice (duplicated selection) is blocked", () => {
    const item = makeItem("warden_fragment");
    const other = makeItem("warden_fragment");
    const items = [item, other];
    const result = checkFusionEligibility(items, [item.instanceId, item.instanceId, other.instanceId], OWNER);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("DUPLICATE_SELECTION");
  });

  it("a nonexistent instanceId is blocked (ITEM_NOT_FOUND)", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment")];
    const result = checkFusionEligibility(items, [items[0]!.instanceId, items[1]!.instanceId, "does-not-exist"], OWNER);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("ITEM_NOT_FOUND");
  });

  it("an item belonging to another player is blocked (NOT_OWNED)", () => {
    const mine1 = makeItem("warden_fragment");
    const mine2 = makeItem("warden_fragment");
    const someoneElses = makeItem("warden_fragment", { ownerId: "player-2" });
    const items = [mine1, mine2, someoneElses];
    const result = checkFusionEligibility(items, items.map((i) => i.instanceId), OWNER);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("NOT_OWNED");
  });

  it("mixed rarities are blocked (MIXED_RARITY)", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("mosswood_charm")];
    const result = checkFusionEligibility(items, items.map((i) => i.instanceId), OWNER);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("MIXED_RARITY");
  });

  it("the maximum rarity (MYTHIC) is blocked (MAX_RARITY) — no higher tier exists", () => {
    const items = [makeItem("crown_of_the_hollow_king"), makeItem("crown_of_the_hollow_king"), makeItem("crown_of_the_hollow_king")];
    const result = checkFusionEligibility(items, items.map((i) => i.instanceId), OWNER);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("MAX_RARITY");
  });

  it("an item mid-trade is blocked (NOT_ELIGIBLE)", () => {
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment", { pendingTrade: true })];
    const result = checkFusionEligibility(items, items.map((i) => i.instanceId), OWNER);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("NOT_ELIGIBLE");
  });
});

describe("engine/ItemFusion.ts — rollFusion / pickFusionResultDefinitionId", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rollFusion succeeds only when the roll lands strictly below the rarity's chance", () => {
    expect(rollFusion("COMMON", () => 0.39)).toBe(true); // < 0.40
    expect(rollFusion("COMMON", () => 0.4)).toBe(false); // not < 0.40
    expect(rollFusion("COMMON", () => 0.99)).toBe(false);
  });

  it("rollFusion at RARE (3%) only succeeds inside that exact band", () => {
    expect(rollFusion("RARE", () => 0.0299)).toBe(true);
    expect(rollFusion("RARE", () => 0.03)).toBe(false);
  });

  it("pickFusionResultDefinitionId returns a real item definition id at the requested rarity", () => {
    const id = pickFusionResultDefinitionId("UNCOMMON", () => 0);
    expect(id).toBe("mosswood_charm");
  });
});
