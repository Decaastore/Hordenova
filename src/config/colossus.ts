/**
 * CHEFE GLOBAL — "A Serpente do Eclipse". A weekly raid boss with ONE shared
 * life bar for the whole community: every attempt (a room of up to
 * COLOSSUS_ROOM_SIZE players, each with a single tower — their strongest)
 * chips damage off the same weekly pool.
 *
 * PREVIEW: there is no game server yet, so the other 11 players of a room and
 * every other room's damage are SIMULATED (deterministic per week). The UI
 * says so plainly. When a server exists only `worldDamageOthers` and the room
 * roster change — the attempt itself, the rewards and the save stay the same.
 *
 * Rewards are kept small on Gems on purpose (Gems are a paid currency):
 *   - first attempt of the day: COLOSSUS_DAILY_GEMS Free Gem
 *   - the world beating the Serpent that week (having taken part): COLOSSUS_WORLD_GEMS
 * Everything else pays Forge materials, weekly Eclipse Marks and two
 * permanent cosmetics that show on the towers in the Season AND the Eternal
 * castle.
 */
import { duelWeek } from "./duel";

export const COLOSSUS_ROOM_SIZE = 12;
export const COLOSSUS_ATTEMPTS_PER_DAY = 3;
/** One attempt: the Serpent's head reaches the Eclipse core at this moment. */
export const COLOSSUS_LENGTH_MS = 150_000;
/** The Serpent's shared weekly life (simulated world until a server exists). */
export const COLOSSUS_WORLD_HP = 5_000_000_000;
export const COLOSSUS_DAILY_GEMS = 1;
export const COLOSSUS_WORLD_GEMS = 3;

export type ColossusPhaseId = "AWAKEN" | "STARFALL" | "ECLIPSE";
export const COLOSSUS_PHASES: readonly { id: ColossusPhaseId; fromMs: number }[] = [
  { id: "AWAKEN", fromMs: 0 },
  { id: "STARFALL", fromMs: 45_000 },
  { id: "ECLIPSE", fromMs: 100_000 },
];

export function colossusPhaseAt(timeMs: number): ColossusPhaseId {
  let id: ColossusPhaseId = "AWAKEN";
  for (const p of COLOSSUS_PHASES) if (timeMs >= p.fromMs) id = p.id;
  return id;
}

export interface ColossusPrize {
  splinters: number;
  rare: number;
  epic: number;
  legendary: number;
  gems: number;
  marks: number;
}

export const NO_COLOSSUS_PRIZE: ColossusPrize = { splinters: 0, rare: 0, epic: 0, legendary: 0, gems: 0, marks: 0 };

/** What one attempt pays, by the player's place in the room (1 = most damage). */
export function placePrize(place: number): ColossusPrize {
  if (place <= 1) return { ...NO_COLOSSUS_PRIZE, splinters: 60, epic: 1, marks: 10 };
  if (place <= 3) return { ...NO_COLOSSUS_PRIZE, splinters: 40, rare: 2, marks: place === 2 ? 7 : 5 };
  if (place <= 6) return { ...NO_COLOSSUS_PRIZE, splinters: 25, rare: 1, marks: 3 };
  return { ...NO_COLOSSUS_PRIZE, splinters: 15, rare: 1, marks: 1 };
}

export type ColossusCosmeticId = "ECLIPSE_SIGIL" | "ECLIPSE_CROWN";

/** Weekly Eclipse Marks goals. The cosmetics are permanent once earned; the material goal repeats every week. */
export const COLOSSUS_MARK_GOALS: readonly { marks: number; prize: ColossusPrize; cosmetic?: ColossusCosmeticId }[] = [
  { marks: 15, prize: NO_COLOSSUS_PRIZE, cosmetic: "ECLIPSE_SIGIL" },
  { marks: 25, prize: { ...NO_COLOSSUS_PRIZE, splinters: 100, legendary: 1 } },
  { marks: 40, prize: NO_COLOSSUS_PRIZE, cosmetic: "ECLIPSE_CROWN" },
];

export interface ColossusProfile {
  /** UTC day of `attemptsUsed`. */
  day: number;
  attemptsUsed: number;
  /** Last UTC day the daily Free Gem was paid. */
  gemDay: number;
  /** Week of the weekly counters below. */
  week: number;
  weekMarks: number;
  weekDamage: number;
  weekAttempts: number;
  /** Indexes of COLOSSUS_MARK_GOALS already paid this week. */
  goalsPaid: number[];
  /** Week whose world-victory prize was already paid. */
  worldPaidWeek: number;
  owned: ColossusCosmeticId[];
  equipped: ColossusCosmeticId | null;
  bestDamage: number;
  bestPlace: number;
}

export function createColossusProfile(): ColossusProfile {
  return { day: -1, attemptsUsed: 0, gemDay: -1, week: -1, weekMarks: 0, weekDamage: 0, weekAttempts: 0, goalsPaid: [], worldPaidWeek: -1, owned: [], equipped: null, bestDamage: 0, bestPlace: 0 };
}

const COSMETICS: readonly ColossusCosmeticId[] = ["ECLIPSE_SIGIL", "ECLIPSE_CROWN"];
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0) => Math.floor(num(v, d));

export function sanitizeColossusProfile(raw: unknown): ColossusProfile {
  if (!raw || typeof raw !== "object") return createColossusProfile();
  const r = raw as Record<string, unknown>;
  const owned = Array.isArray(r.owned) ? COSMETICS.filter((c) => (r.owned as unknown[]).includes(c)) : [];
  const equipped = typeof r.equipped === "string" && owned.includes(r.equipped as ColossusCosmeticId) ? (r.equipped as ColossusCosmeticId) : null;
  return {
    day: int(r.day, -1),
    attemptsUsed: Math.max(0, Math.min(COLOSSUS_ATTEMPTS_PER_DAY, int(r.attemptsUsed))),
    gemDay: int(r.gemDay, -1),
    week: int(r.week, -1),
    weekMarks: Math.max(0, int(r.weekMarks)),
    weekDamage: Math.max(0, num(r.weekDamage)),
    weekAttempts: Math.max(0, int(r.weekAttempts)),
    goalsPaid: Array.isArray(r.goalsPaid) ? [...new Set((r.goalsPaid as unknown[]).filter((x): x is number => typeof x === "number" && x >= 0 && x < COLOSSUS_MARK_GOALS.length))] : [],
    worldPaidWeek: int(r.worldPaidWeek, -1),
    owned,
    equipped,
    bestDamage: Math.max(0, num(r.bestDamage)),
    bestPlace: Math.max(0, int(r.bestPlace)),
  };
}

export const utcDay = (nowMs: number) => Math.floor(nowMs / 86_400_000);
export const colossusWeek = duelWeek;

/** The profile with the day/week counters rolled over to `nowMs`. */
export function rollColossus(p: ColossusProfile, nowMs: number): ColossusProfile {
  const day = utcDay(nowMs);
  const week = colossusWeek(nowMs);
  let next = p;
  if (p.day !== day) next = { ...next, day, attemptsUsed: 0 };
  if (p.week !== week) next = { ...next, week, weekMarks: 0, weekDamage: 0, weekAttempts: 0, goalsPaid: [] };
  return next;
}

export function attemptsLeft(p: ColossusProfile, nowMs: number): number {
  return COLOSSUS_ATTEMPTS_PER_DAY - rollColossus(p, nowMs).attemptsUsed;
}

/** Spends one attempt (call when the attempt STARTS — quitting still uses it). null when none is left today. */
export function spendAttempt(p: ColossusProfile, nowMs: number): ColossusProfile | null {
  const cur = rollColossus(p, nowMs);
  if (cur.attemptsUsed >= COLOSSUS_ATTEMPTS_PER_DAY) return null;
  return { ...cur, attemptsUsed: cur.attemptsUsed + 1 };
}

const WEEK_MS = 7 * 86_400_000;
const WEEK_EPOCH = Date.UTC(1970, 0, 5);

/** 0..1 — how far the current week has gone. */
export function weekProgress(nowMs: number): number {
  return Math.max(0, Math.min(1, (nowMs - WEEK_EPOCH - colossusWeek(nowMs) * WEEK_MS) / WEEK_MS));
}

/** UTC ms when the current week's Serpent leaves. */
export function weekEndsAt(nowMs: number): number {
  return WEEK_EPOCH + (colossusWeek(nowMs) + 1) * WEEK_MS;
}

/**
 * SIMULATED — the damage every OTHER room has dealt this week. A smooth curve
 * that brings the Serpent down around Saturday (82% of the week), with a
 * small per-week wobble so it isn't the same moment every week.
 */
export function worldDamageOthers(nowMs: number): number {
  const week = colossusWeek(nowMs);
  const wobble = 0.76 + ((Math.sin(week * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.12;
  const x = Math.min(1, weekProgress(nowMs) / wobble);
  const s = x * x * (3 - 2 * x);
  return COLOSSUS_WORLD_HP * (0.02 + 0.98 * s);
}

export interface WorldState {
  hpLeft: number;
  fraction: number;
  defeated: boolean;
}

export function worldState(p: ColossusProfile, nowMs: number): WorldState {
  const cur = rollColossus(p, nowMs);
  const dealt = worldDamageOthers(nowMs) + cur.weekDamage;
  const hpLeft = Math.max(0, COLOSSUS_WORLD_HP - dealt);
  return { hpLeft, fraction: hpLeft / COLOSSUS_WORLD_HP, defeated: hpLeft <= 0 };
}

export interface AttemptResult {
  profile: ColossusProfile;
  prize: ColossusPrize;
  dailyGem: boolean;
  newCosmetics: ColossusCosmeticId[];
  goalsReached: number[];
}

function addPrize(a: ColossusPrize, b: ColossusPrize): ColossusPrize {
  return { splinters: a.splinters + b.splinters, rare: a.rare + b.rare, epic: a.epic + b.epic, legendary: a.legendary + b.legendary, gems: a.gems + b.gems, marks: a.marks + b.marks };
}

/** Books a finished attempt: place prize, daily Gem, weekly Marks goals and cosmetics. */
export function applyAttempt(p: ColossusProfile, place: number, damage: number, nowMs: number): AttemptResult {
  const cur = rollColossus(p, nowMs);
  let prize = placePrize(place);
  const dailyGem = cur.gemDay !== cur.day;
  if (dailyGem) prize = { ...prize, gems: prize.gems + COLOSSUS_DAILY_GEMS };
  const weekMarks = cur.weekMarks + prize.marks;
  const goalsPaid = [...cur.goalsPaid];
  const owned = [...cur.owned];
  const newCosmetics: ColossusCosmeticId[] = [];
  const goalsReached: number[] = [];
  COLOSSUS_MARK_GOALS.forEach((g, i) => {
    if (weekMarks < g.marks || goalsPaid.includes(i)) return;
    goalsPaid.push(i);
    goalsReached.push(i);
    prize = addPrize(prize, g.prize);
    if (g.cosmetic && !owned.includes(g.cosmetic)) {
      owned.push(g.cosmetic);
      newCosmetics.push(g.cosmetic);
    }
  });
  const profile: ColossusProfile = {
    ...cur,
    gemDay: cur.day,
    weekMarks,
    weekDamage: cur.weekDamage + damage,
    weekAttempts: cur.weekAttempts + 1,
    goalsPaid,
    owned,
    // a freshly earned cosmetic goes straight on
    equipped: newCosmetics.length ? newCosmetics[newCosmetics.length - 1]! : cur.equipped,
    bestDamage: Math.max(cur.bestDamage, damage),
    bestPlace: cur.bestPlace === 0 ? place : Math.min(cur.bestPlace, place),
  };
  return { profile, prize, dailyGem, newCosmetics, goalsReached };
}

/** The world-victory prize: once per week, only for players who took part that week. */
export function claimWorldPrize(p: ColossusProfile, nowMs: number): { profile: ColossusProfile; gems: number } | null {
  const cur = rollColossus(p, nowMs);
  if (cur.weekAttempts <= 0 || cur.worldPaidWeek === cur.week || !worldState(cur, nowMs).defeated) return null;
  return { profile: { ...cur, worldPaidWeek: cur.week }, gems: COLOSSUS_WORLD_GEMS };
}

export function toggleColossusCosmetic(p: ColossusProfile, id: ColossusCosmeticId): ColossusProfile | null {
  if (!p.owned.includes(id)) return null;
  return { ...p, equipped: p.equipped === id ? null : id };
}

/**
 * One tower's raw power turned into raid damage per second. Square root on
 * purpose: a tower twice as strong deals ~41% more, so a big account helps
 * but never carries a room alone (competitive fairness).
 */
export function raidPower(dps: number): number {
  return Math.round(1000 * Math.sqrt(Math.max(1, dps) / 40));
}
