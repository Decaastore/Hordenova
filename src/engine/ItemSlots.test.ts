import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { createItemInstance, type ItemInstance } from "@/entities/Item";
import { ITEM_DEFINITIONS } from "@/config/itemDefinitions";
import { TOWER_ITEM_SLOT_COUNT } from "@/config/towerItemSlots";

/**
 * BALANCEAMENTO DEFINITIVO spec section 7/12/14 — real-GameEngine tests for
 * Tower Equipment Slots. Reuses the EXISTING item system end to end
 * (entities/Item.ts's ItemInstance, config/itemDefinitions.ts's real
 * catalog) — nothing here invents a new item or grants combat power;
 * equipping is purely a placement action in this pass.
 *
 * Items are injected directly into the engine's inventory (bypassing the
 * random Boss-drop roll, which is exercised elsewhere) — the same
 * private-field-access pattern already established in this test suite
 * (see GameEngine.test.ts's baseHp refill) for setting up deterministic
 * fixtures without fighting RNG.
 */

function inject(engine: GameEngine, items: readonly ItemInstance[]): void {
  (engine as unknown as { inventory: ItemInstance[] }).inventory = [...items];
}

function makeItem(itemDefinitionId: string, playerId = "player-1"): ItemInstance {
  return createItemInstance(itemDefinitionId, playerId, { type: "BOSS_DROP", refId: "hollow-warden" });
}

describe("Tower Equipment Slots (real GameEngine) — BALANCEAMENTO DEFINITIVO spec section 7/12/14", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function setup(): GameEngine {
    updateSave({ gold: 100_000, gems: 100_000, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    engine.placeTower(TOWER_SLOTS[1]!.id, "INFERNO");
    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);
    // These equip/unequip mechanics tests are about placement, not the slot
    // unlock economy (see the dedicated describe block below for that) — pay
    // to unlock every slot up front so equipping into slot 1/2 behaves
    // exactly as it did before slot locking existed.
    engine.unlockItemSlotOnSelectedTower(1);
    engine.unlockItemSlotOnSelectedTower(2);
    return engine;
  }

  it("a freshly placed tower has exactly TOWER_ITEM_SLOT_COUNT empty slots", () => {
    const engine = setup();
    const slots = engine.getSelectedTowerItemSlots();
    expect(slots).toHaveLength(TOWER_ITEM_SLOT_COUNT);
    expect(slots.every((s) => s === null)).toBe(true);
  });

  it("equips an owned, compatible item into an empty slot", () => {
    const engine = setup();
    const item = makeItem("mosswood_charm");
    inject(engine, [item]);

    expect(engine.canEquipItemOnSelectedTower(item.instanceId, 0)).toBe(true);
    const ok = engine.equipItemOnSelectedTower(item.instanceId, 0);
    expect(ok).toBe(true);

    const slots = engine.getSelectedTowerItemSlots();
    expect(slots[0]?.instanceId).toBe(item.instanceId);
    expect(slots[1]).toBeNull();
    expect(slots[2]).toBeNull();
  });

  it("unequips a filled slot back to empty", () => {
    const engine = setup();
    const item = makeItem("ancient_core");
    inject(engine, [item]);
    engine.equipItemOnSelectedTower(item.instanceId, 1);

    const ok = engine.unequipItemFromSelectedTower(1);
    expect(ok).toBe(true);
    expect(engine.getSelectedTowerItemSlots()[1]).toBeNull();
  });

  it("moving an already-equipped item to a different slot on the SAME tower relocates it rather than duplicating it", () => {
    const engine = setup();
    const item = makeItem("hollow_sigil");
    inject(engine, [item]);
    engine.equipItemOnSelectedTower(item.instanceId, 0);

    engine.equipItemOnSelectedTower(item.instanceId, 2);

    const slots = engine.getSelectedTowerItemSlots();
    expect(slots[0]).toBeNull();
    expect(slots[2]?.instanceId).toBe(item.instanceId);
  });

  it("refuses to equip the SAME item onto a SECOND tower while it's already equipped on the first — never duplicated across towers", () => {
    const engine = setup();
    const item = makeItem("wardens_eye");
    inject(engine, [item]);
    engine.equipItemOnSelectedTower(item.instanceId, 0);

    const secondTower = engine.getRenderSnapshot().towers.find((t) => t.slotId === TOWER_SLOTS[1]!.id)!;
    engine.selectTower(secondTower.id);

    expect(engine.canEquipItemOnSelectedTower(item.instanceId, 0)).toBe(false);
    expect(engine.equipItemOnSelectedTower(item.instanceId, 0)).toBe(false);
    expect(engine.getSelectedTowerItemSlots()[0]).toBeNull();
  });

  it("refuses to equip an item the account does not actually own (nonexistent instanceId)", () => {
    const engine = setup();
    expect(engine.canEquipItemOnSelectedTower("item-does-not-exist", 0)).toBe(false);
    expect(engine.equipItemOnSelectedTower("item-does-not-exist", 0)).toBe(false);
  });

  it("refuses an out-of-range slot index", () => {
    const engine = setup();
    const item = makeItem("warden_fragment");
    inject(engine, [item]);
    expect(engine.canEquipItemOnSelectedTower(item.instanceId, TOWER_ITEM_SLOT_COUNT)).toBe(false);
    expect(engine.canEquipItemOnSelectedTower(item.instanceId, -1)).toBe(false);
  });

  it("compatibility rule: every real item in the current catalog (none is COSMETIC) is equippable — the category !== 'COSMETIC' rule is what allows this, verified structurally since no COSMETIC item exists in the catalog yet to exercise the rejection path directly", () => {
    const engine = setup();
    const allItems = Object.keys(ITEM_DEFINITIONS).map((id) => makeItem(id));
    inject(engine, allItems);
    for (const item of allItems) {
      expect(ITEM_DEFINITIONS[item.itemDefinitionId as keyof typeof ITEM_DEFINITIONS].category).not.toBe("COSMETIC");
      expect(engine.canEquipItemOnSelectedTower(item.instanceId, 0)).toBe(true);
    }
  });

  it("survives reload/save-load: a brand-new GameEngine instance reading the same save still sees the equipped item in its slot", () => {
    updateSave({ gold: 100_000, towerLoadout: [] });
    const first = new GameEngine();
    first.startRun();
    first.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    const tower = first.getRenderSnapshot().towers[0]!;
    first.selectTower(tower.id);
    const item = makeItem("mosswood_charm");
    inject(first, [item]);
    first.equipItemOnSelectedTower(item.instanceId, 0);

    const reloaded = new GameEngine();
    reloaded.startRun();
    const reloadedTower = reloaded.getRenderSnapshot().towers[0]!;
    expect(reloadedTower.equippedItemInstanceIds[0]).toBe(item.instanceId);
    reloaded.selectTower(reloadedTower.id);
    expect(reloaded.getSelectedTowerItemSlots()[0]?.instanceId).toBe(item.instanceId);
  });

  it("a save corrupted to equip the SAME item on two towers self-heals on load — first tower in loadout order keeps it, the second's slot is dropped back to empty", () => {
    const item = makeItem("ancient_core");
    updateSave({
      gold: 100_000,
      inventory: [item],
      towerLoadout: [
        { slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 1, equippedItemInstanceIds: [item.instanceId, null, null] },
        { slotId: TOWER_SLOTS[1]!.id, type: "INFERNO", level: 1, equippedItemInstanceIds: [item.instanceId, null, null] },
      ],
    });
    const engine = new GameEngine();
    engine.startRun();
    const towers = engine.getRenderSnapshot().towers;
    const firstTower = towers.find((t) => t.slotId === TOWER_SLOTS[0]!.id)!;
    const secondTower = towers.find((t) => t.slotId === TOWER_SLOTS[1]!.id)!;
    expect(firstTower.equippedItemInstanceIds[0]).toBe(item.instanceId);
    expect(secondTower.equippedItemInstanceIds[0]).toBeNull();
  });

  it("a save referencing an item instanceId that isn't actually in inventory self-heals that slot back to empty", () => {
    updateSave({
      gold: 100_000,
      inventory: [],
      towerLoadout: [
        { slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 1, equippedItemInstanceIds: ["ghost-item-id", null, null] },
      ],
    });
    const engine = new GameEngine();
    engine.startRun();
    const tower = engine.getRenderSnapshot().towers[0]!;
    expect(tower.equippedItemInstanceIds).toEqual([null, null, null]);
  });
});

/**
 * SISTEMA DE SLOTS DE EQUIPAMENTO — the unlock ECONOMY itself (Slot 1 free /
 * Slot 2 = 250 Gems / Slot 3 = 500 Gems, permanent purchase, insufficient
 * Gems blocks, sufficient Gems allows, an unlocked slot stays unlocked with
 * nothing equipped in it). Season Reset persistence is covered separately
 * in AscensionManager.test.ts (a save-level concern, not a GameEngine one).
 */
describe("Item Slot unlock economy (real GameEngine) — SISTEMA DE SLOTS DE EQUIPAMENTO", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function setupUnfunded(): GameEngine {
    updateSave({ gold: 100_000, gems: 0, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);
    return engine;
  }

  it("Slot 1 (index 0) is free and already unlocked on a freshly placed tower — never purchasable", () => {
    const engine = setupUnfunded();
    expect(engine.getSelectedTowerUnlockedSlots()).toEqual([true, false, false]);
    expect(engine.canUnlockItemSlotOnSelectedTower(0)).toBe(false);
  });

  it("Slot 2 (index 1) costs exactly 250 Gems", () => {
    const engine = setupUnfunded();
    expect(engine.getItemSlotUnlockGemCost(1)).toBe(250);
  });

  it("Slot 3 (index 2) costs exactly 500 Gems", () => {
    const engine = setupUnfunded();
    expect(engine.getItemSlotUnlockGemCost(2)).toBe(500);
  });

  it("insufficient Gems blocks the purchase — the slot stays locked and no Gems are deducted", () => {
    setupUnfunded();
    updateSave({ gems: 249 });
    const fresh = new GameEngine();
    fresh.startRun();
    const tower = fresh.getRenderSnapshot().towers[0]!;
    fresh.selectTower(tower.id);

    expect(fresh.canUnlockItemSlotOnSelectedTower(1)).toBe(false);
    expect(fresh.unlockItemSlotOnSelectedTower(1)).toBe(false);
    expect(fresh.getSelectedTowerUnlockedSlots()[1]).toBe(false);
    expect(fresh.getGemBalance()).toBe(249);
  });

  it("sufficient Gems allows the purchase — the slot unlocks and exactly the Gems cost is deducted", () => {
    updateSave({ gold: 100_000, gems: 250, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);

    expect(engine.canUnlockItemSlotOnSelectedTower(1)).toBe(true);
    expect(engine.unlockItemSlotOnSelectedTower(1)).toBe(true);
    expect(engine.getSelectedTowerUnlockedSlots()[1]).toBe(true);
    expect(engine.getGemBalance()).toBe(0);
  });

  it("unlocking is permanent and idempotent — a second attempt on an already-unlocked slot is refused and never double-charges Gems", () => {
    updateSave({ gold: 100_000, gems: 1000, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);
    engine.unlockItemSlotOnSelectedTower(1);
    const gemsAfterFirstUnlock = engine.getGemBalance();

    expect(engine.canUnlockItemSlotOnSelectedTower(1)).toBe(false);
    expect(engine.unlockItemSlotOnSelectedTower(1)).toBe(false);
    expect(engine.getGemBalance()).toBe(gemsAfterFirstUnlock);
  });

  it("an unlocked slot stays unlocked even with no item currently equipped in it — unlock and equip are fully independent", () => {
    setupUnfunded();
    updateSave({ gems: 250 });
    const fresh = new GameEngine();
    fresh.startRun();
    const tower = fresh.getRenderSnapshot().towers[0]!;
    fresh.selectTower(tower.id);

    expect(fresh.unlockItemSlotOnSelectedTower(1)).toBe(true);
    expect(fresh.getSelectedTowerUnlockedSlots()[1]).toBe(true);
    expect(fresh.getSelectedTowerItemSlots()[1]).toBeNull();

    const item = makeItem("mosswood_charm");
    inject(fresh, [item]);
    fresh.equipItemOnSelectedTower(item.instanceId, 1);
    fresh.unequipItemFromSelectedTower(1);

    // Removing the equipped item must never re-lock the slot.
    expect(fresh.getSelectedTowerUnlockedSlots()[1]).toBe(true);
    expect(fresh.getSelectedTowerItemSlots()[1]).toBeNull();
  });

  it("equipping into a locked slot is refused — unlocking is a prerequisite for equipping, not the other way around", () => {
    const engine = setupUnfunded();
    const item = makeItem("ancient_core");
    inject(engine, [item]);

    expect(engine.canEquipItemOnSelectedTower(item.instanceId, 1)).toBe(false);
    expect(engine.equipItemOnSelectedTower(item.instanceId, 1)).toBe(false);
    expect(engine.getSelectedTowerItemSlots()[1]).toBeNull();
  });
});
