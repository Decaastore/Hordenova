import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { applySpecializationToSpecial, SPECIALIZATION_UNLOCK_TOWER_LEVEL } from "@/config/specializations";
import { getTowerSpecialAtLevel } from "@/config/towerStats";
import { getSpecializationUpgradeCostFor } from "@/entities/Tower";
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

  describe("Tower Mastery — one-time Gems unlock, then Gold forever (INFINITE BALANCE OVERHAUL)", () => {
    it("unlocking Mastery spends Gems, never Gold, grants ownership only (never a free level), and ownership persists permanently across a reload", () => {
      const engine = startWithOneMaxedTower();
      const goldBefore = engine.getHudSnapshot().gold;
      const gemsBefore = engine.getHudSnapshot().gems;

      expect(engine.canUnlockSelectedTowerMastery()).toBe(true);
      expect(engine.unlockSelectedTowerMastery()).toBe(true);
      expect(engine.getHudSnapshot().gold).toBe(goldBefore); // Gold untouched
      expect(engine.getHudSnapshot().gems).toBeLessThan(gemsBefore); // Gems spent
      expect(engine.getRenderSnapshot().towers[0]!.masteryUnlocked).toBe(true);
      expect(engine.getRenderSnapshot().towers[0]!.masteryLevel).toBe(0); // ownership grants no free level
      expect(engine.canUnlockSelectedTowerMastery()).toBe(false); // one-time only

      const reloaded = new GameEngine();
      reloaded.startRun();
      expect(reloaded.getRenderSnapshot().towers[0]!.masteryUnlocked).toBe(true);
    });

    it("every level AFTER the unlock spends Gold, never Gems", () => {
      const engine = startWithOneMaxedTower();
      expect(engine.unlockSelectedTowerMastery()).toBe(true);
      const gemsAfterUnlock = engine.getHudSnapshot().gems;
      const goldBefore = engine.getHudSnapshot().gold;

      expect(engine.upgradeSelectedTowerMastery()).toBe(true);
      expect(engine.getHudSnapshot().gems).toBe(gemsAfterUnlock); // Gems untouched
      expect(engine.getHudSnapshot().gold).toBeLessThan(goldBefore); // Gold spent
      expect(engine.getRenderSnapshot().towers[0]!.masteryLevel).toBe(1);
    });

    it("unlock fails without enough Gems even when Gold is abundant", () => {
      updateSave({
        gold: 999_999,
        gems: 0,
        towerLoadout: [{ slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 1 }],
      });
      const engine = new GameEngine();
      engine.startRun();
      engine.selectTower(engine.getRenderSnapshot().towers[0]!.id);
      expect(engine.unlockSelectedTowerMastery()).toBe(false);
      expect(engine.getRenderSnapshot().towers[0]!.masteryLevel).toBe(0);
    });

    it("upgrade fails before the track is unlocked, even with abundant Gold", () => {
      const engine = startWithOneMaxedTower();
      expect(engine.getRenderSnapshot().towers[0]!.masteryLevel).toBe(0);
      expect(engine.upgradeSelectedTowerMastery()).toBe(false);
      expect(engine.getRenderSnapshot().towers[0]!.masteryLevel).toBe(0);
    });

    // Mastery grants real but modest combat bonuses now (see
    // entities/Tower.test.ts's own dedicated coverage) — this suite proves
    // Mastery ownership (400 Gems, permanent, never re-charged) is wired
    // correctly end-to-end through GameEngine, deterministically.
    it("unlockSelectedTowerMastery charges the 400 Gems ownership cost exactly once, ever, and a reload never re-charges it", () => {
      const engine = startWithOneMaxedTower();
      const tower = engine.getRenderSnapshot().towers[0]!;
      const gemsBefore = engine.getHudSnapshot().gems;

      expect(engine.canUnlockSelectedTowerMastery()).toBe(true);
      expect(engine.unlockSelectedTowerMastery()).toBe(true);
      expect(engine.getHudSnapshot().gems).toBe(gemsBefore - 400);
      expect(engine.getRenderSnapshot().towers[0]!.masteryUnlocked).toBe(true);
      // Ownership is granted for free — the level is untouched.
      expect(engine.getRenderSnapshot().towers[0]!.masteryLevel).toBe(0);

      // Already owned — never re-charged, on this engine or a fresh reload.
      expect(engine.canUnlockSelectedTowerMastery()).toBe(false);
      expect(engine.unlockSelectedTowerMastery()).toBe(false);
      expect(engine.getHudSnapshot().gems).toBe(gemsBefore - 400);

      const reloaded = new GameEngine();
      reloaded.startRun();
      reloaded.selectTower(tower.id);
      expect(reloaded.getRenderSnapshot().towers[0]!.masteryUnlocked).toBe(true);
      expect(reloaded.canUnlockSelectedTowerMastery()).toBe(false);
      expect(reloaded.unlockSelectedTowerMastery()).toBe(false);
      expect(reloaded.getHudSnapshot().gems).toBe(gemsBefore - 400);
    });
  });

  describe("\"Trocar Especialização\" — HORDENOVA Season/Progression v1.0 ownership/switch model", () => {
    it("choosing a never-before-owned path costs 500 Gems and records permanent ownership", () => {
      const engine = startWithOneMaxedTower();
      const gemsBefore = engine.getHudSnapshot().gems;
      expect(engine.isSpecializationUnlocked("IRONWOOD", "IRONWOOD_EXECUTIONER")).toBe(false);

      expect(engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER")).toBe(true);
      expect(engine.getHudSnapshot().gems).toBe(gemsBefore - 500);
      expect(engine.isSpecializationUnlocked("IRONWOOD", "IRONWOOD_EXECUTIONER")).toBe(true);
      expect(engine.getRenderSnapshot().towers[0]!.specializationId).toBe("IRONWOOD_EXECUTIONER");
    });

    it("re-choosing an already-owned path (e.g. after a Season reset cleared the active pick) is free — ownership is never re-charged", () => {
      const engine = startWithOneMaxedTower();
      expect(engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER")).toBe(true);
      const gemsAfterFirstChoice = engine.getHudSnapshot().gems;

      // Simulate a Season reset clearing the active pick — ownership
      // (unlockedSpecializationIds, permanent) persists in the save
      // regardless; only the loadout's active specializationId/Level reset.
      updateSave({
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
      const reloaded = new GameEngine();
      reloaded.startRun();
      reloaded.selectTower(reloaded.getRenderSnapshot().towers[0]!.id);

      expect(reloaded.isSpecializationUnlocked("IRONWOOD", "IRONWOOD_EXECUTIONER")).toBe(true);
      expect(reloaded.chooseTowerSpecialization("IRONWOOD_EXECUTIONER")).toBe(true);
      expect(reloaded.getHudSnapshot().gems).toBe(gemsAfterFirstChoice);
      expect(reloaded.getRenderSnapshot().towers[0]!.specializationId).toBe("IRONWOOD_EXECUTIONER");
    });

    it("switching between two already-owned paths costs a flat 200 Gems, regardless of level", () => {
      // Both paths are pre-seeded as already owned (e.g. picked in different
      // past Seasons) — chooseTowerSpecialization only ever accepts a NEW
      // pick from an unchosen (null) state, so acquiring a 2nd owned path
      // for the same active tower within one Season goes through this
      // pre-seeded-ownership route, not two consecutive "choose" calls.
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
        unlockedSpecializationIds: { IRONWOOD: ["IRONWOOD_EXECUTIONER", "IRONWOOD_BREAKER"] },
      });
      const engine = new GameEngine();
      engine.startRun();
      engine.selectTower(engine.getRenderSnapshot().towers[0]!.id);

      expect(engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER")).toBe(true); // free, already owned
      const gemsBeforeSwitch = engine.getHudSnapshot().gems;

      expect(engine.canSwitchSelectedTowerSpecialization("IRONWOOD_BREAKER")).toBe(true);
      expect(engine.switchTowerSpecialization("IRONWOOD_BREAKER")).toBe(true);
      expect(engine.getHudSnapshot().gems).toBe(gemsBeforeSwitch - 200);
      expect(engine.getRenderSnapshot().towers[0]!.specializationId).toBe("IRONWOOD_BREAKER");
      expect(engine.getRenderSnapshot().towers[0]!.specializationLevel).toBe(1);
    });

    it("cannot switch to a path never owned — that must go through chooseTowerSpecialization's 500 Gems purchase instead", () => {
      const engine = startWithOneMaxedTower();
      engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER");
      expect(engine.canSwitchSelectedTowerSpecialization("IRONWOOD_VANGUARD")).toBe(false);
      expect(engine.switchTowerSpecialization("IRONWOOD_VANGUARD")).toBe(false);
      expect(engine.getRenderSnapshot().towers[0]!.specializationId).toBe("IRONWOOD_EXECUTIONER");
    });
  });

  // INFINITE BALANCE OVERHAUL — the level track AND the combat effect it
  // grants are BOTH genuinely uncapped end-to-end through GameEngine now
  // (diminishing returns, never a disguised flat cap).
  describe("Specialization is a genuinely uncapped Gold sink, with a diminishing-returns (never capped) combat effect (INFINITE BALANCE OVERHAUL)", () => {
    it("upgradeSelectedTowerSpecialization keeps working, and keeps costing real Gold, FAR past the old level-5 cap", () => {
      const engine = startWithOneMaxedTower();
      engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER");

      let previousCost = 0;
      for (let level = 1; level <= 50; level++) {
        const tower = engine.getRenderSnapshot().towers[0]!;
        const cost = getSpecializationUpgradeCostFor(tower);
        expect(cost).not.toBeNull();
        expect(cost!).toBeGreaterThan(previousCost);
        previousCost = cost!;
        expect(engine.upgradeSelectedTowerSpecialization()).toBe(true);
      }

      const tower = engine.getRenderSnapshot().towers[0]!;
      expect(tower.specializationLevel).toBe(51); // 1 (choice) + 50 upgrades
      expect(Number.isFinite(getSpecializationUpgradeCostFor(tower))).toBe(true);
    });

    it("the specialization's combat-relevant stats (read through the exact same pipeline CombatSystem uses) KEEP growing past the old level-5 cap, even though the growth per level shrinks", () => {
      const engine = startWithOneMaxedTower();
      engine.chooseTowerSpecialization("IRONWOOD_EXECUTIONER");
      for (let i = 0; i < 4; i++) engine.upgradeSelectedTowerSpecialization(); // level 1 -> 5 (the OLD cap)

      const readEffect = () => {
        const tower = engine.getRenderSnapshot().towers[0]!;
        const base = getTowerSpecialAtLevel(tower.type, tower.level);
        return applySpecializationToSpecial(base, tower.specializationId, tower.specializationLevel);
      };

      const effectAtOldCap = readEffect();
      for (let i = 0; i < 20; i++) engine.upgradeSelectedTowerSpecialization(); // level 5 -> 25
      const effectAtLevel25 = readEffect();

      expect(effectAtLevel25).not.toEqual(effectAtOldCap);
      if (effectAtLevel25.type !== "IRONWOOD" || effectAtOldCap.type !== "IRONWOOD") throw new Error("unreachable");
      expect(effectAtLevel25.critMultiplier).toBeGreaterThan(effectAtOldCap.critMultiplier);
      expect(engine.getRenderSnapshot().towers[0]!.specializationLevel).toBe(25);
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

  it("HORDENOVA balance correction: a Main Boss kill grants exactly 1 Gem Shard, a Mini-Boss kill exactly 1, at Prestige level 0", () => {
    // bestWave preset well past both test waves so that the wave advancing
    // past the kill never ALSO crosses a fresh wave-milestone bonus (a
    // separate Gem Shard source, see GameEngine.advanceBestWave) in the same
    // tick as the boss kill — isolating the boss-kill grant on its own.
    updateSave({ currentWave: 30, bestWave: 999, gold: 999_999, towerLoadout: [] }); // wave 30 = Ancient Forest's main boss wave
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getPrestigeLevel()).toBe(0);

    let iterations = 0;
    while (engine.getHudSnapshot().bossHp === null && iterations < 2000) {
      engine.update(50);
      iterations++;
    }
    const mainBoss = engine.getRenderSnapshot().enemies.find((e) => e.boss?.isMainBoss);
    expect(mainBoss).toBeDefined();
    const shardsBeforeKill = engine.getGemShardBalance();
    mainBoss!.hp = 0;
    engine.update(50);
    expect(engine.getGemShardBalance() - shardsBeforeKill).toBe(1);

    updateSave({ currentWave: 21, bestWave: 999, gold: 999_999, towerLoadout: [] }); // a mini-boss wave, no main boss
    const engine2 = new GameEngine();
    engine2.startRun();
    let miniBoss = null;
    for (let i = 0; i < 300 && !miniBoss; i++) {
      engine2.update(100);
      miniBoss = engine2.getRenderSnapshot().enemies.find((e) => e.boss && !e.boss.isMainBoss) ?? null;
    }
    expect(miniBoss).toBeTruthy();
    const shardsBeforeMiniKill = engine2.getGemShardBalance();
    miniBoss!.hp = 0;
    engine2.update(50);
    expect(engine2.getGemShardBalance() - shardsBeforeMiniKill).toBe(1);
  });

  it("gem shard conversion only fires at the fixed rate and never leaves a partial remainder unconverted-but-lost", () => {
    const engine = new GameEngine();
    engine.startRun();
    // No public "addGemShards" — drive it via the documented static rate constant instead of hand-editing private state.
    const rate = GameEngine.GEM_SHARD_TO_GEM_RATE;
    expect(rate).toBe(10); // HORDENOVA Season/Progression v1.0 contract: 10 shards = 1 Gem
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

  describe("Profile Prestige (HORDENOVA Season/Progression v1.0 — requires bestWave >= 100, permanent, Gems-funded)", () => {
    it("starts at level 0 and spends Gems (never Gold) on upgrade, once bestWave requirement is met", () => {
      updateSave({ gems: 1000, gold: 500, bestWave: 100 });
      const engine = new GameEngine();
      engine.startRun();
      expect(engine.getPrestigeLevel()).toBe(0);

      const goldBefore = engine.getHudSnapshot().gold;
      const gemsBefore = engine.getHudSnapshot().gems;
      expect(engine.canUpgradePrestige()).toBe(true);
      expect(engine.upgradePrestige()).toBe(true);
      expect(engine.getPrestigeLevel()).toBe(1);
      expect(engine.getHudSnapshot().gold).toBe(goldBefore); // Gold untouched
      expect(engine.getHudSnapshot().gems).toBeLessThan(gemsBefore); // Gems spent
    });

    it("blocked below the bestWave 100 requirement, even with abundant Gems", () => {
      updateSave({ gems: 1_000_000, bestWave: 99 });
      const engine = new GameEngine();
      engine.startRun();
      expect(engine.canUpgradePrestige()).toBe(false);
      expect(engine.upgradePrestige()).toBe(false);
      expect(engine.getPrestigeLevel()).toBe(0);
    });

    it("fails without enough Gems, and nothing is applied on the failed attempt", () => {
      updateSave({ gems: 0, bestWave: 100 });
      const engine = new GameEngine();
      engine.startRun();
      expect(engine.upgradePrestige()).toBe(false);
      expect(engine.getPrestigeLevel()).toBe(0);
    });

    it("is genuinely uncapped — many consecutive purchases keep succeeding given enough Gems", () => {
      updateSave({ gems: 1_000_000, bestWave: 100 });
      const engine = new GameEngine();
      engine.startRun();
      for (let i = 0; i < 50; i++) expect(engine.upgradePrestige()).toBe(true);
      expect(engine.getPrestigeLevel()).toBe(50);
    });

    it("persists across a reload", () => {
      updateSave({ gems: 1_000_000, bestWave: 100 });
      const first = new GameEngine();
      first.startRun();
      first.upgradePrestige();
      first.upgradePrestige();

      const reloaded = new GameEngine();
      reloaded.startRun();
      expect(reloaded.getPrestigeLevel()).toBe(2);
    });

    it("at level 40 (the functional cap), the +20% Gem Shard multiplier still applies to the base rate — with a base of 1, Math.round keeps it at 1 (rounding, not a lost bonus: the multiplier is still wired, see prestige.test.ts for its own +20% contract)", () => {
      updateSave({ currentWave: 30, gold: 999_999, gems: 0, prestigeLevel: 40, bestWave: 100, towerLoadout: [] });
      const engine = new GameEngine();
      engine.startRun();
      expect(engine.getCurrentPrestigeBonuses().gemShardMultiplier).toBeCloseTo(1.2, 5);

      let iterations = 0;
      while (engine.getHudSnapshot().bossHp === null && iterations < 2000) {
        engine.update(50);
        iterations++;
      }
      const mainBoss = engine.getRenderSnapshot().enemies.find((e) => e.boss?.isMainBoss);
      expect(mainBoss).toBeDefined();
      const shardsBeforeKill = engine.getGemShardBalance();
      mainBoss!.hp = 0;
      engine.update(50);
      expect(engine.getGemShardBalance() - shardsBeforeKill).toBe(1);
    });
  });
});
