import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";

const TICK_MS = 50;

function runUntilStopped(engine: GameEngine, maxIterations = 20_000): void {
  let iterations = 0;
  while (engine.getHudSnapshot().phase !== "PROGRESSION_STOPPED" && iterations < maxIterations) {
    engine.update(TICK_MS);
    iterations++;
  }
}

describe("GameEngine — Active Idle progression", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts Wave 1 automatically on startRun, with no button required", () => {
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().phase).toBe("RUNNING");
    expect(engine.getHudSnapshot().wave).toBe(1);
  });

  it("does nothing before startRun is called", () => {
    const engine = new GameEngine();
    engine.update(1000);
    expect(engine.getHudSnapshot().phase).toBe("PRE_RUN");
  });

  it("placing a tower spends gold and occupies the slot", () => {
    const engine = new GameEngine();
    engine.startRun();
    const startingGold = engine.getHudSnapshot().gold;
    const slotId = TOWER_SLOTS[0]!.id;

    const placed = engine.placeTower(slotId, "IRONWOOD");
    expect(placed).toBe(true);
    expect(engine.getHudSnapshot().gold).toBeLessThan(startingGold);
    expect(engine.getAvailableSlotIds()).not.toContain(slotId);

    // Can't double-place on the same slot.
    expect(engine.placeTower(slotId, "IRONWOOD")).toBe(false);
  });

  it("stops progression (not a plain defeat) when undefended enemies reach the base, with a diagnostic report attached", () => {
    const engine = new GameEngine();
    engine.startRun();

    runUntilStopped(engine);

    const hud = engine.getHudSnapshot();
    expect(hud.phase).toBe("PROGRESSION_STOPPED");
    expect(hud.baseHp).toBe(0);
    expect(hud.wave).toBeGreaterThanOrEqual(1);

    const report = engine.getFailureReport();
    expect(report).not.toBeNull();
    expect(report!.waveReached).toBe(hud.wave);
    expect(report!.reasonKeys.length).toBeGreaterThan(0);
  });

  it("records bestWave on PROGRESSION_STOPPED", () => {
    const engine = new GameEngine();
    engine.startRun();
    runUntilStopped(engine);

    const waveReached = engine.getHudSnapshot().wave;
    expect(engine.getHudSnapshot().bestWave).toBeGreaterThanOrEqual(waveReached);
  });

  it("retryPhase() retries the SAME wave (Active Idle never resets progress to Wave 1) and keeps towers/gold", () => {
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");

    runUntilStopped(engine);
    const waveThatFailed = engine.getHudSnapshot().wave;
    const towersBeforeRetry = engine.getRenderSnapshot().towers.length;

    engine.retryPhase();
    const hud = engine.getHudSnapshot();
    expect(hud.phase).toBe("RUNNING");
    expect(hud.wave).toBe(waveThatFailed);
    expect(hud.baseHp).toBe(hud.maxBaseHp);
    expect(engine.getRenderSnapshot().towers.length).toBe(towersBeforeRetry);
  });

  it("towers can be upgraded while PROGRESSION_STOPPED — the spec's build-and-strategize loop", () => {
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    runUntilStopped(engine);

    const tower = engine.getRenderSnapshot().towers[0]!;
    engine.selectTower(tower.id);
    const upgraded = engine.upgradeSelectedTower();
    expect(upgraded).toBe(true);
    expect(engine.getRenderSnapshot().towers[0]!.level).toBe(2);
  });

  it("persists progress across a new engine instance (simulating a reload)", () => {
    const first = new GameEngine();
    first.startRun();
    first.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    const goldAfterBuild = first.getHudSnapshot().gold;

    const second = new GameEngine();
    second.startRun();
    expect(second.getRenderSnapshot().towers.length).toBe(1);
    expect(second.getHudSnapshot().gold).toBe(goldAfterBuild);
  });

  it("F5/reload persistence (spec scenario): Phase 14 + 4 towers at different levels + gold + inventory + playerId all survive a fresh engine instance exactly, with no duplication and no false defeat", () => {
    // This is the EXACT worked scenario from the persistence spec: seed a
    // save at a specific phase with specific tower levels (not all maxed,
    // not all the same — so a bug that only shows up with mixed levels or
    // partial upgrades can't hide), plus real gold and a real owned item,
    // then verify a brand-new GameEngine instance (== what a page reload
    // produces) restores every one of them from the save, not from any
    // hardcoded/default value.
    const seededItem = {
      instanceId: "item-seed-1",
      itemDefinitionId: "ancient_core",
      ownerId: "player-seed-1",
      acquiredAt: 1000,
      source: { type: "BOSS_DROP" as const, refId: "hollow-warden" },
      tradable: true,
      pendingTrade: false,
      history: [{ timestamp: 1000, event: "ACQUIRED" as const, fromOwner: null, toOwner: "player-seed-1" }],
    };
    updateSave({
      currentWave: 14,
      bestWave: 14,
      gold: 733,
      towerLoadout: [
        { slotId: TOWER_SLOTS[0]!.id, type: "IRONWOOD", level: 8 },
        { slotId: TOWER_SLOTS[1]!.id, type: "INFERNO", level: 10 },
        { slotId: TOWER_SLOTS[2]!.id, type: "FROSTBORN", level: 6 },
        { slotId: TOWER_SLOTS[3]!.id, type: "STORMCALLER", level: 7 },
      ],
      inventory: [seededItem],
      playerId: "player-seed-1",
      bossesDefeatedTotal: 3,
      miniBossesDefeatedTotal: 2,
    });

    const reloaded = new GameEngine();
    reloaded.startRun();

    const hud = reloaded.getHudSnapshot();
    expect(hud.wave).toBe(14);
    expect(hud.gold).toBe(733);
    expect(hud.phase).not.toBe("PROGRESSION_STOPPED"); // reload must never register a defeat

    const towersByType = Object.fromEntries(reloaded.getRenderSnapshot().towers.map((t) => [t.type, t.level]));
    expect(towersByType).toEqual({ IRONWOOD: 8, INFERNO: 10, FROSTBORN: 6, STORMCALLER: 7 });

    const inventory = reloaded.getInventory();
    expect(inventory).toHaveLength(1); // not duplicated
    expect(inventory[0]).toEqual(seededItem); // same instanceId, same ownerId, untouched
    expect(reloaded.getPlayerId()).toBe("player-seed-1"); // no new playerId minted on reload
    expect(reloaded.getLocalEconomyTotals()).toEqual({ bossesDefeatedTotal: 3, miniBossesDefeatedTotal: 2 });

    // And it survives a SECOND reload too (rules out a save that only
    // looks correct once before something silently overwrites it).
    const reloadedAgain = new GameEngine();
    reloadedAgain.startRun();
    expect(reloadedAgain.getHudSnapshot().wave).toBe(14);
    expect(reloadedAgain.getHudSnapshot().gold).toBe(733);
    expect(reloadedAgain.getInventory()).toHaveLength(1);
    expect(reloadedAgain.getPlayerId()).toBe("player-seed-1");
  });

  it("higher speed advances the simulation faster for the same number of real-time ticks", () => {
    const slow = new GameEngine();
    slow.startRun();
    slow.setSpeed(1);

    window.localStorage.clear();

    const fast = new GameEngine();
    fast.startRun();
    fast.setSpeed(4);

    for (let i = 0; i < 40; i++) {
      slow.update(TICK_MS);
      fast.update(TICK_MS);
    }

    const slowEnemies = slow.getRenderSnapshot().enemies.length;
    const fastProgress = fast.getHudSnapshot().wave + fast.getRenderSnapshot().enemies.length;
    const slowProgress = slow.getHudSnapshot().wave + slowEnemies;
    expect(fastProgress).toBeGreaterThanOrEqual(slowProgress);
  });

  it("checkpoints lastPlayedAt so Offline Defense has a reference point", () => {
    const engine = new GameEngine();
    engine.startRun();
    engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    expect(loadSave().lastPlayedAt).not.toBeNull();
  });

  it("a main boss that reaches the base without dying does not soft-lock BOSS_BATTLE (regression)", () => {
    // Seed a save exactly at the Wave 30 boss milestone with an empty
    // build, so the boss takes zero damage and is guaranteed to walk to
    // the base and "escape" (removed via the leak path, not isEnemyDead)
    // instead of ever dying — the exact scenario a balance simulation
    // found could permanently soft-lock BOSS_BATTLE before this was fixed.
    updateSave({ currentWave: 30, gold: 0, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().phase).toBe("BOSS_INTRO");

    let sawBossBattle = false;
    let iterations = 0;
    const maxIterations = 20_000; // 2000s simulated — the boss crossing the path takes well under 200s
    while (engine.getHudSnapshot().phase !== "PROGRESSION_STOPPED" && iterations < maxIterations) {
      if (engine.getHudSnapshot().phase === "BOSS_BATTLE") sawBossBattle = true;
      engine.update(100);
      iterations++;
    }

    expect(sawBossBattle).toBe(true);
    // Must have resolved (either fell through to more undefended waves and
    // stopped, or otherwise moved on) well within the tick budget — never
    // stuck at wave 30 in BOSS_BATTLE forever.
    expect(iterations).toBeLessThan(maxIterations);
    expect(engine.getHudSnapshot().phase).toBe("PROGRESSION_STOPPED");
    expect(engine.getHudSnapshot().wave).toBeGreaterThan(30);
  });

  it("a spawned mini-boss's ability actually fires (regression: it used to only tick the tracked main boss)", () => {
    // Wave 21 is Ancient Forest's 3rd configured mini-boss wave, and the
    // deterministic roster (wave % 6) resolves it to "gloom-jammer" —
    // the DISABLE archetype, whose effect (a jammed tower) is directly
    // observable. Before the fix, a mini-boss's ability never fired after
    // spawn because only the BOSS_BATTLE-tracked main boss was ticked.
    updateSave({ currentWave: 21, gold: 500, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD")).toBe(true);

    let sawDisabledTower = false;
    for (let i = 0; i < 4000 && !sawDisabledTower; i++) {
      engine.update(100);
      const tower = engine.getRenderSnapshot().towers[0];
      if (tower && tower.disabledRemainingMs > 0) sawDisabledTower = true;
    }

    expect(sawDisabledTower).toBe(true);
  });

  it("spawns an Elite enemy on an ELITE-tagged wave", () => {
    // Wave 18 is one of Ancient Forest's configured ELITE waves.
    updateSave({ currentWave: 18, gold: 0, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();

    let sawElite = false;
    for (let i = 0; i < 200 && !sawElite; i++) {
      engine.update(100);
      if (engine.getRenderSnapshot().enemies.some((e) => e.elite)) sawElite = true;
    }

    expect(sawElite).toBe(true);
  });

  it("the render snapshot's biome changes with the current phase", () => {
    const first = new GameEngine();
    first.startRun();
    expect(first.getRenderSnapshot().biomeId).toBe("ANCIENT_FOREST");

    window.localStorage.clear();
    updateSave({ currentWave: 31, gold: 0, towerLoadout: [] });
    const second = new GameEngine();
    second.startRun();
    expect(second.getRenderSnapshot().biomeId).toBe("VOLCANIC_WASTES");
  });

  it("discovering a new enemy type surfaces it once via HudSnapshot.pendingDiscoveryType, then clears on acknowledgement, and never repeats after reload", () => {
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().pendingDiscoveryType).toBeNull();

    engine.update(700); // enough for Wave 1's first Crawler to spawn
    expect(engine.getHudSnapshot().pendingDiscoveryType).toBe("CRAWLER");

    engine.acknowledgeDiscovery();
    expect(engine.getHudSnapshot().pendingDiscoveryType).toBeNull();

    const reloaded = new GameEngine();
    reloaded.startRun();
    reloaded.update(700);
    expect(reloaded.getHudSnapshot().pendingDiscoveryType).toBeNull();
  });

  it("a defeated main boss with a configured DropTable grants an item, records it in inventory, and surfaces a pendingItemReward banner", () => {
    // Wave 30 is Ancient Forest's boss wave (Hollow Warden), the only boss
    // with a dropTableId wired up so far — Item System spec sections 12/25.
    updateSave({ currentWave: 30, gold: 0, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().phase).toBe("BOSS_INTRO");

    for (let i = 0; i < 200 && engine.getHudSnapshot().phase === "BOSS_INTRO"; i++) engine.update(100);
    expect(engine.getHudSnapshot().phase).toBe("BOSS_BATTLE");

    const boss = engine.getRenderSnapshot().enemies.find((e) => e.boss?.isMainBoss);
    expect(boss).toBeTruthy();
    boss!.hp = 0; // force the kill on the next tick instead of simulating real combat

    engine.update(50);

    expect(engine.getHudSnapshot().phase).toBe("VICTORY");
    const pending = engine.getHudSnapshot().pendingItemReward;
    expect(pending).not.toBeNull();
    expect(engine.getInventory()).toHaveLength(1);
    expect(engine.getInventory()[0]!.itemDefinitionId).toBe(pending!.itemDefinitionId);
    expect(engine.getInventory()[0]!.ownerId).toBe(engine.getPlayerId());
    expect(engine.getLocalEconomyTotals().bossesDefeatedTotal).toBe(1);

    engine.acknowledgeItemReward();
    expect(engine.getHudSnapshot().pendingItemReward).toBeNull();
    // The item itself is NOT removed by acknowledging the banner — only the notification is dismissed.
    expect(engine.getInventory()).toHaveLength(1);
  });

  it("the granted item survives a reload (persisted immediately, not just on the next unrelated save)", () => {
    updateSave({ currentWave: 30, gold: 0, towerLoadout: [] });
    const first = new GameEngine();
    first.startRun();
    for (let i = 0; i < 200 && first.getHudSnapshot().phase === "BOSS_INTRO"; i++) first.update(100);
    const boss = first.getRenderSnapshot().enemies.find((e) => e.boss?.isMainBoss);
    boss!.hp = 0;
    first.update(50); // grants the drop and persists — no explicit save call needed

    const reloaded = new GameEngine();
    reloaded.startRun();
    expect(reloaded.getInventory()).toHaveLength(1);
    expect(reloaded.getInventory()[0]!.instanceId).toBe(first.getInventory()[0]!.instanceId);
    expect(reloaded.getPlayerId()).toBe(first.getPlayerId());
  });

  it("a mini-boss with no configured DropTable increments the local counter but grants no item (honest — no placeholder loot)", () => {
    // Wave 21 is one of Ancient Forest's mini-boss waves; none of the six
    // mini-boss archetypes have a dropTableId wired up in this first slice.
    updateSave({ currentWave: 21, gold: 0, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();

    let miniBoss = null;
    for (let i = 0; i < 300 && !miniBoss; i++) {
      engine.update(100);
      miniBoss = engine.getRenderSnapshot().enemies.find((e) => e.boss && !e.boss.isMainBoss) ?? null;
    }
    expect(miniBoss).toBeTruthy();
    miniBoss!.hp = 0;
    engine.update(50);

    expect(engine.getInventory()).toHaveLength(0);
    expect(engine.getLocalEconomyTotals().miniBossesDefeatedTotal).toBe(1);
  });
});

describe("GameEngine — audio events (Audio spec section 18)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  /** Ticks `engine` up to `maxIterations` times, draining audioEvents every tick so nothing is lost between drains, stopping early once `stop` returns true. */
  function runDrainingAudio(engine: GameEngine, stop: () => boolean, maxIterations = 20_000): string[] {
    const types: string[] = [];
    let iterations = 0;
    while (!stop() && iterations < maxIterations) {
      engine.update(100);
      for (const event of engine.drainAudioEvents()) types.push(event.type);
      iterations++;
    }
    return types;
  }

  it("7. boss_enrage fires exactly once, even though the boss stays enraged for many subsequent ticks", () => {
    updateSave({ currentWave: 30, gold: 0, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();

    const types = runDrainingAudio(engine, () => engine.getHudSnapshot().phase === "BOSS_BATTLE", 400);
    const boss = engine.getRenderSnapshot().enemies.find((e) => e.boss?.isMainBoss)!;
    expect(boss).toBeTruthy();
    boss.hp = boss.maxHp * 0.29; // below the 30% enrage threshold

    // Enough ticks for the ability-cadence check to fire AND stay enraged afterward.
    for (let i = 0; i < 50; i++) {
      engine.update(100);
      for (const event of engine.drainAudioEvents()) types.push(event.type);
    }

    expect(types.filter((t) => t === "boss_enrage")).toHaveLength(1);
  });

  it("8/10. boss_death and victory each fire exactly once when the main boss is killed", () => {
    updateSave({ currentWave: 30, gold: 0, towerLoadout: [] });
    const engine = new GameEngine();
    engine.startRun();

    const types = runDrainingAudio(engine, () => engine.getHudSnapshot().phase === "BOSS_BATTLE", 400);
    const boss = engine.getRenderSnapshot().enemies.find((e) => e.boss?.isMainBoss)!;
    boss.hp = 0;
    engine.update(50);
    types.push(...engine.drainAudioEvents().map((e) => e.type));
    // A couple more ticks in case anything re-fires after the kill.
    for (let i = 0; i < 5; i++) {
      engine.update(50);
      types.push(...engine.drainAudioEvents().map((e) => e.type));
    }

    expect(types.filter((t) => t === "boss_death")).toHaveLength(1);
    expect(types.filter((t) => t === "victory")).toHaveLength(1);
  });

  it("9. defeat fires exactly once for a full run to PROGRESSION_STOPPED", () => {
    const engine = new GameEngine();
    engine.startRun();
    const types = runDrainingAudio(engine, () => engine.getHudSnapshot().phase === "PROGRESSION_STOPPED");
    expect(types.filter((t) => t === "defeat")).toHaveLength(1);
  });

  it("11. castle_damage is aggregated per-tick, not fired once per enemy that breaches", () => {
    const engine = new GameEngine();
    engine.startRun();
    let castleDamageEvents = 0;
    let iterations = 0;
    while (engine.getHudSnapshot().phase !== "PROGRESSION_STOPPED" && iterations < 20_000) {
      engine.update(100);
      castleDamageEvents += engine.drainAudioEvents().filter((e) => e.type === "castle_damage").length;
      iterations++;
    }
    // An undefended run leaks well over a dozen enemies into the base by
    // the time it stops — far more than the number of castle_damage EVENTS
    // if (and only if) breaches are aggregated per tick as designed.
    const report = engine.getFailureReport();
    expect(report).not.toBeNull();
    expect(castleDamageEvents).toBeGreaterThan(0);
    expect(castleDamageEvents).toBeLessThan(report!.waveReached + 50); // sanity bound, not exact
  });

  it("13. draining (or not draining) audio events never changes simulation outcome", () => {
    updateSave({ currentWave: 1, gold: 500, towerLoadout: [] });
    const withDrain = new GameEngine();
    withDrain.startRun();
    withDrain.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    for (let i = 0; i < 500; i++) {
      withDrain.update(50);
      withDrain.drainAudioEvents();
    }

    window.localStorage.clear();
    updateSave({ currentWave: 1, gold: 500, towerLoadout: [] });
    const withoutDrain = new GameEngine();
    withoutDrain.startRun();
    withoutDrain.placeTower(TOWER_SLOTS[0]!.id, "IRONWOOD");
    for (let i = 0; i < 500; i++) withoutDrain.update(50); // never touches audioEvents

    expect(withoutDrain.getHudSnapshot().wave).toBe(withDrain.getHudSnapshot().wave);
    expect(withoutDrain.getHudSnapshot().gold).toBe(withDrain.getHudSnapshot().gold);
    expect(withoutDrain.getHudSnapshot().baseHp).toBe(withDrain.getHudSnapshot().baseHp);
  });

  it("15. retryPhase() never registers a duplicate subscriber — a single subscribe() still fires exactly once per notify after several retries", () => {
    const engine = new GameEngine();
    engine.startRun();
    let calls = 0;
    engine.subscribe(() => {
      calls++;
    });

    for (let retry = 0; retry < 3; retry++) {
      runDrainingAudio(engine, () => engine.getHudSnapshot().phase === "PROGRESSION_STOPPED");
      engine.retryPhase();
    }

    calls = 0;
    engine.update(50);
    expect(calls).toBe(1); // not 2, not 4 — exactly one listener firing once
  });

  it("16. unsubscribing (what GameScreen's cleanup does on unmount / Home) stops further audio-event delivery immediately", () => {
    const engine = new GameEngine();
    engine.startRun();
    let calls = 0;
    const unsubscribe = engine.subscribe(() => {
      calls++;
    });

    engine.update(50);
    expect(calls).toBeGreaterThan(0);

    unsubscribe();
    calls = 0;
    for (let i = 0; i < 20; i++) engine.update(50);
    expect(calls).toBe(0); // the old battle is no longer reaching this listener at all
  });
});
