import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";
import { TOWER_SLOTS } from "@/data/mapWhisperingWoods";
import { FUSION_DAMAGE_MULT, FUSION_MAX_DISTANCE, FUSION_MIN_LEVEL, getFusionCost, getFusionGemPrice, getFusionId } from "@/config/towerFusion";
import { interestForWave, INTEREST_CAP_OF_WAVE_GOLD, INTEREST_RATE } from "@/config/goldInterest";
import { getTowerStats } from "@/entities/Tower";
import { MAX_TOWERS_PER_TYPE } from "@/data/mapLayouts";

/** Two build sites close enough to fuse the towers standing on them. */
function closePair() {
  for (const a of TOWER_SLOTS)
    for (const b of TOWER_SLOTS)
      if (a !== b && Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) <= FUSION_MAX_DISTANCE) return [a, b] as const;
  throw new Error("no close pair of sites");
}

function startWith(levelA: number, levelB: number, gold = 999_999, gems: { freeGems?: number; purchasedGems?: number } = {}) {
  const [a, b] = closePair();
  updateSave({
    currentWave: 1,
    gold,
    ...gems,
    towerLoadout: [
      { slotId: a.id, type: "INFERNO", level: levelA },
      { slotId: b.id, type: "FROSTBORN", level: levelB },
    ],
  });
  const engine = new GameEngine();
  engine.startRun();
  const towers = engine.getRenderSnapshot().towers;
  const inferno = towers.find((t) => t.type === "INFERNO")!;
  const frost = towers.find((t) => t.type === "FROSTBORN")!;
  return { engine, inferno, frost };
}

describe("Torres de fusão", () => {
  beforeEach(() => window.localStorage.clear());

  it("names every pair of elements, in either order", () => {
    expect(getFusionId("INFERNO", "FROSTBORN")).toBe("STEAM");
    expect(getFusionId("FROSTBORN", "INFERNO")).toBe("STEAM");
    expect(getFusionId("STORMCALLER", "INFERNO")).toBe("PLASMA");
    expect(getFusionId("IRONWOOD", "STORMCALLER")).toBe("THUNDER_ARROWS");
    expect(getFusionId("IRONWOOD", "IRONWOOD")).toBeNull();
  });

  it("will not fuse towers below the minimum level, and spends nothing trying", () => {
    const { engine, inferno, frost } = startWith(FUSION_MIN_LEVEL - 1, FUSION_MIN_LEVEL);
    const gold = engine.getHudSnapshot().gold;
    expect(engine.fusionBlocker(inferno.id, frost.id)).toBe("LEVEL");
    expect(engine.fuseTowers(inferno.id, frost.id)).toBe(false);
    expect(engine.getHudSnapshot().gold).toBe(gold);
  });

  it("will not fuse without the gold", () => {
    const { engine, inferno, frost } = startWith(FUSION_MIN_LEVEL, FUSION_MIN_LEVEL, 10);
    expect(engine.fusionBlocker(inferno.id, frost.id)).toBe("GOLD");
    expect(engine.fuseTowers(inferno.id, frost.id)).toBe(false);
  });

  it("can be paid in gems instead of gold, from either balance, at the player's choice", () => {
    const price = getFusionGemPrice(FUSION_MIN_LEVEL, FUSION_MIN_LEVEL);
    expect(price.free).toBeGreaterThan(price.purchased);
    const free = startWith(FUSION_MIN_LEVEL, FUSION_MIN_LEVEL, 10, { freeGems: price.free, purchasedGems: 0 });
    expect(free.engine.fusionBlocker(free.inferno.id, free.frost.id, "GOLD")).toBe("GOLD");
    expect(free.engine.fusionBlocker(free.inferno.id, free.frost.id, "PURCHASED")).toBe("GEMS");
    expect(free.engine.fuseTowers(free.inferno.id, free.frost.id, "FREE")).toBe(true);
    const hud = free.engine.getHudSnapshot();
    expect(hud.gold).toBe(10);
    expect(hud.freeGems).toBe(0);

    window.localStorage.clear();
    const paid = startWith(FUSION_MIN_LEVEL, FUSION_MIN_LEVEL, 10, { freeGems: 0, purchasedGems: price.purchased + 5 });
    expect(paid.engine.fuseTowers(paid.inferno.id, paid.frost.id, "FREE")).toBe(false);
    expect(paid.engine.fuseTowers(paid.inferno.id, paid.frost.id, "PURCHASED")).toBe(true);
    expect(paid.engine.getHudSnapshot().purchasedGems).toBe(5);
    expect(paid.engine.getRenderSnapshot().towers[0]!.fusedWith?.type).toBe("FROSTBORN");
  });

  it("fuses: charges the cost, frees the partner's site, carries its element and hits harder", () => {
    const { engine, inferno, frost } = startWith(12, 15);
    const gold = engine.getHudSnapshot().gold;
    const damageBefore = getTowerStats(inferno).damage;
    expect(engine.fuseTowers(inferno.id, frost.id)).toBe(true);
    expect(engine.getHudSnapshot().gold).toBe(gold - getFusionCost(12, 15));
    const towers = engine.getRenderSnapshot().towers;
    expect(towers).toHaveLength(1);
    expect(towers[0]!.fusedWith?.type).toBe("FROSTBORN");
    expect(towers[0]!.fusedWith?.level).toBe(15);
    expect(getTowerStats(towers[0]!).damage).toBeCloseTo(damageBefore * FUSION_DAMAGE_MULT, 1);
    // the absorbed tower still counts for its type's limit
    expect(engine.countTowersOfType("FROSTBORN")).toBe(1);
    expect(MAX_TOWERS_PER_TYPE).toBeGreaterThan(1);
  });

  it("survives a save and load", () => {
    const { engine, inferno, frost } = startWith(12, 15);
    engine.fuseTowers(inferno.id, frost.id);
    const saved = loadSave().towerLoadout;
    expect(saved).toHaveLength(1);
    expect(saved[0]!.fusedWith?.type).toBe("FROSTBORN");
    const again = new GameEngine();
    again.startRun();
    expect(again.getRenderSnapshot().towers[0]!.fusedWith?.level).toBe(15);
  });

  it("splits back into two towers at their own levels, for free", () => {
    const { engine, inferno, frost } = startWith(12, 15);
    engine.fuseTowers(inferno.id, frost.id);
    const gold = engine.getHudSnapshot().gold;
    expect(engine.splitTower(inferno.id)).toBe(true);
    expect(engine.getHudSnapshot().gold).toBe(gold);
    const towers = engine.getRenderSnapshot().towers;
    expect(towers).toHaveLength(2);
    expect(towers.find((t) => t.type === "INFERNO")!.fusedWith ?? null).toBeNull();
    expect(towers.find((t) => t.type === "FROSTBORN")!.level).toBe(15);
  });

  it("never fuses two towers of the same element, or a tower that is already fused", () => {
    const { engine, inferno, frost } = startWith(12, 15);
    engine.fuseTowers(inferno.id, frost.id);
    expect(engine.fusionCandidates(inferno.id)).toHaveLength(0);
  });
});

describe("Juros sobre o ouro", () => {
  it("pays a share of the banked gold, capped by what the wave's kills paid", () => {
    expect(interestForWave(10_000, 1_000)).toBe(Math.floor(Math.min(10_000 * INTEREST_RATE, 1_000 * INTEREST_CAP_OF_WAVE_GOLD)));
    expect(interestForWave(1_000_000, 100)).toBe(100 * INTEREST_CAP_OF_WAVE_GOLD);
  });

  it("pays nothing without playing: no kills, no interest", () => {
    expect(interestForWave(1_000_000, 0)).toBe(0);
    expect(interestForWave(0, 500)).toBe(0);
  });
});

describe("Torres de fusão em combate", () => {
  it("a fused tower lands the absorbed element on its hits (Inferno + Frostborn chills, Ironwood + Inferno burns)", async () => {
    const { tickCombat } = await import("./CombatSystem");
    const { createTowerInstance } = await import("@/entities/Tower");
    const { createEnemyInstance } = await import("@/entities/Enemy");

    const steam = createTowerInstance("s", "INFERNO", { x: 0, y: 0 }, 15);
    steam.fusedWith = { slotId: "", type: "FROSTBORN", level: 15 };
    const e1 = createEnemyInstance("BRUTE", 30);
    e1.position = { x: 20, y: 0 };
    tickCombat([steam], [e1], 16);
    expect(e1.slow).toBeTruthy();

    const fireArrows = createTowerInstance("s", "IRONWOOD", { x: 0, y: 0 }, 15);
    fireArrows.fusedWith = { slotId: "", type: "INFERNO", level: 15 };
    const e2 = createEnemyInstance("BRUTE", 30);
    e2.position = { x: 20, y: 0 };
    tickCombat([fireArrows], [e2], 16);
    expect(e2.burn).toBeTruthy();
  });

  it("a plain tower lands no second element", async () => {
    const { tickCombat } = await import("./CombatSystem");
    const { createTowerInstance } = await import("@/entities/Tower");
    const { createEnemyInstance } = await import("@/entities/Enemy");
    const plain = createTowerInstance("s", "IRONWOOD", { x: 0, y: 0 }, 15);
    const e = createEnemyInstance("BRUTE", 30);
    e.position = { x: 20, y: 0 };
    tickCombat([plain], [e], 16);
    expect(e.burn ?? null).toBeFalsy();
    expect(e.slow ?? null).toBeFalsy();
  });
});
