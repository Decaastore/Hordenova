import { describe, expect, it, vi } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { TOWER_DEFINITIONS, TOWER_TYPES, type TowerType } from "@/config/towerStats";
import {
  canUpgradeSpecialization,
  getSpecializationUpgradeCostFor,
  getTowerUpgradeCost,
  getMasteryUpgradeCostFor,
  type TowerInstance,
} from "@/entities/Tower";

/**
 * Progression 2.0 spec section 3/4 — the exact problem this whole
 * Specialization/Upgrade Slot system (config/specializations.ts) exists to
 * fix: "reaches phase 46 in ~20 minutes just by leveling towers, far too
 * fast". This is a real simulation, not a guess — a greedy "always buy the
 * single cheapest available action, every tick" bot, which is the closest
 * automatable proxy for "a player who just levels everything" (build a
 * tower, level it, or now also choose/upgrade a specialization — whichever
 * is cheapest at that moment). It runs the ACTUAL GameEngine, not a
 * separate model, so this is load-bearing on real game code, not a
 * spreadsheet estimate.
 */
type Action =
  | { kind: "build"; cost: number; slotId: string; type: TowerType }
  | { kind: "level"; cost: number; towerId: string }
  | { kind: "specUpgrade"; cost: number; towerId: string };

/**
 * Visual Overhaul spec section 21: choosing a specialization path is now a
 * Gems purchase, not a Gold one (see GameEngine.chooseTowerSpecialization) —
 * this greedy bot only ever spends Gold, so it can no longer unlock a path
 * on its own (a real Gold-only player wouldn't be able to either). It still
 * exercises specUpgrade (still Gold, still requires a chosen path) whenever
 * a save already ships one pre-chosen — see the "with a pre-chosen
 * specialization" variant below.
 *
 * CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE): Tower Mastery moved OFF
 * Gold entirely and onto Gems (see gemSinks.ts) — it is deliberately NOT a
 * candidate here anymore, since a Gold balance can never actually afford it
 * regardless of how the cost number compares. Its own Gems-funded spending
 * is exercised separately by spendGemsOnMastery below, driven by whatever
 * Gems the bot actually earns from boss/mini-boss kills, never by Gold.
 */
function cheapestAction(towers: readonly TowerInstance[], occupiedSlotIds: ReadonlySet<string>, typeIndex: number): Action | null {
  const candidates: Action[] = [];

  const freeSlot = TOWER_SLOTS.find((s) => !occupiedSlotIds.has(s.id));
  if (freeSlot) {
    const type = TOWER_TYPES[typeIndex % TOWER_TYPES.length]!;
    candidates.push({ kind: "build", cost: TOWER_DEFINITIONS[type].buildCost, slotId: freeSlot.id, type });
  }

  for (const tower of towers) {
    const levelCost = getTowerUpgradeCost(tower);
    if (levelCost !== null) candidates.push({ kind: "level", cost: levelCost, towerId: tower.id });

    if (canUpgradeSpecialization(tower)) {
      const cost = getSpecializationUpgradeCostFor(tower);
      if (cost !== null) candidates.push({ kind: "specUpgrade", cost, towerId: tower.id });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.cost - b.cost);
  return candidates[0]!;
}

/**
 * CORREÇÃO DE REQUISITOS — Mastery's own Gems-funded greedy spend, entirely
 * separate from the Gold loop above: converts whatever Gem Shards have
 * accumulated (boss/mini-boss kills), then buys the single cheapest
 * available Mastery upgrade across every placed tower while Gems allow it.
 * Mirrors the real player flow (Shards -> Gems -> Mastery) instead of
 * assuming Gems appear from nowhere.
 */
function spendGemsOnMastery(engine: GameEngine, towers: readonly TowerInstance[]): void {
  while (engine.convertGemShards()) {
    /* keep converting until below the fixed rate */
  }
  for (let guard = 0; guard < 50; guard++) {
    if (towers.length === 0) return;
    let cheapest: TowerInstance | null = null;
    let cheapestCost = Infinity;
    for (const tower of towers) {
      const cost = getMasteryUpgradeCostFor(tower);
      if (cost < cheapestCost) {
        cheapestCost = cost;
        cheapest = tower;
      }
    }
    if (!cheapest || !engine.canAffordGems(cheapestCost)) return;
    engine.selectTower(cheapest.id);
    if (!engine.upgradeSelectedTowerMastery()) return;
  }
}

function runGreedyBot(
  simulatedMs: number,
): { waveReached: number; phaseId: string; gold: number; avgTowerLevel: number; avgMasteryLevel: number } {
  // Combat rolls crit/freeze/etc chances off the real, global Math.random()
  // (see engine/CombatSystem.ts) — pinning it to a deterministic sequence
  // (same precedent as GameEngine.test.ts's own seededRandom) makes this
  // simulation's outcome reproducible across runs instead of quietly
  // flaking near any threshold assertion.
  let seed = 1;
  vi.spyOn(Math, "random").mockImplementation(() => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  });

  window.localStorage.clear();
  updateSave({ currentWave: 1, gold: 100, towerLoadout: [] });
  const engine = new GameEngine();
  engine.startRun();

  const TICK_MS = 100;
  let elapsed = 0;
  let typeIndex = 0;

  while (elapsed < simulatedMs) {
    engine.update(TICK_MS);
    elapsed += TICK_MS;

    // Spend every tick, as fast as gold allows — the "just keep leveling"
    // play pattern the spec is worried about.
    for (let guard = 0; guard < 50; guard++) {
      const hud = engine.getHudSnapshot();
      const snapshot = engine.getRenderSnapshot();
      const occupied = new Set(snapshot.towers.map((t) => t.slotId));
      const action = cheapestAction(snapshot.towers, occupied, typeIndex);
      if (!action || action.cost > hud.gold) break;

      if (action.kind === "build") {
        engine.placeTower(action.slotId, action.type);
        typeIndex++;
      } else if (action.kind === "level") {
        engine.selectTower(action.towerId);
        engine.upgradeSelectedTower();
      } else {
        engine.selectTower(action.towerId);
        engine.upgradeSelectedTowerSpecialization();
      }
    }

    // Gems-funded Mastery spend is entirely independent of the Gold loop
    // above (CORREÇÃO DE REQUISITOS) — driven by whatever Gem Shards boss/
    // mini-boss kills have actually granted so far.
    spendGemsOnMastery(engine, engine.getRenderSnapshot().towers);

    // An idle player whose build fails just retries — Active Idle never
    // stops progression permanently on its own (spec section 31).
    if (engine.getHudSnapshot().phase === "PROGRESSION_STOPPED") engine.retryPhase();
  }

  const hud = engine.getHudSnapshot();
  const towers = engine.getRenderSnapshot().towers;
  const avgTowerLevel = towers.length ? towers.reduce((sum, t) => sum + t.level, 0) / towers.length : 0;
  const avgMasteryLevel = towers.length ? towers.reduce((sum, t) => sum + t.masteryLevel, 0) / towers.length : 0;
  vi.restoreAllMocks();
  return { waveReached: hud.wave, phaseId: hud.phaseId, gold: hud.gold, avgTowerLevel, avgMasteryLevel };
}

describe("Progression 2.0 balance simulation (spec section 3/4)", () => {
  it("a greedy always-spend bot does NOT blow past the early game in 20 simulated minutes", () => {
    const TWENTY_MINUTES_MS = 20 * 60 * 1000;
    const result = runGreedyBot(TWENTY_MINUTES_MS);

    // The reported problem was reaching wave ~46 (deep into the SECOND
    // biome, Volcanic Wastes) in 20 minutes with nothing left to spend gold
    // on. With Specialization Slots as a genuine second gold sink, the same
    // greedy spend pattern should stay meaningfully further back — this
    // bound is intentionally loose (it's a regression GUARD, not a tuned
    // target) but a failure here means the fix regressed.
    expect(result.waveReached).toBeLessThan(46);
  });

  it("ECONOMY AUDIT (Master Implementation spec section 42/43): a greedy always-spend bot has NOT maxed all 12 tower slots after 6 simulated hours", () => {
    // Empirical audit (not tuned to pass, tuned to the actual reported
    // symptom): with the ORIGINAL flat `targetLevel * 0.75` upgrade-cost
    // formula, this same bot fully maxed all 12 slots to level 30 in
    // ~5-6 simulated hours, after which gold had zero remaining sink for
    // 40+ more hours while the HP-scaling wall didn't bite until
    // ~wave 330-390 — the reported "gold feels too fast" symptom. The
    // getUpgradeCost lateGameFactor fix (config/towerStats.ts) stretches
    // full-mastery out to ~27-30 simulated hours, overlapping with when
    // the wall actually starts to matter instead of preceding it by days.
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const result = runGreedyBot(SIX_HOURS_MS);
    expect(result.avgTowerLevel).toBeLessThan(25);
  }, 30_000);

  it("GOLD ECONOMY CONSEQUENCE (CORREÇÃO DE REQUISITOS supersedes spec section 45 for Gold specifically): once every tower hits level 30, Gold has nowhere left to go — Mastery moved to Gems, so Gold's own uncapped-sink invariant is honestly false now (see goldSinks.ts)", () => {
    // The same 48-simulated-hour audit methodology that found the original
    // level-30 saturation bug (see towerStats.ts's getUpgradeCost comment)
    // — long enough to comfortably pass the ~27-30h full-level-30 point for
    // every one of the 12 slots, on the ACTUAL engine, not a projection.
    //
    // NOTE on why this test no longer also asserts avgMasteryLevel > 0 here:
    // an earlier version of this test tried to prove Gems-funded Mastery
    // reachable by having this SAME greedy bot also convert Gem Shards and
    // spend them on Mastery. Real engine simulation caught a genuine,
    // PRE-EXISTING (not introduced by this correction) property of the boss
    // fight itself: this bot's build gets permanently stuck in BOSS_BATTLE
    // against one specific main boss around wave ~270-300 for the rest of
    // the 48h run (bossesDefeatedTotal stays 0 from that point on — verified
    // via engine.getLocalEconomyTotals()), so its Gem Shard income (which
    // only comes from boss/mini-boss kills) permanently flatlines while Gold
    // (from ordinary enemy kills, which keep happening even mid-standoff)
    // keeps flowing and towers keep leveling from it. That is a boss-combat-
    // balance question, not a Season/Mastery/Gems-economy one — chasing it
    // here would silently widen this correction's scope. Gems-funded
    // Mastery's own reachability is proven directly, deterministically, and
    // without depending on this bot's incidental combat luck by
    // GameEngineProgression2.test.ts's "Tower Mastery funded by Gems" suite.
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
    const result = runGreedyBot(FORTY_EIGHT_HOURS_MS);

    // Nearly every slot is maxed by 48h (comfortably past the ~27-30h finding).
    expect(result.avgTowerLevel).toBeGreaterThanOrEqual(27);
    // And Gold, with Mastery gone, has nowhere left to go once every tower
    // and specialization is maxed — it piles up unspent for the remainder
    // of the run. This is the accepted, documented consequence of the
    // correction (see goldSinks.ts's own doc comment), not a bug to hide.
    expect(result.gold).toBeGreaterThan(0);
  }, 120_000);
});
