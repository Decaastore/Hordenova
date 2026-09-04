import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { SPECIALIZATION_UNLOCK_TOWER_LEVEL } from "@/config/specializations";
import { DEFAULT_INVENTORY_CAPACITY } from "./InventoryManager";

describe("GameEngine — Progression 2.0: Specialization, Skins, Gems, Inventory Capacity", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function startWithOneMaxedTower(): GameEngine {
    updateSave({
      currentWave: 1,
      gold: 999_999,
      gems: 999_999,
      towerLoadout: [
        {
          slotId: TOWER_SLOTS[0]!.id,
          type: "IRONWOOD",
          level: SPECIALIZATION_UNLOCK_TOWER_LEVEL,
          specializationId: null,
          specializationLevel: 0,
          equippedSkinId: null,
        },
      ],
    });
    const engine = new GameEngine();
    engine.startRun();
    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);
    return engine;
  }

  it("cannot choose a specialization before the unlock level, and gold is untouched on the failed attempt", () => {
    updateSave({
      currentWave: 1,
      gold: 999_999,
      towerLoadout: [{ slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 1 }],
    });
    const engine = new GameEngine();
    engine.startRun();
    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);

    const goldBefore = engine.getHudSnapshot().gold;
    expect(engine.canChooseSpecializationForSelectedTower()).toBe(false);
    expect(engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER")).toBe(false);
    expect(engine.getHudSnapshot().gold).toBe(goldBefore);
  });

  it("choosing a specialization spends Gems (never Gold) and is reflected on the tower instance", () => {
    const engine = startWithOneMaxedTower();
    const goldBefore = engine.getHudSnapshot().gold;
    const gemsBefore = engine.getHudSnapshot().gems;

    expect(engine.canChooseSpecializationForSelectedTower()).toBe(true);
    expect(engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER")).toBe(true);

    // Visual Overhaul spec section 21: the CHOICE is a Gems purchase — Gold
    // must be completely untouched by it.
    expect(engine.getHudSnapshot().gold).toBe(goldBefore);
    expect(engine.getHudSnapshot().gems).toBeLessThan(gemsBefore);
    const tower = engine.getRenderSnapshot().towers[0]!;
    expect(tower.specializationId).toBe("IRONWOOD_EXECUTIONER");
    expect(tower.specializationLevel).toBe(1);
  });

  it("cannot choose a specialization without enough Gems, and nothing is applied on the failed attempt", () => {
    updateSave({
      currentWave: 1,
      gold: 999_999,
      gems: 0,
      towerLoadout: [
        {
          slotId: TOWER_SLOTS[0]!.id,
          type: "IRONWOOD",
          level: SPECIALIZATION_UNLOCK_TOWER_LEVEL,
          specializationId: null,
          specializationLevel: 0,
          equippedSkinId: null,
        },
      ],
    });
    const engine = new GameEngine();
    engine.startRun();
    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);

    expect(engine.canChooseSpecializationForSelectedTower()).toBe(true);
    expect(engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER")).toBe(false);
    expect(engine.getRenderSnapshot().towers[0]!.specializationId).toBeNull();
    expect(engine.getHudSnapshot().gems).toBe(0);
  });

  it("upgrading a chosen specialization increments its level and spends more Gold each time (Gems untouched past the initial choice)", () => {
    const engine = startWithOneMaxedTower();
    engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER");
    const goldAfterChoice = engine.getHudSnapshot().gold;
    const gemsAfterChoice = engine.getHudSnapshot().gems;

    expect(engine.upgradeSelectedTowerSpecialization()).toBe(true);
    expect(engine.getHudSnapshot().gold).toBeLessThan(goldAfterChoice);
    expect(engine.getHudSnapshot().gems).toBe(gemsAfterChoice);
    expect(engine.getRenderSnapshot().towers[0]!.specializationLevel).toBe(2);
  });

  it("equipping a skin never changes gold and is purely cosmetic on the tower instance", () => {
    // Bump level past the skin's unlockLevel (15) directly via a re-seeded
    // save rather than many real upgrades — this test is about the skin
    // wiring, not level progression.
    updateSave({
      towerLoadout: [
        { slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 20, specializationId: null, specializationLevel: 0, equippedSkinId: null },
      ],
    });
    const engine2 = new GameEngine();
    engine2.startRun();
    const tower = engine2.getRenderSnapshot().towers[0]!;
    engine2.selectTower(tower.id);

    const goldBefore = engine2.getHudSnapshot().gold;
    expect(engine2.equipSkinOnSelectedTower("IRONWOOD_WARDEN_OF_THE_ABYSS")).toBe(true);
    expect(engine2.getHudSnapshot().gold).toBe(goldBefore);
    expect(engine2.getRenderSnapshot().towers[0]!.equippedSkinId).toBe("IRONWOOD_WARDEN_OF_THE_ABYSS");

    expect(engine2.equipSkinOnSelectedTower(null)).toBe(true);
    expect(engine2.getRenderSnapshot().towers[0]!.equippedSkinId).toBeNull();
  });

  it("gem balance starts at 0 and is exposed on the HUD snapshot", () => {
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getGemBalance()).toBe(0);
    expect(engine.getHudSnapshot().gems).toBe(0);
    expect(engine.getHudSnapshot().gemShards).toBe(0);
  });

  it("defeating a main boss grants gem shards (spec section 34) with no UI-side mutation path", () => {
    updateSave({ currentWave: 30, gold: 999_999, towerLoadout: [] }); // wave 30 = Ancient Forest's main boss wave
    const engine = new GameEngine();
    engine.startRun();

    let iterations = 0;
    while (engine.getHudSnapshot().bossHp === null && iterations < 2000) {
      engine.update(50);
      iterations++;
    }
    expect(engine.getHudSnapshot().bossHp).not.toBeNull();

    // Force the kill deterministically instead of waiting out real combat —
    // this test is about the gem-shard reward wiring, not boss DPS timing.
    const snapshot = engine.getRenderSnapshot();
    const boss = snapshot.enemies.find((e) => e.boss);
    expect(boss).toBeDefined();
    boss!.hp = 0;
    engine.update(50);

    expect(engine.getGemShardBalance()).toBeGreaterThan(0);
  });

  it("gem shard conversion only fires at the fixed rate and never leaves a partial remainder unconverted-but-lost", () => {
    const engine = new GameEngine();
    engine.startRun();
    // No public "addGemShards" — drive it via the documented static rate constant instead of hand-editing private state.
    const rate = GameEngine.GEM_SHARD_TO_GEM_RATE;
    expect(engine.convertGemShards()).toBe(false); // 0 shards, can't convert

    // Simulate having shards by reloading a save that already has some.
    updateSave({ gemShards: rate * 2 + 3 });
    const engine2 = new GameEngine();
    engine2.startRun();
    expect(engine2.convertGemShards()).toBe(true);
    expect(engine2.getGemBalance()).toBe(2);
    expect(engine2.getGemShardBalance()).toBe(3); // the remainder stays as shards, not discarded
  });

  it("inventory capacity defaults to DEFAULT_INVENTORY_CAPACITY and overflow starts empty", () => {
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getInventoryCapacity()).toBe(DEFAULT_INVENTORY_CAPACITY);
    expect(engine.getOverflowInventory()).toEqual([]);
  });

  describe("Profile Prestige (Master Implementation Pass spec section 7-8)", () => {
    it("starts at level 0 and spends Gems (never Gold) on upgrade", () => {
      updateSave({ gems: 100, gold: 500 });
      const engine = new GameEngine();
      engine.startRun();
      expect(engine.getPrestigeLevel()).toBe(0);

      const goldBefore = engine.getHudSnapshot().gold;
      expect(engine.upgradePrestige()).toBe(true);
      expect(engine.getPrestigeLevel()).toBe(1);
      expect(engine.getHudSnapshot().gold).toBe(goldBefore); // Gold untouched
      expect(engine.getGemBalance()).toBeLessThan(100); // Gems spent
    });

    it("fails without enough Gems, and nothing is applied on the failed attempt", () => {
      updateSave({ gems: 0 });
      const engine = new GameEngine();
      engine.startRun();
      expect(engine.upgradePrestige()).toBe(false);
      expect(engine.getPrestigeLevel()).toBe(0);
    });

    it("is genuinely uncapped — many consecutive purchases keep succeeding given enough Gems", () => {
      updateSave({ gems: 1_000_000 });
      const engine = new GameEngine();
      engine.startRun();
      for (let i = 0; i < 50; i++) expect(engine.upgradePrestige()).toBe(true);
      expect(engine.getPrestigeLevel()).toBe(50);
    });

    it("persists across a reload", () => {
      updateSave({ gems: 1_000_000 });
      const first = new GameEngine();
      first.startRun();
      first.upgradePrestige();
      first.upgradePrestige();

      const reloaded = new GameEngine();
      reloaded.startRun();
      expect(reloaded.getPrestigeLevel()).toBe(2);
    });
  });
});
