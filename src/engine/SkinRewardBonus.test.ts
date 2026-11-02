import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { updateSave } from "./SaveSystem";
import { getSkinRewardMultiplier, PRESTIGE_TOWER_SKINS, TOWER_SKINS } from "@/config/towerSkins";

const ironSkin = TOWER_SKINS.find((s) => s.towerType === "IRONWOOD")!.id;
const infernoSkin = TOWER_SKINS.find((s) => s.towerType === "INFERNO")!.id;
const prestigeIron = PRESTIGE_TOWER_SKINS.find((s) => s.towerType === "IRONWOOD")!.id;

describe("paid skin reward bonus", () => {
  beforeEach(() => window.localStorage.clear());

  it("+5% per tower type in play wearing a paid skin; Prestige skins and types not on the map don't count", () => {
    expect(getSkinRewardMultiplier({}, ["IRONWOOD"])).toBe(1);
    expect(getSkinRewardMultiplier({ IRONWOOD: ironSkin }, ["IRONWOOD", "IRONWOOD"])).toBeCloseTo(1.05);
    expect(getSkinRewardMultiplier({ IRONWOOD: ironSkin, INFERNO: infernoSkin }, ["IRONWOOD", "INFERNO"])).toBeCloseTo(1.1);
    expect(getSkinRewardMultiplier({ IRONWOOD: ironSkin, INFERNO: infernoSkin }, ["IRONWOOD"])).toBeCloseTo(1.05);
    expect(getSkinRewardMultiplier({ IRONWOOD: prestigeIron }, ["IRONWOOD"])).toBe(1);
  });

  it("the engine applies it to Gold without rounding small kills away", () => {
    const entry = (slotId: string, type: "IRONWOOD" | "INFERNO") => ({ slotId, type, level: 5, specializationId: null, specializationLevel: 0, equippedSkinId: null, masteryLevel: 0, equippedItemInstanceIds: [null, null, null] });
    updateSave({ currentWave: 1, gold: 0, towerLoadout: [entry("slot-1", "IRONWOOD")] as never, ownedTowerSkinIds: [ironSkin], equippedTowerSkinByType: { IRONWOOD: ironSkin }, mapLayoutId: null });
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getSkinRewardMultiplier()).toBeCloseTo(1.05);
    const grant = (engine as unknown as { withSkinGoldBonus: (n: number) => number }).withSkinGoldBonus.bind(engine);
    let total = 0;
    for (let i = 0; i < 20; i++) total += grant(5);
    expect(total).toBe(105); // 20 x 5 = 100, +5% = 105, carried across kills
  });
});
