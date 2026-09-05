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

  it("CORREÇÃO DE REQUISITOS: a skin cannot be equipped until purchased with Gems, even at/above its unlockLevel", () => {
    updateSave({
      gems: 999_999,
      towerLoadout: [
        { slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 20, specializationId: null, specializationLevel: 0, equippedSkinId: null },
      ],
    });
    const engine2 = new GameEngine();
    engine2.startRun();
    const tower = engine2.getRenderSnapshot().towers[0]!;
    engine2.selectTower(tower.id);

    expect(engine2.isTowerSkinOwned("IRONWOOD_WARDEN_OF_THE_ABYSS")).toBe(false);
    expect(engine2.equipSkinOnSelectedTower("IRONWOOD_WARDEN_OF_THE_ABYSS")).toBe(false);
    expect(engine2.getRenderSnapshot().towers[0]!.equippedSkinId).toBeNull();
  });

  it("CORREÇÃO DE REQUISITOS: purchasing a skin costs Gems (never Gold), grants PERMANENT ownership, and only then can it be equipped/cleared with no further currency touched", () => {
    updateSave({
      gold: 999_999,
      gems: 999_999,
      towerLoadout: [
        { slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 20, specializationId: null, specializationLevel: 0, equippedSkinId: null },
      ],
    });
    const engine2 = new GameEngine();
    engine2.startRun();
    const tower = engine2.getRenderSnapshot().towers[0]!;
    engine2.selectTower(tower.id);

    const goldBefore = engine2.getHudSnapshot().gold;
    const gemsBefore = engine2.getHudSnapshot().gems;
    const gemCost = engine2.getTowerSkinGemCost("IRONWOOD_WARDEN_OF_THE_ABYSS");
    expect(gemCost).toBeGreaterThan(0);

    expect(engine2.purchaseTowerSkin("IRONWOOD_WARDEN_OF_THE_ABYSS")).toBe(true);
    expect(engine2.getHudSnapshot().gold).toBe(goldBefore); // Gold never touched
    expect(engine2.getHudSnapshot().gems).toBe(gemsBefore - gemCost!);
    expect(engine2.isTowerSkinOwned("IRONWOOD_WARDEN_OF_THE_ABYSS")).toBe(true);

    const goldAfterPurchase = engine2.getHudSnapshot().gold;
    expect(engine2.equipSkinOnSelectedTower("IRONWOOD_WARDEN_OF_THE_ABYSS")).toBe(true);
    expect(engine2.getHudSnapshot().gold).toBe(goldAfterPurchase);
    expect(engine2.getRenderSnapshot().towers[0]!.equippedSkinId).toBe("IRONWOOD_WARDEN_OF_THE_ABYSS");

    expect(engine2.equipSkinOnSelectedTower(null)).toBe(true);
    expect(engine2.getRenderSnapshot().towers[0]!.equippedSkinId).toBeNull();

    // Cannot purchase a second time once already owned.
    expect(engine2.purchaseTowerSkin("IRONWOOD_WARDEN_OF_THE_ABYSS")).toBe(false);
  });

  it("CORREÇÃO DE REQUISITOS: a purchased skin survives a reload — ownership is permanent, not tied to the current tower level", () => {
    updateSave({
      gems: 999_999,
      towerLoadout: [{ slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 20 }],
    });
    const first = new GameEngine();
    first.startRun();
    first.selectTower(first.getRenderSnapshot().towers[0]!.id);
    expect(first.purchaseTowerSkin("IRONWOOD_WARDEN_OF_THE_ABYSS")).toBe(true);
    first.equipSkinOnSelectedTower("IRONWOOD_WARDEN_OF_THE_ABYSS");

    // Simulate a Season reset dropping the tower back to level 1 — ownership
    // and the equipped choice must both survive it (see AscensionManager.test.ts).
    updateSave({ towerLoadout: [{ slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 1 }] });

    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.isTowerSkinOwned("IRONWOOD_WARDEN_OF_THE_ABYSS")).toBe(true);
    expect(reloaded.getRenderSnapshot().towers[0]!.equippedSkinId).toBe("IRONWOOD_WARDEN_OF_THE_ABYSS");
  });

  describe("Tower Mastery funded by Gems (CORREÇÃO DE REQUISITOS — was Gold before)", () => {
    it("upgrading Mastery spends Gems, never Gold, and persists permanently across a reload", () => {
      const engine = startWithOneMaxedTower();
      const goldBefore = engine.getHudSnapshot().gold;
      const gemsBefore = engine.getHudSnapshot().gems;

      expect(engine.upgradeSelectedTowerMastery()).toBe(true);
      expect(engine.getHudSnapshot().gold).toBe(goldBefore); // Gold untouched
      expect(engine.getHudSnapshot().gems).toBeLessThan(gemsBefore); // Gems spent
      expect(engine.getRenderSnapshot().towers[0]!.masteryLevel).toBe(1);

      const reloaded = new GameEngine();
      reloaded.startRun();
      expect(reloaded.getRenderSnapshot().towers[0]!.masteryLevel).toBe(1);
    });

    it("fails without enough Gems even when Gold is abundant", () => {
      updateSave({
        gold: 999_999,
        gems: 0,
        towerLoadout: [{ slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 1 }],
      });
      const engine = new GameEngine();
      engine.startRun();
      engine.selectTower(engine.getRenderSnapshot().towers[0]!.id);
      expect(engine.upgradeSelectedTowerMastery()).toBe(false);
      expect(engine.getRenderSnapshot().towers[0]!.masteryLevel).toBe(0);
    });
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

  describe("Gem Conversion button eligibility (AUDITORIA E CORREÇÃO GERAL spec section 14-15)", () => {
    // GameEngine.canConvertGemShards is the SAME rule InventoryPanel's
    // button-disabled state uses (spec section 15: "a mesma função/regra
    // deve ser usada por UI, clique, validação") — testing the static
    // predicate here covers the UI's own logic by construction, since it's
    // not duplicated anywhere else.
    const rate = GameEngine.GEM_SHARD_TO_GEM_RATE;

    it("0 shards -> DISABLED", () => {
      expect(GameEngine.canConvertGemShards(0)).toBe(false);
    });

    it("below the rate -> DISABLED", () => {
      expect(GameEngine.canConvertGemShards(rate - 1)).toBe(false);
    });

    it("exactly at the rate -> ENABLED", () => {
      expect(GameEngine.canConvertGemShards(rate)).toBe(true);
    });

    it("above the rate -> ENABLED", () => {
      expect(GameEngine.canConvertGemShards(rate + 5)).toBe(true);
    });

    it("convertGemShards() itself agrees with canConvertGemShards() at every boundary — they can never disagree since one calls the other", () => {
      for (const shards of [0, rate - 1, rate, rate + 1, rate * 3 + 7]) {
        updateSave({ gemShards: shards, gems: 0 });
        const engine = new GameEngine();
        engine.startRun();
        expect(engine.convertGemShards()).toBe(GameEngine.canConvertGemShards(shards));
      }
    });

    it("a double click (two synchronous calls) never double-converts — the second call only sees whatever shards are left", () => {
      updateSave({ gemShards: rate + 3, gems: 0 });
      const engine = new GameEngine();
      engine.startRun();
      expect(engine.convertGemShards()).toBe(true); // converts `rate` shards -> 1 Gem, 3 left over
      expect(engine.getGemBalance()).toBe(1);
      expect(engine.convertGemShards()).toBe(false); // 3 remaining shards < rate, correctly refused
      expect(engine.getGemBalance()).toBe(1); // unchanged — no double-grant
    });

    it("F5 after converting: the new Gems/remaining Shards balance persists exactly, never re-converts on reload", () => {
      updateSave({ gemShards: rate * 2, gems: 0 });
      const first = new GameEngine();
      first.startRun();
      first.convertGemShards();
      expect(first.getGemBalance()).toBe(2);
      expect(first.getGemShardBalance()).toBe(0);

      const reloaded = new GameEngine();
      reloaded.startRun();
      expect(reloaded.getGemBalance()).toBe(2);
      expect(reloaded.getGemShardBalance()).toBe(0);
    });
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
