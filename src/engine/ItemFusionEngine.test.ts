import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { createItemInstance, type ItemInstance } from "@/entities/Item";
import { getItemDefinition } from "@/config/itemDefinitions";

/**
 * SISTEMA DE FUSÃO DE ITENS — real-GameEngine tests for the atomic
 * attemptFusion operation. Mirrors ItemSlots.test.ts's own conventions:
 * items are injected directly into the engine's private inventory field
 * (bypassing the random Boss-drop roll), and Math.random is mocked
 * directly (this codebase's established RNG-mocking pattern — see
 * GameEngine.Roulette.test.ts) rather than an injected rng parameter.
 */

function inject(engine: GameEngine, items: readonly ItemInstance[]): void {
  (engine as unknown as { inventory: ItemInstance[] }).inventory = [...items];
}

function getInventory(engine: GameEngine): ItemInstance[] {
  return (engine as unknown as { inventory: ItemInstance[] }).inventory;
}

function makeItem(itemDefinitionId: string, playerId = "player-1"): ItemInstance {
  return createItemInstance(itemDefinitionId, playerId, { type: "BOSS_DROP", refId: "hollow-warden" });
}

function setup(): GameEngine {
  updateSave({ gold: 100_000, towerLoadout: [], playerId: "player-1" });
  const engine = new GameEngine();
  engine.startRun();
  return engine;
}

describe("Item Fusion (real GameEngine) — SISTEMA DE FUSÃO DE ITENS", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("success rolls consume exactly 3 items and create exactly 1 superior item", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // always succeeds, always picks the first candidate
    const engine = setup();
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    inject(engine, items);

    const outcome = engine.attemptFusion(items.map((i) => i.instanceId));
    expect(outcome.status).toBe("SUCCESS");
    if (outcome.status !== "SUCCESS") throw new Error("unreachable");
    expect(outcome.resultItem.itemDefinitionId).toBe("mosswood_charm"); // COMMON's next tier, UNCOMMON's one real item
    expect(getItemDefinition(outcome.resultItem.itemDefinitionId)?.rarity).toBe("UNCOMMON");

    const finalInventory = getInventory(engine);
    expect(finalInventory).toHaveLength(1);
    expect(finalInventory[0]!.instanceId).toBe(outcome.resultItem.instanceId);
  });

  it("failure rolls consume exactly 3 items and create ZERO items — no compensation of any kind", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // always fails
    const engine = setup();
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    inject(engine, items);

    const outcome = engine.attemptFusion(items.map((i) => i.instanceId));
    expect(outcome.status).toBe("FAILURE");
    expect(getInventory(engine)).toHaveLength(0);
  });

  it("fewer than 3 selected items is BLOCKED and consumes nothing", () => {
    const engine = setup();
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment")];
    inject(engine, items);

    const outcome = engine.attemptFusion(items.map((i) => i.instanceId));
    expect(outcome.status).toBe("BLOCKED");
    if (outcome.status !== "BLOCKED") throw new Error("unreachable");
    expect(outcome.reason).toBe("WRONG_COUNT");
    expect(getInventory(engine)).toHaveLength(2); // both items untouched
  });

  it("selecting more than 3 items is BLOCKED — the extras are never consumed", () => {
    const engine = setup();
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    inject(engine, items);

    const outcome = engine.attemptFusion(items.map((i) => i.instanceId));
    expect(outcome.status).toBe("BLOCKED");
    expect(getInventory(engine)).toHaveLength(4); // all 4 untouched, including the "extra" one
  });

  it("mixed rarities are BLOCKED and consume nothing", () => {
    const engine = setup();
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("mosswood_charm")];
    inject(engine, items);

    const outcome = engine.attemptFusion(items.map((i) => i.instanceId));
    expect(outcome.status).toBe("BLOCKED");
    if (outcome.status !== "BLOCKED") throw new Error("unreachable");
    expect(outcome.reason).toBe("MIXED_RARITY");
    expect(getInventory(engine)).toHaveLength(3);
  });

  it("an item belonging to another player is BLOCKED (ownership is mandatory) and consumes nothing", () => {
    const engine = setup(); // fixes GameEngine.playerId to "player-1", matching makeItem's default owner
    const mine1 = makeItem("warden_fragment", "player-1");
    const mine2 = makeItem("warden_fragment", "player-1");
    const someoneElses = makeItem("warden_fragment", "player-2");
    const items = [mine1, mine2, someoneElses];
    inject(engine, items);

    const outcome = engine.attemptFusion(items.map((i) => i.instanceId));
    expect(outcome.status).toBe("BLOCKED");
    if (outcome.status !== "BLOCKED") throw new Error("unreachable");
    expect(outcome.reason).toBe("NOT_OWNED");
    expect(getInventory(engine)).toHaveLength(3);
  });

  it("the maximum rarity (MYTHIC) is BLOCKED and the UI-facing eligibility check reports it before any attempt", () => {
    const engine = setup();
    const items = [makeItem("crown_of_the_hollow_king"), makeItem("crown_of_the_hollow_king"), makeItem("crown_of_the_hollow_king")];
    inject(engine, items);

    const eligibility = engine.getFusionEligibility(items.map((i) => i.instanceId));
    expect(eligibility.ok).toBe(false);
    expect(eligibility.reason).toBe("MAX_RARITY");

    const outcome = engine.attemptFusion(items.map((i) => i.instanceId));
    expect(outcome.status).toBe("BLOCKED");
    expect(getInventory(engine)).toHaveLength(3);
  });

  it("a nonexistent instanceId reference is BLOCKED and consumes nothing", () => {
    const engine = setup();
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment")];
    inject(engine, items);

    const outcome = engine.attemptFusion([items[0]!.instanceId, items[1]!.instanceId, "ghost-item-id"]);
    expect(outcome.status).toBe("BLOCKED");
    expect(getInventory(engine)).toHaveLength(2);
  });

  it("a duplicated selection (the same item twice) is BLOCKED and does not double-consume it", () => {
    const engine = setup();
    const item = makeItem("warden_fragment");
    const other = makeItem("warden_fragment");
    inject(engine, [item, other]);

    const outcome = engine.attemptFusion([item.instanceId, item.instanceId, other.instanceId]);
    expect(outcome.status).toBe("BLOCKED");
    expect(getInventory(engine)).toHaveLength(2);
  });

  it("phantom-item prevention: an item currently equipped on a tower is unequipped before being consumed by fusion — no dangling equippedItemInstanceIds reference survives", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // failure — simpler to assert nothing but the equip slot changed
    const engine = setup();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);

    const equippedItem = makeItem("warden_fragment");
    const other1 = makeItem("warden_fragment");
    const other2 = makeItem("warden_fragment");
    inject(engine, [equippedItem, other1, other2]);
    engine.equipItemOnSelectedTower(equippedItem.instanceId, 0);
    expect(engine.getSelectedTowerItemSlots()[0]?.instanceId).toBe(equippedItem.instanceId);

    const outcome = engine.attemptFusion([equippedItem.instanceId, other1.instanceId, other2.instanceId]);
    expect(outcome.status).toBe("FAILURE");
    expect(engine.getSelectedTowerItemSlots()[0]).toBeNull(); // no ghost reference left behind
    expect(getInventory(engine)).toHaveLength(0);
  });

  it("fusion never mints Gold, Gems, or Gem Shards — only the item side of the ledger moves", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // success
    const engine = setup();
    const goldBefore = engine.getHudSnapshot().gold;
    const gemsBefore = engine.getGemBalance();
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    inject(engine, items);

    engine.attemptFusion(items.map((i) => i.instanceId));
    expect(engine.getHudSnapshot().gold).toBe(goldBefore);
    expect(engine.getGemBalance()).toBe(gemsBefore);
  });

  it("persists across reload: a fresh GameEngine reading the same save sees the exact post-fusion inventory (correct persistence, no phantom re-creation)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // success
    updateSave({ gold: 100_000, towerLoadout: [], playerId: "player-1" });
    const first = new GameEngine();
    first.startRun();
    const items = [makeItem("warden_fragment"), makeItem("warden_fragment"), makeItem("warden_fragment")];
    inject(first, items);
    const outcome = first.attemptFusion(items.map((i) => i.instanceId));
    expect(outcome.status).toBe("SUCCESS");

    const reloaded = new GameEngine();
    reloaded.startRun();
    const reloadedInventory = getInventory(reloaded);
    expect(reloadedInventory).toHaveLength(1);
    if (outcome.status === "SUCCESS") {
      expect(reloadedInventory[0]!.instanceId).toBe(outcome.resultItem.instanceId);
    }
  });
});
