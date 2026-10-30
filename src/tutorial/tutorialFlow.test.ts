import { beforeEach, describe, expect, it } from "vitest";
import {
  acknowledgeTutorial,
  advanceTutorial,
  FINISHED_STATE,
  isBlockingStep,
  isNewPlayer,
  loadTutorialState,
  NEW_PLAYER_STATE,
  parseTutorialState,
  saveTutorialState,
  skipTutorial,
  stepNumber,
  TUTORIAL_STEP_COUNT,
  TUTORIAL_STORAGE_KEY,
  visibleTutorialCard,
  type TutorialObservation,
  type TutorialState,
} from "./tutorialFlow";

const base: TutorialObservation = {
  phase: "RUNNING",
  towerCount: 0,
  pendingTowerType: null,
  selectedTowerId: null,
  maxTowerLevel: 0,
  canAffordUpgrade: false,
  speed: 1,
};
const at = (step: TutorialState["step"]): TutorialState => ({ step, bossTipShown: false });

describe("first-run tutorial — who gets it", () => {
  it("only a fresh save is a new player", () => {
    expect(isNewPlayer({ wave: 1, bestWave: 0, towerCount: 0 })).toBe(true);
    expect(isNewPlayer({ wave: 1, bestWave: 1, towerCount: 0 })).toBe(true);
    expect(isNewPlayer({ wave: 1, bestWave: 1, towerCount: 1 })).toBe(false);
    expect(isNewPlayer({ wave: 1, bestWave: 40, towerCount: 0 })).toBe(false);
    expect(isNewPlayer({ wave: 31, bestWave: 31, towerCount: 9 })).toBe(false);
  });
});

describe("first-run tutorial — the full happy path, driven only by what the player does", () => {
  it("walks INTRO → … → DONE", () => {
    let s = NEW_PLAYER_STATE;
    expect(isBlockingStep(s.step)).toBe(true);
    s = acknowledgeTutorial(s);
    expect(s.step).toBe("PICK_TOWER");
    s = advanceTutorial(s, { ...base, pendingTowerType: "IRONWOOD" });
    expect(s.step).toBe("PLACE_TOWER");
    expect(isBlockingStep(s.step)).toBe(true);
    s = advanceTutorial(s, { ...base, towerCount: 1, maxTowerLevel: 1 });
    expect(s.step).toBe("GOLD");
    expect(isBlockingStep(s.step)).toBe(false);
    s = acknowledgeTutorial(s);
    expect(s.step).toBe("WAIT_UPGRADE");
    s = advanceTutorial(s, { ...base, towerCount: 1, maxTowerLevel: 1 });
    expect(s.step).toBe("WAIT_UPGRADE");
    s = advanceTutorial(s, { ...base, towerCount: 1, maxTowerLevel: 1, canAffordUpgrade: true });
    expect(s.step).toBe("SELECT_TOWER");
    s = advanceTutorial(s, { ...base, towerCount: 1, maxTowerLevel: 1, canAffordUpgrade: true, selectedTowerId: "t1" });
    expect(s.step).toBe("UPGRADE");
    s = advanceTutorial(s, { ...base, towerCount: 1, maxTowerLevel: 2, selectedTowerId: "t1" });
    expect(s.step).toBe("SPEED");
    s = advanceTutorial(s, { ...base, towerCount: 1, maxTowerLevel: 2, speed: 2 });
    expect(s.step).toBe("FINISH");
    s = acknowledgeTutorial(s);
    expect(s.step).toBe("DONE");
  });
});

describe("first-run tutorial — the player wanders off the script", () => {
  it("dropping the picked tower goes back to picking one", () => {
    expect(advanceTutorial(at("PLACE_TOWER"), base).step).toBe("PICK_TOWER");
  });

  it("a tower already on the map skips straight to GOLD", () => {
    expect(advanceTutorial(at("PICK_TOWER"), { ...base, towerCount: 1 }).step).toBe("GOLD");
  });

  it("closing the tower panel during UPGRADE asks to select it again; spending the gold waits again", () => {
    expect(advanceTutorial(at("UPGRADE"), { ...base, towerCount: 1, maxTowerLevel: 1, canAffordUpgrade: true }).step).toBe("SELECT_TOWER");
    expect(advanceTutorial(at("UPGRADE"), { ...base, towerCount: 1, maxTowerLevel: 1, selectedTowerId: "t1" }).step).toBe("WAIT_UPGRADE");
    expect(advanceTutorial(at("SELECT_TOWER"), { ...base, towerCount: 1, maxTowerLevel: 1 }).step).toBe("WAIT_UPGRADE");
  });

  it("an upgrade done before being asked counts", () => {
    expect(advanceTutorial(at("WAIT_UPGRADE"), { ...base, towerCount: 2, maxTowerLevel: 2 }).step).toBe("SPEED");
    expect(advanceTutorial(at("SELECT_TOWER"), { ...base, towerCount: 2, maxTowerLevel: 2, canAffordUpgrade: true }).step).toBe("SPEED");
  });

  it("the read-only steps move on only with their button; the doing steps ignore it", () => {
    expect(acknowledgeTutorial(at("SPEED")).step).toBe("FINISH");
    expect(acknowledgeTutorial(at("PICK_TOWER")).step).toBe("PICK_TOWER");
    expect(acknowledgeTutorial(at("UPGRADE")).step).toBe("UPGRADE");
    expect(advanceTutorial(at("GOLD"), { ...base, towerCount: 3, canAffordUpgrade: true }).step).toBe("GOLD");
  });

  it("skipping ends everything, the boss tip included", () => {
    expect(skipTutorial()).toEqual(FINISHED_STATE);
  });

  it("an unchanged step returns the same object (no needless saves or re-renders)", () => {
    const s = at("WAIT_UPGRADE");
    expect(advanceTutorial(s, { ...base, towerCount: 1, maxTowerLevel: 1 })).toBe(s);
  });
});

describe("first-run tutorial — what is on screen", () => {
  it("only blocks the game until the first tower is placed", () => {
    expect(["INTRO", "PICK_TOWER", "PLACE_TOWER"].every((st) => isBlockingStep(st as TutorialState["step"]))).toBe(true);
    expect(["GOLD", "WAIT_UPGRADE", "SELECT_TOWER", "UPGRADE", "SPEED", "FINISH", "DONE"].some((st) => isBlockingStep(st as TutorialState["step"]))).toBe(false);
  });

  it("stays out of the way of the game's own screens and hides the wait", () => {
    expect(visibleTutorialCard(at("GOLD"), "RUNNING")).toEqual({ kind: "step", step: "GOLD" });
    for (const phase of ["DEPLOY", "PROGRESSION_STOPPED", "OFFLINE_RETURN", "VICTORY", "PRE_RUN"]) expect(visibleTutorialCard(at("GOLD"), phase)).toBeNull();
    expect(visibleTutorialCard(at("WAIT_UPGRADE"), "RUNNING")).toBeNull();
    expect(visibleTutorialCard(FINISHED_STATE, "RUNNING")).toBeNull();
  });

  it("shows the boss tip once, at the first boss, even after the steps are done", () => {
    expect(visibleTutorialCard({ step: "DONE", bossTipShown: false }, "BOSS_INTRO")).toEqual({ kind: "boss" });
    expect(visibleTutorialCard({ step: "UPGRADE", bossTipShown: false }, "BOSS_BATTLE")).toEqual({ kind: "boss" });
    expect(visibleTutorialCard({ step: "UPGRADE", bossTipShown: true }, "BOSS_BATTLE")).toEqual({ kind: "step", step: "UPGRADE" });
    expect(visibleTutorialCard(FINISHED_STATE, "BOSS_INTRO")).toBeNull();
  });

  it("numbers the steps the player sees as a sequence", () => {
    expect(stepNumber("INTRO")).toBe(1);
    expect(stepNumber("UPGRADE")).toBe(stepNumber("SELECT_TOWER"));
    expect(stepNumber("SPEED")).toBe(TUTORIAL_STEP_COUNT);
    expect(stepNumber("FINISH")).toBeNull();
    expect(stepNumber("WAIT_UPGRADE")).toBeNull();
  });
});

describe("first-run tutorial — persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips and rejects garbage", () => {
    expect(loadTutorialState()).toBeNull();
    saveTutorialState({ step: "SELECT_TOWER", bossTipShown: true });
    expect(loadTutorialState()).toEqual({ step: "SELECT_TOWER", bossTipShown: true });
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "{not json");
    expect(loadTutorialState()).toBeNull();
    expect(parseTutorialState(JSON.stringify({ step: "NOPE" }))).toBeNull();
    expect(parseTutorialState(JSON.stringify({ step: "GOLD" }))).toEqual({ step: "GOLD", bossTipShown: false });
  });
});
