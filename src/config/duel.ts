import type { TowerType } from "./towerStats";
import type { EnemyType } from "./enemyStats";

/**
 * DUELO 1x1 — a short match against one opponent (the AI for now). Each
 * side has its own road and castle. You play cards with mana: tower cards
 * build (or level up) a tower on your road, creature cards send a group down
 * the opponent's road. Break their castle — or have more castle left when
 * time runs out — to win. Same cards and numbers for everyone; nothing bought
 * changes a Duel (cosmetics only), and the match is deterministic for a seed.
 */

// ── cards ───────────────────────────────────────────────────────────────
export type DuelCardId =
  | "T_IRONWOOD"
  | "T_INFERNO"
  | "T_FROSTBORN"
  | "T_STORMCALLER"
  | "S_CRAWLERS"
  | "S_RUNNERS"
  | "S_BRUTE"
  | "S_SWARM"
  | "S_SHIELDS"
  | "S_IRONCLAD";

export interface DuelTowerCard {
  id: DuelCardId;
  kind: "TOWER";
  cost: number;
  tower: TowerType;
  /** Per tower level 1..3. */
  damage: readonly [number, number, number];
  /** Attacks per second. */
  rate: number;
  range: number;
  /** INFERNO: splash radius. */
  splash?: number;
  /** FROSTBORN: slow (fraction of speed removed) for 1.5s. */
  slow?: number;
  /** STORMCALLER: extra targets hit by each bolt. */
  chain?: number;
}

export interface DuelSendCard {
  id: DuelCardId;
  kind: "SEND";
  cost: number;
  enemy: EnemyType;
  count: number;
  hp: number;
  /** World units per second. */
  speed: number;
  /** Castle damage when it gets through. */
  breach: number;
  /** Fraction of every hit ignored. */
  armor?: number;
}

export type DuelCard = DuelTowerCard | DuelSendCard;

export const DUEL_CARDS: readonly DuelCard[] = [
  { id: "T_IRONWOOD", kind: "TOWER", cost: 3, tower: "IRONWOOD", damage: [34, 52, 78], rate: 1.1, range: 150 },
  { id: "T_INFERNO", kind: "TOWER", cost: 4, tower: "INFERNO", damage: [16, 25, 38], rate: 0.8, range: 120, splash: 55 },
  { id: "T_FROSTBORN", kind: "TOWER", cost: 3, tower: "FROSTBORN", damage: [9, 14, 21], rate: 1, range: 130, slow: 0.4 },
  { id: "T_STORMCALLER", kind: "TOWER", cost: 5, tower: "STORMCALLER", damage: [22, 34, 50], rate: 0.75, range: 140, chain: 2 },
  { id: "S_CRAWLERS", kind: "SEND", cost: 2, enemy: "CRAWLER", count: 4, hp: 70, speed: 46, breach: 1 },
  { id: "S_RUNNERS", kind: "SEND", cost: 3, enemy: "RUNNER", count: 3, hp: 60, speed: 82, breach: 1 },
  { id: "S_BRUTE", kind: "SEND", cost: 4, enemy: "BRUTE", count: 1, hp: 520, speed: 34, breach: 3 },
  { id: "S_SWARM", kind: "SEND", cost: 5, enemy: "SWARMLING", count: 10, hp: 38, speed: 58, breach: 1 },
  { id: "S_SHIELDS", kind: "SEND", cost: 4, enemy: "SHIELDBEARER", count: 2, hp: 210, speed: 40, breach: 2, armor: 0.35 },
  { id: "S_IRONCLAD", kind: "SEND", cost: 6, enemy: "IRONCLAD", count: 1, hp: 900, speed: 30, breach: 5, armor: 0.25 },
];

export function getDuelCard(id: string): DuelCard | null {
  return DUEL_CARDS.find((c) => c.id === id) ?? null;
}

export const DECK_SIZE = 8;
export const HAND_SIZE = 4;
export const DEFAULT_DECK: readonly DuelCardId[] = ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_CRAWLERS", "S_RUNNERS", "S_BRUTE", "S_SHIELDS"];

export function sanitizeDeck(raw: unknown): DuelCardId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_DECK];
  const ids = [...new Set(raw.filter((x): x is DuelCardId => typeof x === "string" && !!getDuelCard(x)))];
  const towers = ids.filter((id) => getDuelCard(id)!.kind === "TOWER").length;
  const sends = ids.length - towers;
  return ids.length === DECK_SIZE && towers >= 2 && sends >= 2 ? ids : [...DEFAULT_DECK];
}

/** A deck needs 8 different cards with at least 2 towers and 2 creatures. */
export function isValidDeck(ids: readonly string[]): boolean {
  return sanitizeDeck(ids).join() === [...new Set(ids)].join() && ids.length === DECK_SIZE;
}

// ── match rules ─────────────────────────────────────────────────────────
export const DUEL_TICK_MS = 50;
export const DUEL_LENGTH_MS = 180_000;
/** The last minute fills mana twice as fast. */
export const DUEL_DOUBLE_MANA_FROM_MS = 120_000;
export const DUEL_START_MANA = 5;
export const DUEL_MAX_MANA = 10;
export const DUEL_MANA_EVERY_MS = 2000;
export const DUEL_CASTLE_HP = 20;
export const MAX_DUEL_TOWER_LEVEL = 3;
/** Sent creatures gain this much of their life per minute of match. */
export const DUEL_HP_GROWTH_PER_MIN = 1.5;

// ── arenas and trophies ────────────────────────────────────────────────
export interface DuelArena {
  id: string;
  minTrophies: number;
  /** Biome whose ground the arena uses. */
  biome: string;
  /** AI skill 0..1 in this arena. */
  ai: number;
}

export const DUEL_ARENAS: readonly DuelArena[] = [
  { id: "ARENA_FOREST", minTrophies: 0, biome: "ANCIENT_FOREST", ai: 0.25 },
  { id: "ARENA_VOLCANO", minTrophies: 300, biome: "VOLCANIC_WASTES", ai: 0.45 },
  { id: "ARENA_TUNDRA", minTrophies: 700, biome: "FROZEN_TUNDRA", ai: 0.65 },
  { id: "ARENA_ABYSS", minTrophies: 1200, biome: "ABYSS", ai: 0.85 },
];

export function arenaFor(trophies: number): DuelArena {
  let a = DUEL_ARENAS[0]!;
  for (const x of DUEL_ARENAS) if (trophies >= x.minTrophies) a = x;
  return a;
}

export const TROPHIES_WIN = 30;
export const TROPHIES_LOSS = 20;
export const TROPHIES_DRAW = 0;
/** Gem Shards for a win — the only reward; nothing a Duel gives makes towers stronger. */
export const DUEL_WIN_SHARDS = 1;
/** At most this many rewarded wins per day. */
export const DUEL_REWARDED_WINS_PER_DAY = 5;

export interface DuelProfile {
  trophies: number;
  bestTrophies: number;
  wins: number;
  losses: number;
  deck: DuelCardId[];
  rewardDay: number;
  rewardedToday: number;
  /** Week whose Weekly Challenge was beaten (-1 none). */
  weeklyWonWeek: number;
}

export function createDuelProfile(): DuelProfile {
  return { trophies: 0, bestTrophies: 0, wins: 0, losses: 0, deck: [...DEFAULT_DECK], rewardDay: -1, rewardedToday: 0, weeklyWonWeek: -1 };
}

const int = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : d);

export function sanitizeDuelProfile(raw: unknown): DuelProfile {
  if (!raw || typeof raw !== "object") return createDuelProfile();
  const r = raw as Record<string, unknown>;
  const trophies = int(r.trophies);
  return {
    trophies,
    bestTrophies: Math.max(trophies, int(r.bestTrophies)),
    wins: int(r.wins),
    losses: int(r.losses),
    deck: sanitizeDeck(r.deck),
    rewardDay: typeof r.rewardDay === "number" ? Math.floor(r.rewardDay) : -1,
    rewardedToday: int(r.rewardedToday),
    weeklyWonWeek: typeof r.weeklyWonWeek === "number" ? Math.floor(r.weeklyWonWeek) : -1,
  };
}

export type DuelOutcome = "WIN" | "LOSS" | "DRAW";

/** The profile after a match, and the Shards it paid. */
export function applyDuelResult(p: DuelProfile, outcome: DuelOutcome, nowMs: number): { profile: DuelProfile; shards: number } {
  const day = Math.floor(nowMs / 86_400_000);
  const rewardedToday = p.rewardDay === day ? p.rewardedToday : 0;
  const delta = outcome === "WIN" ? TROPHIES_WIN : outcome === "LOSS" ? -TROPHIES_LOSS : TROPHIES_DRAW;
  // never drop below the floor of the arena you're in
  const floor = arenaFor(p.trophies).minTrophies;
  const trophies = Math.max(floor, p.trophies + delta);
  const paid = outcome === "WIN" && rewardedToday < DUEL_REWARDED_WINS_PER_DAY;
  return {
    profile: {
      ...p,
      trophies,
      bestTrophies: Math.max(p.bestTrophies, trophies),
      wins: p.wins + (outcome === "WIN" ? 1 : 0),
      losses: p.losses + (outcome === "LOSS" ? 1 : 0),
      rewardDay: day,
      rewardedToday: rewardedToday + (paid ? 1 : 0),
    },
    shards: paid ? DUEL_WIN_SHARDS : 0,
  };
}

// ── weekly challenge ────────────────────────────────────────────────────
/**
 * DESAFIO SEMANAL — one fixed match a week, the same for everyone: the same
 * seed, your deck and the opponent's deck are set, and the opponent plays at
 * full skill. Beat it once in the week for its reward. Trophies don't move.
 */
export const WEEKLY_CHALLENGE_SHARDS = 3;
export const WEEKLY_CHALLENGE_AI = 0.95;

export interface WeeklyChallenge {
  week: number;
  seed: number;
  myDeck: DuelCardId[];
  foeDeck: DuelCardId[];
}

/** Week number (Monday-based, UTC). */
export function duelWeek(nowMs: number): number {
  return Math.floor((nowMs - Date.UTC(1970, 0, 5)) / (7 * 86_400_000));
}

export function weeklyChallenge(week: number): WeeklyChallenge {
  const towers = DUEL_CARDS.filter((c) => c.kind === "TOWER").map((c) => c.id);
  const sends = DUEL_CARDS.filter((c) => c.kind === "SEND").map((c) => c.id);
  const pick = (list: DuelCardId[], n: number, salt: number) => {
    const l = [...list];
    let s = (week * 2654435761 + salt) >>> 0 || 1;
    const out: DuelCardId[] = [];
    while (out.length < n) {
      s = (s * 16807) % 2147483647;
      out.push(l.splice(s % l.length, 1)[0]!);
    }
    return out;
  };
  return { week, seed: week * 7919 + 13, myDeck: [...pick(towers, 3, 1), ...pick(sends, 5, 2)], foeDeck: [...pick(towers, 4, 3), ...pick(sends, 4, 4)] };
}
