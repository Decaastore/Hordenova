/**
 * DAILY MISSIONS — three small goals a day that reward Gem Shards and Gold.
 * The same three for every player on a given day (picked from the day
 * index), so they're fair to compare and easy to talk about.
 *
 * Rewards are sized against the existing economy: 10 Gem Shards = 1 Free
 * Gem (GameEngine.GEM_SHARD_TO_GEM_RATE), and a boss/mini-boss kill gives
 * 2 Shards. All three missions together come to 12 Shards (about one Free
 * Gem a day, the same as the Store's daily gift) plus Gold worth roughly
 * 30 kills each at the player's current wave.
 */

export type MissionKind = "KILL_ENEMIES" | "CLEAR_WAVES" | "DEFEAT_MINI_BOSSES" | "UPGRADE_TOWERS" | "FREEZE_ENEMIES";

export interface MissionDefinition {
  kind: MissionKind;
  target: number;
}

/** The pool the day's three missions are drawn from — each one reachable in a normal play session at any point of the game (no "beat a main boss", which can be 20 waves away). */
export const MISSION_POOL: readonly MissionDefinition[] = [
  { kind: "KILL_ENEMIES", target: 300 },
  { kind: "CLEAR_WAVES", target: 15 },
  { kind: "DEFEAT_MINI_BOSSES", target: 2 },
  { kind: "UPGRADE_TOWERS", target: 10 },
  { kind: "FREEZE_ENEMIES", target: 40 },
];

export const MISSIONS_PER_DAY = 3;
export const MISSION_REWARD_SHARDS = 4;
/** Gold reward = this many kills' worth of a basic enemy at the player's current wave. */
export const MISSION_REWARD_KILLS_WORTH_OF_GOLD = 30;

function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** The day's missions, as indexes into MISSION_POOL — deterministic per day, always distinct. */
export function missionsForDay(dayIndex: number): MissionDefinition[] {
  const order = MISSION_POOL.map((_, i) => i).sort((a, b) => hash(dayIndex * 31 + a) - hash(dayIndex * 31 + b));
  return order.slice(0, MISSIONS_PER_DAY).map((i) => MISSION_POOL[i]!);
}

/** Saved per account: which day the progress belongs to, and each mission's progress and claim state. */
export interface DailyMissionsState {
  dayIndex: number;
  progress: number[];
  claimed: boolean[];
}

export function freshMissionsState(dayIndex: number): DailyMissionsState {
  return { dayIndex, progress: Array(MISSIONS_PER_DAY).fill(0), claimed: Array(MISSIONS_PER_DAY).fill(false) };
}

export function parseDailyMissionsState(raw: unknown): DailyMissionsState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<DailyMissionsState>;
  if (typeof r.dayIndex !== "number" || !Array.isArray(r.progress) || !Array.isArray(r.claimed)) return null;
  const progress = Array.from({ length: MISSIONS_PER_DAY }, (_, i) => Math.max(0, Number(r.progress![i]) || 0));
  const claimed = Array.from({ length: MISSIONS_PER_DAY }, (_, i) => r.claimed![i] === true);
  return { dayIndex: r.dayIndex, progress, claimed };
}
