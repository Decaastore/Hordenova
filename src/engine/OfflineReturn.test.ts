import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine } from "./GameEngine";
import { loadSave, updateSave } from "./SaveSystem";

const strong = (slotId: string) => ({ slotId, type: "IRONWOOD" as const, level: 60, specializationId: null, specializationLevel: 0, equippedSkinId: null, masteryLevel: 0, equippedItemInstanceIds: [null, null, null] });
const HOUR = 60 * 60 * 1000;

function seed(lastPlayedAt: number | null) {
  updateSave({ currentWave: 3, bestWave: 3, gold: 0, gemShards: 0, towerLoadout: [strong("slot-1"), strong("slot-2"), strong("slot-3")] as never, mapLayoutId: null });
  // updateSave stamps lastPlayedAt with now; write the wanted value directly
  const raw = JSON.parse(window.localStorage.getItem("hordenova.save.v1")!);
  raw.lastPlayedAt = lastPlayedAt;
  window.localStorage.setItem("hordenova.save.v1", JSON.stringify(raw));
}

describe("Welcome Back — offline progress", () => {
  beforeEach(() => window.localStorage.clear());

  it("reopening after time away turns the simulation into the same rewards live play gives", () => {
    seed(Date.now() - 2 * HOUR);
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().phase).toBe("OFFLINE_RETURN");
    const s = engine.getOfflineSummary()!;
    expect(s.source).toBe("CLOSED");
    expect(s.awayMs).toBeGreaterThan(1.9 * HOUR);
    expect(s.endingWave).toBeGreaterThan(s.startingWave);
    expect(s.goldEarned).toBeGreaterThanOrEqual(s.resourcesEarned);
    expect(engine.getHudSnapshot().gold).toBe(s.goldEarned);
    // pass XP and today's wave mission moved with the waves cleared
    expect(s.passXpEarned).toBeGreaterThanOrEqual(s.endingWave - s.startingWave);
    expect(loadSave().seasonPass!.xp).toBe(s.passXpEarned);
    if (s.bossesCleared + s.miniBossesCleared > 0) expect(s.gemShardsEarned).toBeGreaterThan(0);
    const waveMission = engine.getDailyMissions().find((m) => m.kind === "CLEAR_WAVES");
    if (waveMission) expect(s.missions.some((m) => m.kind === "CLEAR_WAVES")).toBe(true);
  });

  it("you can spend the gold on upgrades right from the Welcome Back screen", () => {
    seed(Date.now() - 2 * HOUR);
    const engine = new GameEngine();
    engine.startRun();
    expect(engine.getHudSnapshot().phase).toBe("OFFLINE_RETURN");
    updateSave({});
    (engine as unknown as { gold: number }).gold = 1_000_000;
    const tower = engine.getRenderSnapshot().towers[0]!;
    const internals = engine as unknown as { towers: { id: string; level: number }[] };
    internals.towers[0]!.level = 30;
    engine.selectTower(tower.id);
    expect(engine.upgradeSelectedTower()).toBe(true);
  });

  it("a tab the browser froze for a long time gets the same Welcome Back on waking up; short gaps don't", () => {
    seed(null);
    const engine = new GameEngine();
    engine.startRun();
    for (let i = 0; i < 20; i++) engine.update(100);
    expect(engine.catchUpHiddenTime(20_000)).toBe(false); // under a minute: nothing to cover
    expect(engine.catchUpHiddenTime(HOUR)).toBe(true);
    expect(engine.getHudSnapshot().phase).toBe("OFFLINE_RETURN");
    const s = engine.getOfflineSummary()!;
    expect(s.source).toBe("HIDDEN_TAB");
    expect(s.awayMs).toBe(HOUR);
    expect(engine.getRenderSnapshot().enemies).toHaveLength(0); // the wave in progress restarts clean
    engine.dismissOfflineSummary();
    expect(engine.getHudSnapshot().phase).not.toBe("OFFLINE_RETURN");
  });
});
