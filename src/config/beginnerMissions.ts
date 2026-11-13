import type { RewardBundle } from "./rewardBundle";
import type { SaveData } from "@/engine/SaveSystem";

/**
 * PRIMEIROS PASSOS — a one-time checklist that walks a new player through
 * the game. Each step is checked straight from the save (nothing extra to
 * track), pays a small reward when claimed, and finishing all of them
 * gives the Recruit's Keep castle skin.
 */
export type BeginnerMissionId =
  | "WAVE_5"
  | "TOWERS_3"
  | "TOWER_LV5"
  | "FIRST_BOSS"
  | "WAVE_15"
  | "EQUIP_ITEM"
  | "PASS_CLAIM"
  | "WAVE_30"
  | "DUEL"
  | "COLOSSUS";

export interface BeginnerMission {
  id: BeginnerMissionId;
  done: (s: SaveData) => boolean;
  reward: RewardBundle;
}

export const BEGINNER_MISSIONS: readonly BeginnerMission[] = [
  { id: "WAVE_5", done: (s) => s.bestWave >= 5, reward: { gold: 300 } },
  { id: "TOWERS_3", done: (s) => s.towerLoadout.length >= 3, reward: { shards: 3 } },
  { id: "TOWER_LV5", done: (s) => s.towerLoadout.some((t) => t.level >= 5), reward: { gold: 500 } },
  { id: "FIRST_BOSS", done: (s) => s.bossesDefeatedTotal >= 1, reward: { shards: 5 } },
  { id: "WAVE_15", done: (s) => s.bestWave >= 15, reward: { splinters: 15 } },
  { id: "EQUIP_ITEM", done: (s) => s.towerLoadout.some((t) => (t.equippedItemInstanceIds ?? []).some((x) => !!x)), reward: { rare: 2 } },
  { id: "PASS_CLAIM", done: (s) => (s.seasonPass?.claimedFree.length ?? 0) > 0, reward: { gold: 800 } },
  { id: "WAVE_30", done: (s) => s.bestWave >= 30, reward: { shards: 8 } },
  { id: "DUEL", done: (s) => s.duel.wins + s.duel.losses > 0, reward: { splinters: 25 } },
  { id: "COLOSSUS", done: (s) => s.colossus.bestDamage > 0, reward: { freeGems: 1 } },
];

/** Finishing every step. */
export const BEGINNER_FINAL_REWARD: RewardBundle = { castleSkinId: "RECRUIT_KEEP", freeGems: 2 };

export interface BeginnerState {
  claimed: BeginnerMissionId[];
  finalClaimed: boolean;
}

export function createBeginnerState(): BeginnerState {
  return { claimed: [], finalClaimed: false };
}

export function sanitizeBeginnerState(raw: unknown): BeginnerState {
  if (!raw || typeof raw !== "object") return createBeginnerState();
  const r = raw as Record<string, unknown>;
  const ids = new Set(BEGINNER_MISSIONS.map((m) => m.id));
  const claimed = Array.isArray(r.claimed) ? [...new Set((r.claimed as unknown[]).filter((x): x is BeginnerMissionId => typeof x === "string" && ids.has(x as BeginnerMissionId)))] : [];
  return { claimed, finalClaimed: r.finalClaimed === true };
}

export function claimBeginner(s: SaveData, id: BeginnerMissionId): { state: BeginnerState; reward: RewardBundle } | null {
  const m = BEGINNER_MISSIONS.find((x) => x.id === id);
  if (!m || s.beginner.claimed.includes(id) || !m.done(s)) return null;
  return { state: { ...s.beginner, claimed: [...s.beginner.claimed, id] }, reward: m.reward };
}

export function claimBeginnerFinal(s: SaveData): { state: BeginnerState; reward: RewardBundle } | null {
  if (s.beginner.finalClaimed || s.beginner.claimed.length < BEGINNER_MISSIONS.length) return null;
  return { state: { ...s.beginner, finalClaimed: true }, reward: BEGINNER_FINAL_REWARD };
}

/** The checklist is shown until the final reward is claimed. */
export function beginnerVisible(s: SaveData): boolean {
  return !s.beginner.finalClaimed;
}
