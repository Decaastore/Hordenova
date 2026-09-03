import { describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { TOWER_DEFINITIONS, TOWER_TYPES, type TowerType } from "@/config/towerStats";
import {
  canChooseSpecialization,
  canUpgradeSpecialization,
  getSpecializationUpgradeCostFor,
  getTowerUpgradeCost,
  type TowerInstance,
} from "@/entities/Tower";
import { getSpecializationsForTower, type SpecializationId } from "@/config/specializations";

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
  | { kind: "specChoose"; cost: number; towerId: string; specId: SpecializationId }
  | { kind: "specUpgrade"; cost: number; towerId: string };

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

    if (canChooseSpecialization(tower)) {
      const specId = getSpecializationsForTower(tower.type)[0]!.id;
      const cost = getSpecializationUpgradeCostFor({ ...tower, specializationId: specId, specializationLevel: 0 });
      if (cost !== null) candidates.push({ kind: "specChoose", cost, towerId: tower.id, specId });
    } else if (canUpgradeSpecialization(tower)) {
      const cost = getSpecializationUpgradeCostFor(tower);
      if (cost !== null) candidates.push({ kind: "specUpgrade", cost, towerId: tower.id });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.cost - b.cost);
  return candidates[0]!;
}

function runGreedyBot(simulatedMs: number): { waveReached: number; phaseId: string; gold: number } {
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
      } else if (action.kind === "specChoose") {
        engine.selectTower(action.towerId);
        engine.chooseTowerSpecialization(action.specId);
      } else {
        engine.selectTower(action.towerId);
        engine.upgradeSelectedTowerSpecialization();
      }
    }

    // An idle player whose build fails just retries — Active Idle never
    // stops progression permanently on its own (spec section 31).
    if (engine.getHudSnapshot().phase === "PROGRESSION_STOPPED") engine.retryPhase();
  }

  const hud = engine.getHudSnapshot();
  return { waveReached: hud.wave, phaseId: hud.phaseId, gold: hud.gold };
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
});
