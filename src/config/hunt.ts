import { PHASES, type PhaseDefinition } from "./phaseConfig";

/**
 * CAÇADA (Hunt) — replay a phase you have already beaten, much harder, to
 * fill the Bestiary. The main run only goes forward, so a phase's own
 * creatures and its boss would otherwise never come back; a hunt brings
 * them back.
 *
 * A hunt is its own temporary castle (SaveSystem's HUNT_STORAGE_KEY, laid
 * over the account exactly like the Eternal castle): your Season towers,
 * talents and gold come along, the phase's waves play from its first wave
 * to its main boss, and every defeat counts on the account's Bestiary and
 * Boss Bestiary. Nothing you do inside the hunt castle changes your Season
 * castle.
 *
 * WHY IT IS HARD: the creatures come with the strength of the wave your
 * Season castle is on now (never weaker than the phase itself) and then
 * some — HUNT_HP_MULT more life, HUNT_SPEED_MULT more speed, and every
 * creature that reaches the castle hits HUNT_BREACH_MULT harder. Bringing
 * your current towers to an old phase is not a walk in the park.
 */
export const HUNT_HP_MULT = 1.6;
export const HUNT_SPEED_MULT = 1.12;
export const HUNT_BREACH_MULT = 1.5;

export interface HuntRun {
  /** Index into PHASES. */
  phaseIndex: number;
  startWave: number;
  endWave: number;
  /** The wave whose strength the creatures use (the Season castle's wave at the start, never below the phase's own). */
  powerWave: number;
  /** Set once the phase's main boss falls. */
  won: boolean;
}

export interface HuntMeta {
  active: HuntRun | null;
  /** Hunts won per phase id. */
  wins: Record<string, number>;
}

export function emptyHuntMeta(): HuntMeta {
  return { active: null, wins: {} };
}

/** A phase can be hunted once the Season castle has cleared it (its main boss wave is behind the Season record). */
export function canHuntPhase(phase: PhaseDefinition, seasonBestWave: number): boolean {
  return seasonBestWave >= phase.endWave;
}

/** Builds the hunt for `phaseIndex`, or null when that phase can't be hunted yet. */
export function planHunt(phaseIndex: number, seasonBestWave: number, seasonCurrentWave: number): HuntRun | null {
  const phase = PHASES[phaseIndex];
  if (!phase || !canHuntPhase(phase, seasonBestWave)) return null;
  return {
    phaseIndex,
    startWave: phase.startWave,
    endWave: phase.endWave,
    powerWave: Math.max(phase.startWave, Math.floor(seasonCurrentWave)),
    won: false,
  };
}

/** The wave whose stats a creature uses inside a hunt. */
export function huntStatWave(run: HuntRun, wave: number): number {
  return Math.max(wave, run.powerWave);
}

export function sanitizeHuntMeta(raw: unknown): HuntMeta {
  const out = emptyHuntMeta();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  if (r.wins && typeof r.wins === "object") {
    for (const p of PHASES) {
      const v = (r.wins as Record<string, unknown>)[p.id];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out.wins[p.id] = Math.floor(v);
    }
  }
  const a = r.active as Record<string, unknown> | null | undefined;
  if (a && typeof a === "object" && typeof a.phaseIndex === "number" && PHASES[a.phaseIndex]) {
    const phase = PHASES[a.phaseIndex]!;
    const power = typeof a.powerWave === "number" && Number.isFinite(a.powerWave) ? Math.max(phase.startWave, Math.floor(a.powerWave)) : phase.startWave;
    out.active = { phaseIndex: a.phaseIndex, startWave: phase.startWave, endWave: phase.endWave, powerWave: power, won: a.won === true };
  }
  return out;
}
