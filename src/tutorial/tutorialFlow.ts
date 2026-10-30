/**
 * FIRST-RUN TUTORIAL — the step machine, kept free of React and of the
 * engine so every transition is unit-testable.
 *
 * Only brand-new players get it (fresh save: wave 1, no towers, never past
 * wave 1). It teaches by doing: each step waits for the player to actually
 * do the thing (pick a tower, place it, upgrade it...) instead of a wall of
 * text. While the player hasn't placed their first tower the game is held
 * (`isBlockingStep`) so nobody loses Castle HP while reading. Every step
 * can be skipped, and the whole thing is shown once per device.
 */

export type TutorialStep =
  | "INTRO" // where enemies come from and what to protect
  | "PICK_TOWER" // choose a tower in the bottom bar
  | "PLACE_TOWER" // put it on a build spot
  | "GOLD" // kills give gold
  | "WAIT_UPGRADE" // (hidden) waiting until an upgrade is affordable
  | "SELECT_TOWER" // tap the tower you can upgrade
  | "UPGRADE" // press Upgrade
  | "SPEED" // the 2x / 4x buttons
  | "FINISH" // you're on your own
  | "DONE";

export interface TutorialState {
  step: TutorialStep;
  /** The one-off tip shown at the first boss fight. */
  bossTipShown: boolean;
}

/** What the tutorial reads from the game every render. */
export interface TutorialObservation {
  phase: string;
  towerCount: number;
  pendingTowerType: string | null;
  selectedTowerId: string | null;
  /** Highest level among the towers on the map (0 when there are none). */
  maxTowerLevel: number;
  /** Some tower's next level costs no more than the gold in hand. */
  canAffordUpgrade: boolean;
  speed: number;
}

export const TUTORIAL_STORAGE_KEY = "hordenova.tutorial.v1";

export const NEW_PLAYER_STATE: TutorialState = { step: "INTRO", bossTipShown: false };
export const FINISHED_STATE: TutorialState = { step: "DONE", bossTipShown: true };

/** Steps the player has to act on before the first wave may hurt them. */
export function isBlockingStep(step: TutorialStep): boolean {
  return step === "INTRO" || step === "PICK_TOWER" || step === "PLACE_TOWER";
}

/** The numbered steps shown as "Step n of N" — the hidden wait and the closing card have no number. */
const NUMBERED: readonly TutorialStep[] = ["INTRO", "PICK_TOWER", "PLACE_TOWER", "GOLD", "SELECT_TOWER", "SPEED"];
export const TUTORIAL_STEP_COUNT = NUMBERED.length;
export function stepNumber(step: TutorialStep): number | null {
  if (step === "UPGRADE") return NUMBERED.indexOf("SELECT_TOWER") + 1;
  const i = NUMBERED.indexOf(step);
  return i < 0 ? null : i + 1;
}

/** A fresh save — the only kind of player the tutorial is for. */
export function isNewPlayer(save: { wave: number; bestWave: number; towerCount: number }): boolean {
  return save.wave <= 1 && save.bestWave <= 1 && save.towerCount === 0;
}

/** Automatic transitions: the player did (or undid) what the step asks. */
export function advanceTutorial(state: TutorialState, obs: TutorialObservation): TutorialState {
  const to = (step: TutorialStep): TutorialState => (step === state.step ? state : { ...state, step });
  switch (state.step) {
    case "PICK_TOWER":
      if (obs.towerCount > 0) return to("GOLD");
      return obs.pendingTowerType ? to("PLACE_TOWER") : state;
    case "PLACE_TOWER":
      if (obs.towerCount > 0) return to("GOLD");
      return obs.pendingTowerType ? state : to("PICK_TOWER");
    case "WAIT_UPGRADE":
      if (obs.maxTowerLevel >= 2) return to("SPEED");
      if (!obs.canAffordUpgrade) return state;
      return obs.selectedTowerId ? to("UPGRADE") : to("SELECT_TOWER");
    case "SELECT_TOWER":
      if (obs.maxTowerLevel >= 2) return to("SPEED");
      if (!obs.canAffordUpgrade) return to("WAIT_UPGRADE");
      return obs.selectedTowerId ? to("UPGRADE") : state;
    case "UPGRADE":
      if (obs.maxTowerLevel >= 2) return to("SPEED");
      if (!obs.canAffordUpgrade) return to("WAIT_UPGRADE");
      return obs.selectedTowerId ? state : to("SELECT_TOWER");
    case "SPEED":
      return obs.speed > 1 ? to("FINISH") : state;
    default:
      return state;
  }
}

/** The step's own button ("Got it") — only the steps that are read, not done. */
export function acknowledgeTutorial(state: TutorialState): TutorialState {
  switch (state.step) {
    case "INTRO":
      return { ...state, step: "PICK_TOWER" };
    case "GOLD":
      return { ...state, step: "WAIT_UPGRADE" };
    case "SPEED":
      return { ...state, step: "FINISH" };
    case "FINISH":
      return { ...state, step: "DONE" };
    default:
      return state;
  }
}

export function skipTutorial(): TutorialState {
  return FINISHED_STATE;
}

export function hasAcknowledgeButton(step: TutorialStep): boolean {
  return step === "INTRO" || step === "GOLD" || step === "SPEED" || step === "FINISH";
}

const BOSS_PHASES = new Set(["BOSS_INTRO", "BOSS_BATTLE"]);
const STEP_PHASES = new Set(["RUNNING", "WAVE_TRANSITION", "BOSS_BATTLE"]);

export type TutorialCard = { kind: "step"; step: TutorialStep } | { kind: "boss" };

/**
 * What to show right now, if anything. Steps stay out of the way of the
 * game's own screens (boss intro, defeat report, new-map preparation,
 * welcome back) and the hidden wait shows nothing.
 */
export function visibleTutorialCard(state: TutorialState, phase: string): TutorialCard | null {
  if (!state.bossTipShown && BOSS_PHASES.has(phase)) return { kind: "boss" };
  if (state.step === "DONE" || state.step === "WAIT_UPGRADE") return null;
  return STEP_PHASES.has(phase) ? { kind: "step", step: state.step } : null;
}

export function parseTutorialState(raw: string | null): TutorialState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<TutorialState>;
    const steps: TutorialStep[] = ["INTRO", "PICK_TOWER", "PLACE_TOWER", "GOLD", "WAIT_UPGRADE", "SELECT_TOWER", "UPGRADE", "SPEED", "FINISH", "DONE"];
    if (!v || !steps.includes(v.step as TutorialStep)) return null;
    return { step: v.step as TutorialStep, bossTipShown: v.bossTipShown === true };
  } catch {
    return null;
  }
}

export function loadTutorialState(): TutorialState | null {
  try {
    return parseTutorialState(window.localStorage.getItem(TUTORIAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveTutorialState(state: TutorialState): void {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage blocked (private mode etc.) — the tutorial just won't persist
  }
}
