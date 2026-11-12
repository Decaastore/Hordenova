import type { EnemyVoiceFamily } from "./enemyVoice";
import type { TowerType } from "./towerStats";
import type { TowerLoadoutEntry } from "@/entities/Tower";

/**
 * MODO ETERNO — the castle that never resets. Every account gets one; at
 * the end of each Season the Season castle is merged into it (see
 * mergeCastles), and in between it can be played as its own infinite mode.
 * The goals that keep an infinite mode interesting live here: depths every
 * 100 waves, a reward every 50 waves of the Eternal record, three weekly
 * contracts, and the Eternal Merchant that spends what they pay (Eternal
 * Marks). Same rules for everyone.
 */

// ── depths ──────────────────────────────────────────────────────────────
export const DEPTH_EVERY = 100;

/** Depth of a wave: 0 for waves 1-100, I for 101-200, II for 201-300… */
export function depthOfWave(wave: number): number {
  return Math.max(0, Math.floor((Math.max(1, wave) - 1) / DEPTH_EVERY));
}

/** Marks paid the first time a depth is reached. */
export function depthReward(depth: number): number {
  return 100 + 50 * depth;
}

export function romanDepth(depth: number): string {
  const r: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let n = depth;
  let out = "";
  for (const [v, s] of r) while (n >= v) {
    out += s;
    n -= v;
  }
  return out || "0";
}

// ── wave milestones ─────────────────────────────────────────────────────
export const MILESTONE_EVERY = 50;

export interface MilestoneReward {
  marks: number;
  shards: number;
}

/** The reward for reaching wave `n * MILESTONE_EVERY` of the Eternal record. */
export function milestoneReward(n: number): MilestoneReward {
  return { marks: 30 + 10 * n, shards: 3 + Math.floor(n / 2) };
}

/** Milestones reached by `record` and not yet claimed. */
export function claimableMilestones(record: number, claimedUpTo: number): number[] {
  const reached = Math.floor(record / MILESTONE_EVERY);
  const out: number[] = [];
  for (let n = claimedUpTo + 1; n <= reached; n++) out.push(n);
  return out;
}

// ── weekly contracts ────────────────────────────────────────────────────
export type ContractKind = "KILL_FAMILY" | "CLEAR_WAVES" | "CLEAN_WAVES" | "MINI_BOSSES" | "RIFTS";

export interface ContractDef {
  id: string;
  kind: ContractKind;
  target: number;
  family?: EnemyVoiceFamily;
  /** For RIFTS: minimum curses on the Rift. */
  minCurses?: number;
  marks: number;
}

const FAMILIES: EnemyVoiceFamily[] = ["beast", "insect", "brute", "undead", "winged"];

/** Week number (Monday-based, UTC) — contracts change every Monday. */
export function weekIndex(nowMs: number): number {
  // 1970-01-05 was a Monday
  return Math.floor((nowMs - Date.UTC(1970, 0, 5)) / (7 * 24 * 3600 * 1000));
}

function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** The three contracts of a week — the same for everyone that week. */
export function contractsForWeek(week: number): ContractDef[] {
  const r = rng(week + 7);
  const family = FAMILIES[Math.floor(r() * FAMILIES.length)]!;
  const pool: ContractDef[] = [
    { id: `w${week}-kill`, kind: "KILL_FAMILY", family, target: 1500, marks: 80 },
    { id: `w${week}-waves`, kind: "CLEAR_WAVES", target: 120, marks: 70 },
    { id: `w${week}-clean`, kind: "CLEAN_WAVES", target: 40, marks: 90 },
    { id: `w${week}-mini`, kind: "MINI_BOSSES", target: 12, marks: 80 },
    { id: `w${week}-rifts`, kind: "RIFTS", target: 3, minCurses: 2, marks: 110 },
  ];
  // pick 3 distinct, deterministic for the week
  const picked: ContractDef[] = [];
  const left = [...pool];
  while (picked.length < 3) picked.push(left.splice(Math.floor(r() * left.length), 1)[0]!);
  return picked;
}

// ── merchant ────────────────────────────────────────────────────────────
export type MerchantOfferId = "SHARD_POUCH" | "RIFT_SCROLL" | "RELIC_ROLL";

export interface MerchantOffer {
  id: MerchantOfferId;
  price: number;
}

/** What Eternal Marks buy. Prices are the whole truth; the relic roll uses the Rift table shown in its panel. */
export const MERCHANT_OFFERS: readonly MerchantOffer[] = [
  { id: "SHARD_POUCH", price: 120 },
  { id: "RIFT_SCROLL", price: 180 },
  { id: "RELIC_ROLL", price: 250 },
];
export const SHARD_POUCH_AMOUNT = 10;

// ── state ───────────────────────────────────────────────────────────────
export interface EternalState {
  marks: number;
  /** Highest depth whose reward was paid. -1 none. */
  depthRewarded: number;
  /** Milestones paid up to (n = record / 50). */
  milestonesClaimed: number;
  /** Week the progress below belongs to. */
  week: number;
  /** Progress per contract id this week. */
  progress: Record<string, number>;
  /** Contract ids whose reward was paid this week. */
  claimed: string[];
}

export function createEternalState(nowMs = Date.now()): EternalState {
  return { marks: 0, depthRewarded: 0, milestonesClaimed: 0, week: weekIndex(nowMs), progress: {}, claimed: [] };
}

const num = (v: unknown, d: number, min = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.floor(v)) : d);

export function sanitizeEternalState(raw: unknown, nowMs = Date.now()): EternalState {
  if (!raw || typeof raw !== "object") return createEternalState(nowMs);
  const r = raw as Record<string, unknown>;
  const progress: Record<string, number> = {};
  if (r.progress && typeof r.progress === "object") {
    for (const [k, v] of Object.entries(r.progress as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v) && v > 0) progress[k] = Math.floor(v);
  }
  const state: EternalState = {
    marks: num(r.marks, 0),
    depthRewarded: num(r.depthRewarded, 0),
    milestonesClaimed: num(r.milestonesClaimed, 0),
    week: num(r.week, weekIndex(nowMs)),
    progress,
    claimed: Array.isArray(r.claimed) ? r.claimed.filter((x): x is string => typeof x === "string") : [],
  };
  return rollWeek(state, nowMs);
}

/** A new week clears contract progress (marks and the rest stay). */
export function rollWeek(state: EternalState, nowMs: number): EternalState {
  const week = weekIndex(nowMs);
  if (week === state.week) return state;
  return { ...state, week, progress: {}, claimed: [] };
}

// ── season → eternal merge ─────────────────────────────────────────────
export interface MergeableCastle {
  seasonBestWave: number;
  gold: number;
  castleHpBonus: number;
  towerLoadout: TowerLoadoutEntry[];
  towerMasteryLevels: Partial<Record<TowerType, number>>;
  towerManaLevels: Partial<Record<TowerType, number>>;
}

/**
 * The castle that comes out when a Season castle joins the Eternal one. The
 * castle with the higher record keeps its map, towers and wave; every tower
 * takes the higher level of its type from either castle; Mastery and Mana
 * take the higher level per type; gold is added up; the record is the
 * higher one. With no Eternal castle yet, the Season castle simply becomes it.
 */
export function mergeCastles<T extends MergeableCastle>(season: T, eternal: T | null): T {
  if (!eternal) return { ...season };
  const [base, other] = season.seasonBestWave > eternal.seasonBestWave ? [season, eternal] : [eternal, season];
  const bestLevel = new Map<TowerType, number>();
  for (const e of other.towerLoadout) bestLevel.set(e.type, Math.max(bestLevel.get(e.type) ?? 0, e.level));
  const maxMap = (a: Partial<Record<TowerType, number>>, b: Partial<Record<TowerType, number>>) => {
    const out: Partial<Record<TowerType, number>> = { ...a };
    for (const [k, v] of Object.entries(b) as [TowerType, number][]) out[k] = Math.max(out[k] ?? 0, v);
    return out;
  };
  return {
    ...base,
    seasonBestWave: Math.max(season.seasonBestWave, eternal.seasonBestWave),
    gold: season.gold + eternal.gold,
    castleHpBonus: Math.max(season.castleHpBonus, eternal.castleHpBonus),
    towerLoadout: base.towerLoadout.map((e) => ({ ...e, level: Math.max(e.level, bestLevel.get(e.type) ?? 0) })),
    towerMasteryLevels: maxMap(base.towerMasteryLevels, other.towerMasteryLevels),
    towerManaLevels: maxMap(base.towerManaLevels, other.towerManaLevels),
  };
}
