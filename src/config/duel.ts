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
  | "S_IRONCLAD"
  | "X_METEOR"
  | "X_FREEZE"
  | "X_RAGE";

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

/**
 * FEITIÇOS — one-shot effects. METEOR and FREEZE are aimed at a spot on your
 * own road (they hit the creatures coming at you); RAGE is instant and speeds
 * up all your towers for a while.
 */
export interface DuelSpellCard {
  id: DuelCardId;
  kind: "SPELL";
  cost: number;
  effect: "METEOR" | "FREEZE" | "RAGE";
  /** Needs a spot on your road. */
  aimed: boolean;
  /** METEOR / FREEZE: radius of the area. */
  radius?: number;
  /** METEOR: damage, grows with the match like creature life does. */
  damage?: number;
  /** FREEZE / RAGE: how long it lasts. */
  durationMs?: number;
  /** RAGE: extra attack speed (0.6 = +60%). */
  boost?: number;
}

export type DuelCard = DuelTowerCard | DuelSendCard | DuelSpellCard;

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
  { id: "X_METEOR", kind: "SPELL", cost: 4, effect: "METEOR", aimed: true, radius: 75, damage: 170 },
  { id: "X_FREEZE", kind: "SPELL", cost: 3, effect: "FREEZE", aimed: true, radius: 90, durationMs: 2500 },
  { id: "X_RAGE", kind: "SPELL", cost: 3, effect: "RAGE", aimed: false, durationMs: 6000, boost: 0.6 },
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
  const sends = ids.filter((id) => getDuelCard(id)!.kind === "SEND").length;
  return ids.length === DECK_SIZE && towers >= 2 && sends >= 2 ? ids : [...DEFAULT_DECK];
}

/** A deck needs 8 different cards with at least 2 towers and 2 creatures (spells are optional). */
export function isValidDeck(ids: readonly string[]): boolean {
  return sanitizeDeck(ids).join() === [...new Set(ids)].join() && ids.length === DECK_SIZE;
}

/** Average mana cost of a deck (shown in the deck builder, like Clash's average elixir). */
export function deckAverageCost(ids: readonly string[]): number {
  const cards = ids.map((id) => getDuelCard(id)).filter((c): c is DuelCard => !!c);
  return cards.length ? cards.reduce((s, c) => s + c.cost, 0) / cards.length : 0;
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
/**
 * PRORROGAÇÃO — tied castles when time runs out: one more minute with triple
 * mana, and the first castle to take damage loses (sudden death). Still tied
 * after that, it's a draw.
 */
export const DUEL_OVERTIME_MS = 60_000;
export const DUEL_OVERTIME_MANA_EVERY_MS = DUEL_MANA_EVERY_MS / 3;
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
  { id: "ARENA_TUNDRA", minTrophies: 900, biome: "FROZEN_TUNDRA", ai: 0.65 },
  { id: "ARENA_ABYSS", minTrophies: 1500, biome: "ABYSS", ai: 0.85 },
];

export function arenaFor(trophies: number): DuelArena {
  let a = DUEL_ARENAS[0]!;
  for (const x of DUEL_ARENAS) if (trophies >= x.minTrophies) a = x;
  return a;
}

// ── ranked: leagues and divisions ──────────────────────────────────────
/**
 * RANQUEADO — like Counter-Strike's ranks: five leagues of three divisions
 * (100 trophies each), then Master and Legend. You can drop a division, but
 * never below the start of the league you're in. The opponent gets
 * stronger as you climb. Nothing here ever resets.
 */
export type LeagueId = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "MASTER" | "LEGEND";

export const LEAGUES: readonly { id: LeagueId; min: number; divisions: number }[] = [
  { id: "BRONZE", min: 0, divisions: 3 },
  { id: "SILVER", min: 300, divisions: 3 },
  { id: "GOLD", min: 600, divisions: 3 },
  { id: "PLATINUM", min: 900, divisions: 3 },
  { id: "DIAMOND", min: 1200, divisions: 3 },
  { id: "MASTER", min: 1500, divisions: 1 },
  { id: "LEGEND", min: 2000, divisions: 1 },
];
export const DIVISION_SIZE = 100;

export interface DuelRank {
  league: LeagueId;
  /** 1..3 inside the league (1 for Master and Legend). */
  division: number;
  /** 0-based index over every rank step (Bronze I = 0 … Legend = 16). */
  index: number;
  /** Trophies where this rank starts, and where the next one starts (null at Legend). */
  from: number;
  next: number | null;
}

/** Every rank step in order, with the trophies where it starts. */
export const RANK_STEPS: readonly { league: LeagueId; division: number; from: number }[] = LEAGUES.flatMap((l, i) => {
  const end = LEAGUES[i + 1]?.min ?? Infinity;
  if (l.divisions === 1) return [{ league: l.id, division: 1, from: l.min }];
  return Array.from({ length: l.divisions }, (_, d) => ({ league: l.id, division: d + 1, from: Math.min(end, l.min + d * DIVISION_SIZE) }));
});

export function rankFor(trophies: number): DuelRank {
  let index = 0;
  RANK_STEPS.forEach((r, i) => {
    if (trophies >= r.from) index = i;
  });
  const r = RANK_STEPS[index]!;
  return { league: r.league, division: r.division, index, from: r.from, next: RANK_STEPS[index + 1]?.from ?? null };
}

/** The trophies you can never drop below: the start of your league. */
export function leagueFloor(trophies: number): number {
  let floor = 0;
  for (const l of LEAGUES) if (trophies >= l.min) floor = l.min;
  return floor;
}

/** AI skill grows with trophies — every win is earned against a stronger opponent. */
export function duelAiSkill(trophies: number): number {
  return Math.min(0.97, 0.2 + Math.max(0, trophies) / 2200);
}

export function trophyDelta(trophies: number, outcome: DuelOutcome): number {
  const high = trophies >= 1500;
  return outcome === "WIN" ? (high ? 20 : 30) : outcome === "LOSS" ? (high ? -25 : -20) : 0;
}
export const TROPHIES_WIN = 30;
export const TROPHIES_LOSS = 20;

// ── rewards ─────────────────────────────────────────────────────────────
/**
 * What the Duel pays: Duel Coins only, its own currency, spent in the Duel
 * Shop on looks. Nothing from the Duel reaches the Season — no Gems, no Gem
 * Shards, no Forge materials (so no items).
 */
export interface DuelPrize {
  coins: number;
  /** Free Gems — they work in the whole game (Store, skins, speed-ups). */
  gems: number;
  shards: number;
  splinters: number;
  rare: number;
  epic: number;
  legendary: number;
}
export const NO_PRIZE: DuelPrize = { coins: 0, gems: 0, shards: 0, splinters: 0, rare: 0, epic: 0, legendary: 0 };
const P = (p: Partial<DuelPrize>): DuelPrize => ({ ...NO_PRIZE, ...p });

export function addPrize(a: DuelPrize, b: DuelPrize): DuelPrize {
  return { coins: a.coins + b.coins, gems: a.gems + b.gems, shards: a.shards + b.shards, splinters: a.splinters + b.splinters, rare: a.rare + b.rare, epic: a.epic + b.epic, legendary: a.legendary + b.legendary };
}

export const MATCH_COINS: Record<DuelOutcome, number> = { WIN: 12, LOSS: 4, DRAW: 6 };
export const FIRST_WIN_PRIZE = P({ coins: 40 });

/** Ranked wins in a week (Monday UTC) that pay Free Gems, once each per week. */
export const WEEKLY_WIN_GOALS: readonly { wins: number; prize: DuelPrize }[] = [
  { wins: 10, prize: P({ coins: 60 }) },
  { wins: 25, prize: P({ coins: 120 }) },
  { wins: 50, prize: P({ coins: 250 }) },
];
/** Finishing all three daily missions adds this. */
export const MISSIONS_ALL_DONE_PRIZE = P({ coins: 30 });
export const STREAK_PRIZES: readonly { at: number; prize: DuelPrize }[] = [
  { at: 3, prize: P({ coins: 30 }) },
  { at: 5, prize: P({ coins: 60 }) },
  { at: 10, prize: P({ coins: 150 }) },
];

/** Paid once, the first time a rank step is reached (by best trophies) — Duel Coins only. */
export function rankPrize(index: number): DuelPrize {
  const step = RANK_STEPS[index];
  if (!step || index === 0) return NO_PRIZE;
  if (step.division !== 1) return P({ coins: 80 });
  const byLeague: Record<LeagueId, [number, number]> = {
    BRONZE: [0, 0],
    SILVER: [250, 0],
    GOLD: [400, 0],
    PLATINUM: [600, 0],
    DIAMOND: [900, 0],
    MASTER: [1500, 0],
    LEGEND: [3000, 10],
  };
  const [coins, gems] = byLeague[step.league];
  return P({ coins, gems });
}

// ── daily missions ─────────────────────────────────────────────────────
export type DuelMissionKind = "PLAY" | "WIN" | "WIN_WITH" | "KO_WIN" | "CLEAN_WIN" | "SENDS";

export interface DuelMission {
  id: string;
  kind: DuelMissionKind;
  target: number;
  card?: DuelCardId;
  coins: number;
}

export interface DuelMatchStats {
  outcome: DuelOutcome;
  myCastle: number;
  foeCastle: number;
  sends: number;
  deck: readonly DuelCardId[];
}

/** Today's three missions — the same for everyone that day. */
export function duelMissionsFor(day: number): DuelMission[] {
  let s = (day * 2654435761 + 99) >>> 0 || 1;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const towers = DUEL_CARDS.filter((c) => c.kind === "TOWER").map((c) => c.id);
  const card = towers[Math.floor(r() * towers.length)]!;
  const pool: DuelMission[] = [
    { id: `m${day}-play`, kind: "PLAY", target: 3, coins: 30 },
    { id: `m${day}-win`, kind: "WIN", target: 2, coins: 40 },
    { id: `m${day}-with`, kind: "WIN_WITH", target: 1, card, coins: 35 },
    { id: `m${day}-ko`, kind: "KO_WIN", target: 1, coins: 50 },
    { id: `m${day}-clean`, kind: "CLEAN_WIN", target: 1, coins: 45 },
    { id: `m${day}-sends`, kind: "SENDS", target: 15, coins: 30 },
  ];
  const out: DuelMission[] = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]!);
  return out;
}

/** How much a match moves a mission forward. */
export function missionStep(m: DuelMission, st: DuelMatchStats): number {
  const win = st.outcome === "WIN";
  switch (m.kind) {
    case "PLAY":
      return 1;
    case "WIN":
      return win ? 1 : 0;
    case "WIN_WITH":
      return win && m.card && st.deck.includes(m.card) ? 1 : 0;
    case "KO_WIN":
      return win && st.foeCastle <= 0 ? 1 : 0;
    case "CLEAN_WIN":
      return win && st.myCastle >= DUEL_CASTLE_HP - 5 ? 1 : 0;
    case "SENDS":
      return st.sends;
  }
}

// ── Duel shop ───────────────────────────────────────────────────────────
export type DuelCosmeticKind = "BANNER" | "FRAME" | "TOWER_SKIN" | "KILL_FX";
/** Kill effects: what a creature leaves when it falls, in the Duel and the Eternal castle. */
export type KillFxId = "EMBERS" | "FROST" | "SOULS" | "GOLD" | "LIGHTNING" | "BLOOD";
export interface DuelShopItem {
  id: string;
  price: number;
  /** Materials it gives (repeatable buys). */
  prize?: DuelPrize;
  /** At most once a week. */
  weekly?: boolean;
  /** Earned only (never sold) — e.g. the Weekend Tournament banner. */
  earnedOnly?: boolean;
  cosmetic?: { kind: DuelCosmeticKind; color: string; color2: string; skinId?: string; tower?: TowerType; fx?: KillFxId };
}

export const DUEL_SHOP: readonly DuelShopItem[] = [
  { id: "BANNER_CRIMSON", price: 300, cosmetic: { kind: "BANNER", color: "#b0302a", color2: "#f0c060" } },
  { id: "BANNER_AZURE", price: 300, cosmetic: { kind: "BANNER", color: "#2a5ab0", color2: "#e8e8f0" } },
  { id: "BANNER_EMERALD", price: 450, cosmetic: { kind: "BANNER", color: "#1f7a4a", color2: "#f0d080" } },
  { id: "BANNER_CHAMPION", price: 0, earnedOnly: true, cosmetic: { kind: "BANNER", color: "#ffd56a", color2: "#7a1414" } },
  // exclusive — only earned in the Duel (leagues, tournament, weekly wins), never sold
  { id: "FRAME_SILVER", price: 0, earnedOnly: true, cosmetic: { kind: "FRAME", color: "#e8eef4", color2: "#5a6470" } },
  { id: "BANNER_GOLD", price: 0, earnedOnly: true, cosmetic: { kind: "BANNER", color: "#ffd56a", color2: "#8a5a10" } },
  { id: "KILL_LIGHTNING", price: 0, earnedOnly: true, cosmetic: { kind: "KILL_FX", color: "#c8b0ff", color2: "#2a1a6a", fx: "LIGHTNING" } },
  { id: "FRAME_DIAMOND", price: 0, earnedOnly: true, cosmetic: { kind: "FRAME", color: "#9ac8ff", color2: "#2a3aa8" } },
  { id: "BANNER_MASTER", price: 0, earnedOnly: true, cosmetic: { kind: "BANNER", color: "#e0a0ff", color2: "#3a0a6a" } },
  { id: "KILL_BLOOD", price: 0, earnedOnly: true, cosmetic: { kind: "KILL_FX", color: "#ff3a4a", color2: "#3a0608", fx: "BLOOD" } },
  { id: "FRAME_LEGEND", price: 0, earnedOnly: true, cosmetic: { kind: "FRAME", color: "#ff3a5a", color2: "#ffc040" } },
  { id: "SKIN_IRONWOOD_LEGEND", price: 0, earnedOnly: true, cosmetic: { kind: "TOWER_SKIN", color: "#ff3a5a", color2: "#16121a", skinId: "IRONWOOD_LEGEND", tower: "IRONWOOD" } },
  { id: "SKIN_INFERNO_LEGEND", price: 0, earnedOnly: true, cosmetic: { kind: "TOWER_SKIN", color: "#ff3a5a", color2: "#16121a", skinId: "INFERNO_LEGEND", tower: "INFERNO" } },
  { id: "SKIN_FROSTBORN_LEGEND", price: 0, earnedOnly: true, cosmetic: { kind: "TOWER_SKIN", color: "#ff3a5a", color2: "#16121a", skinId: "FROSTBORN_LEGEND", tower: "FROSTBORN" } },
  { id: "SKIN_STORMCALLER_LEGEND", price: 0, earnedOnly: true, cosmetic: { kind: "TOWER_SKIN", color: "#ff3a5a", color2: "#16121a", skinId: "STORMCALLER_LEGEND", tower: "STORMCALLER" } },
  { id: "BANNER_VOID", price: 700, cosmetic: { kind: "BANNER", color: "#3a1a5a", color2: "#d090ff" } },
  { id: "FRAME_GOLD", price: 500, cosmetic: { kind: "FRAME", color: "#e8b04b", color2: "#7a5a1a" } },
  { id: "FRAME_FROST", price: 650, cosmetic: { kind: "FRAME", color: "#9ad8ff", color2: "#2a5a7a" } },
  { id: "FRAME_INFERNAL", price: 900, cosmetic: { kind: "FRAME", color: "#ff6a3a", color2: "#5a1a0a" } },
  // tower skins — shown in the Duel and the Eternal castle only (never in the Season)
  { id: "SKIN_IRONWOOD_GLADIATOR", price: 900, cosmetic: { kind: "TOWER_SKIN", color: "#d89a3a", color2: "#7a1414", skinId: "IRONWOOD_GLADIATOR", tower: "IRONWOOD" } },
  { id: "SKIN_INFERNO_GLADIATOR", price: 900, cosmetic: { kind: "TOWER_SKIN", color: "#d89a3a", color2: "#7a1414", skinId: "INFERNO_GLADIATOR", tower: "INFERNO" } },
  { id: "SKIN_FROSTBORN_GLADIATOR", price: 900, cosmetic: { kind: "TOWER_SKIN", color: "#d89a3a", color2: "#7a1414", skinId: "FROSTBORN_GLADIATOR", tower: "FROSTBORN" } },
  { id: "SKIN_STORMCALLER_GLADIATOR", price: 900, cosmetic: { kind: "TOWER_SKIN", color: "#d89a3a", color2: "#7a1414", skinId: "STORMCALLER_GLADIATOR", tower: "STORMCALLER" } },
  { id: "SKIN_IRONWOOD_CHAMPION", price: 1800, cosmetic: { kind: "TOWER_SKIN", color: "#ffd060", color2: "#1a1a22", skinId: "IRONWOOD_CHAMPION", tower: "IRONWOOD" } },
  { id: "SKIN_INFERNO_CHAMPION", price: 1800, cosmetic: { kind: "TOWER_SKIN", color: "#ffd060", color2: "#1a1a22", skinId: "INFERNO_CHAMPION", tower: "INFERNO" } },
  { id: "SKIN_FROSTBORN_CHAMPION", price: 1800, cosmetic: { kind: "TOWER_SKIN", color: "#ffd060", color2: "#1a1a22", skinId: "FROSTBORN_CHAMPION", tower: "FROSTBORN" } },
  { id: "SKIN_STORMCALLER_CHAMPION", price: 1800, cosmetic: { kind: "TOWER_SKIN", color: "#ffd060", color2: "#1a1a22", skinId: "STORMCALLER_CHAMPION", tower: "STORMCALLER" } },
  // kill effects
  { id: "KILL_EMBERS", price: 700, cosmetic: { kind: "KILL_FX", color: "#ff7a2a", color2: "#5a1a0a", fx: "EMBERS" } },
  { id: "KILL_FROST", price: 700, cosmetic: { kind: "KILL_FX", color: "#9ae0ff", color2: "#1a4a6a", fx: "FROST" } },
  { id: "KILL_SOULS", price: 1000, cosmetic: { kind: "KILL_FX", color: "#c890ff", color2: "#2a0a4a", fx: "SOULS" } },
  { id: "KILL_GOLD", price: 1200, cosmetic: { kind: "KILL_FX", color: "#ffd84a", color2: "#6a4a0a", fx: "GOLD" } },
];

export function getShopItem(id: string): DuelShopItem | null {
  return DUEL_SHOP.find((x) => x.id === id) ?? null;
}

// ── profile ─────────────────────────────────────────────────────────────
export interface DuelProfile {
  trophies: number;
  bestTrophies: number;
  wins: number;
  losses: number;
  deck: DuelCardId[];
  coins: number;
  streak: number;
  bestStreak: number;
  /** Last UTC day the first-win prize was paid. */
  firstWinDay: number;
  /** Highest rank step whose prize was paid. */
  rankPaidUpTo: number;
  missions: { day: number; progress: Record<string, number>; claimed: string[]; bonusPaid?: boolean };
  /** Ranked wins this week and which weekly-win prizes were paid. */
  weekWins: { week: number; wins: number; paid: number[] };
  /** Weekend Tournament: the weekend it belongs to, rounds won, and whether the run is over. */
  tourney: { weekend: number; round: number; out: boolean; won: boolean };
  /** Week the weekly shop item was last bought. */
  shopWeek: number;
  owned: string[];
  banner: string | null;
  frame: string | null;
  /** Duel tower skins worn per tower (shop item ids) — shown in the Duel and the Eternal castle. */
  towerSkins: Partial<Record<TowerType, string>>;
  /** Kill effect worn (shop item id). */
  killFx: string | null;
  /** Week whose Weekly Challenge was beaten (-1 none). */
  weeklyWonWeek: number;
  /** DECKS SALVOS — three deck slots (a slot may be unfinished); `deck` is the active slot once valid. */
  decks: DuelCardId[][];
  activeDeck: number;
  /** MESTRIA — wins per card (the card was in the deck) and how many mastery levels were paid. */
  mastery: Partial<Record<DuelCardId, { wins: number; claimed: number }>>;
  /** HISTÓRICO — the last matches, newest first, with what's needed to replay them. */
  history: DuelHistoryEntry[];
  /** UTC day the daily event's win prize was paid (-1 never). */
  eventWinDay: number;
}

// ── daily event modes ──────────────────────────────────────────────────
/**
 * EVENTO DO DIA — a different way to play every day (like Clash's party
 * modes). No trophies; the first win of the day pays a few Duel Coins.
 *   DOUBLE_MANA: mana fills twice as fast all match.
 *   DRAFT: build your deck by picking 1 of 3 cards, 8 times.
 *   MIRROR: the opponent plays your exact deck.
 *   RANDOM: both sides get a random deck.
 */
export type DuelEventId = "DOUBLE_MANA" | "DRAFT" | "MIRROR" | "RANDOM";
export const DUEL_EVENTS: readonly DuelEventId[] = ["DOUBLE_MANA", "DRAFT", "MIRROR", "RANDOM"];
export const EVENT_WIN_COINS = 40;

export function duelEventFor(day: number): DuelEventId {
  return DUEL_EVENTS[((day % DUEL_EVENTS.length) + DUEL_EVENTS.length) % DUEL_EVENTS.length]!;
}

function lcg(seed: number): () => number {
  let s = (seed * 2654435761 + 17) >>> 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** A random but valid deck (2–4 towers, 2–4 creatures, the rest anything). */
export function randomDeck(seed: number): DuelCardId[] {
  const r = lcg(seed);
  const take = (from: DuelCardId[], n: number, into: DuelCardId[]) => {
    const pool = from.filter((id) => !into.includes(id));
    for (let i = 0; i < n && pool.length; i++) into.push(pool.splice(Math.floor(r() * pool.length), 1)[0]!);
  };
  const ids = DUEL_CARDS.map((c) => c.id);
  const towers = DUEL_CARDS.filter((c) => c.kind === "TOWER").map((c) => c.id);
  const sends = DUEL_CARDS.filter((c) => c.kind === "SEND").map((c) => c.id);
  const out: DuelCardId[] = [];
  take(towers, 2, out);
  take(sends, 2, out);
  while (out.length < DECK_SIZE) {
    const kindCount = (k: DuelCard["kind"]) => out.filter((id) => getDuelCard(id)!.kind === k).length;
    take(
      ids.filter((id) => {
        const k = getDuelCard(id)!.kind;
        return k === "SPELL" || kindCount(k) < 4;
      }),
      1,
      out,
    );
  }
  return out;
}

/** DRAFT: the 3 cards offered in a round, given what's already picked. Late rounds only offer what the deck still needs to be valid. */
export function draftOptions(seed: number, picked: readonly DuelCardId[]): DuelCardId[] {
  const r = lcg(seed * 31 + picked.length * 977 + 5);
  const left = DECK_SIZE - picked.length;
  const has = (k: DuelCard["kind"]) => picked.filter((id) => getDuelCard(id)!.kind === k).length;
  const needT = Math.max(0, 2 - has("TOWER"));
  const needS = Math.max(0, 2 - has("SEND"));
  let pool = DUEL_CARDS.filter((c) => !picked.includes(c.id));
  if (needT + needS >= left) pool = pool.filter((c) => (needT > 0 && c.kind === "TOWER") || (needS > 0 && c.kind === "SEND"));
  const ids = pool.map((c) => c.id);
  const out: DuelCardId[] = [];
  while (out.length < 3 && ids.length) out.push(ids.splice(Math.floor(r() * ids.length), 1)[0]!);
  return out;
}

/** Pays the first event win of the day. */
export function applyEventResult(p: DuelProfile, outcome: DuelOutcome, nowMs: number): { profile: DuelProfile; coins: number } {
  const day = Math.floor(nowMs / 86_400_000);
  if (outcome !== "WIN" || p.eventWinDay === day) return { profile: p, coins: 0 };
  return { profile: { ...p, coins: p.coins + EVENT_WIN_COINS, eventWinDay: day }, coins: EVENT_WIN_COINS };
}

// ── saved decks ─────────────────────────────────────────────────────────
export const DECK_SLOTS = 3;

/** A deck slot as saved: up to 8 different known cards (may be unfinished). */
export function sanitizeDeckSlot(raw: unknown): DuelCardId[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is DuelCardId => typeof x === "string" && !!getDuelCard(x)))].slice(0, DECK_SIZE);
}

// ── card mastery ────────────────────────────────────────────────────────
/**
 * MESTRIA DE CARTAS — win with a card in your deck to raise its mastery.
 * Each level pays Duel Coins once and shows a badge on the card. It never
 * makes the card stronger: every player's cards are the same.
 */
export const MASTERY_LEVELS: readonly { wins: number; coins: number }[] = [
  { wins: 3, coins: 20 },
  { wins: 10, coins: 40 },
  { wins: 25, coins: 80 },
  { wins: 50, coins: 150 },
  { wins: 100, coins: 250 },
];

export function cardMasteryLevel(wins: number): number {
  return MASTERY_LEVELS.filter((l) => wins >= l.wins).length;
}

/** Counts a win for every card in the deck. */
export function addMasteryWin(p: DuelProfile, deck: readonly DuelCardId[]): DuelProfile {
  const mastery = { ...p.mastery };
  for (const id of new Set(deck)) {
    const m = mastery[id] ?? { wins: 0, claimed: 0 };
    mastery[id] = { ...m, wins: m.wins + 1 };
  }
  return { ...p, mastery };
}

/** Mastery levels reached but not paid yet, for one card. */
export function masteryClaimable(p: DuelProfile, id: DuelCardId): number {
  const m = p.mastery[id];
  return m ? Math.max(0, cardMasteryLevel(m.wins) - m.claimed) : 0;
}

/** Pays every reached-but-unpaid mastery level of a card. */
export function claimMastery(p: DuelProfile, id: DuelCardId): { profile: DuelProfile; coins: number } | null {
  const m = p.mastery[id];
  if (!m || masteryClaimable(p, id) === 0) return null;
  const level = cardMasteryLevel(m.wins);
  let coins = 0;
  for (let i = m.claimed; i < level; i++) coins += MASTERY_LEVELS[i]!.coins;
  return { profile: { ...p, coins: p.coins + coins, mastery: { ...p.mastery, [id]: { wins: m.wins, claimed: level } } }, coins };
}

// ── match history and replays ──────────────────────────────────────────
/** Bumped whenever match rules change, so old replays (which would play out differently) are shown without a replay. */
export const DUEL_RULES_VERSION = 2;
export const HISTORY_MAX = 10;

export type DuelMode = "RANKED" | "TOURNEY" | "WEEKLY" | "EVENT";

export interface DuelHistoryEntry {
  at: number;
  mode: DuelMode;
  outcome: DuelOutcome;
  myCastle: number;
  foeCastle: number;
  trophyChange: number;
  arenaId: string;
  biome: string;
  /** Replay data: rules version, seed, both decks, the AI's skill and your plays. */
  v: number;
  seed: number;
  decks: [DuelCardId[], DuelCardId[]];
  ai: number;
  plays: { t: number; card: DuelCardId; slot?: number; at?: { x: number; y: number } }[];
  /** EVENT matches: which event and its rule changes. */
  event?: DuelEventId;
  doubleMana?: boolean;
}

export function pushHistory(list: readonly DuelHistoryEntry[], e: DuelHistoryEntry): DuelHistoryEntry[] {
  return [e, ...list].slice(0, HISTORY_MAX);
}

export function canReplay(e: DuelHistoryEntry): boolean {
  return e.v === DUEL_RULES_VERSION;
}

function sanitizeHistory(raw: unknown): DuelHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DuelHistoryEntry[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const e = x as Record<string, unknown>;
    const outcome = e.outcome === "WIN" || e.outcome === "LOSS" || e.outcome === "DRAW" ? e.outcome : null;
    const mode = e.mode === "RANKED" || e.mode === "TOURNEY" || e.mode === "WEEKLY" || e.mode === "EVENT" ? e.mode : null;
    const decks = Array.isArray(e.decks) && e.decks.length === 2 ? (e.decks as unknown[]).map(sanitizeDeckSlot) : null;
    if (!outcome || !mode || !decks || decks.some((d) => d.length !== DECK_SIZE)) continue;
    const plays = Array.isArray(e.plays)
      ? (e.plays as unknown[]).flatMap((q) => {
          if (!q || typeof q !== "object") return [];
          const r = q as Record<string, unknown>;
          if (typeof r.t !== "number" || typeof r.card !== "string" || !getDuelCard(r.card)) return [];
          const at = r.at && typeof r.at === "object" ? (r.at as { x: unknown; y: unknown }) : null;
          return [
            {
              t: r.t,
              card: r.card as DuelCardId,
              ...(typeof r.slot === "number" ? { slot: r.slot } : {}),
              ...(at && typeof at.x === "number" && typeof at.y === "number" ? { at: { x: at.x, y: at.y } } : {}),
            },
          ];
        })
      : [];
    out.push({
      at: typeof e.at === "number" ? e.at : 0,
      mode,
      outcome,
      myCastle: intOr(e.myCastle, 0),
      foeCastle: intOr(e.foeCastle, 0),
      trophyChange: intOr(e.trophyChange, 0),
      arenaId: typeof e.arenaId === "string" ? e.arenaId : "ARENA_FOREST",
      biome: typeof e.biome === "string" ? e.biome : "ANCIENT_FOREST",
      v: intOr(e.v, 0),
      seed: intOr(e.seed, 1),
      decks: [decks[0]!, decks[1]!],
      ai: typeof e.ai === "number" ? Math.max(0, Math.min(1, e.ai)) : 0,
      plays,
      ...(typeof e.event === "string" && (DUEL_EVENTS as readonly string[]).includes(e.event) ? { event: e.event as DuelEventId } : {}),
      ...(e.doubleMana === true ? { doubleMana: true } : {}),
    });
    if (out.length >= HISTORY_MAX) break;
  }
  return out;
}

export function createDuelProfile(): DuelProfile {
  return {
    trophies: 0,
    bestTrophies: 0,
    wins: 0,
    losses: 0,
    deck: [...DEFAULT_DECK],
    coins: 0,
    streak: 0,
    bestStreak: 0,
    firstWinDay: -1,
    rankPaidUpTo: 0,
    missions: { day: -1, progress: {}, claimed: [] },
    shopWeek: -1,
    owned: [],
    banner: null,
    frame: null,
    towerSkins: {},
    killFx: null,
    weekWins: { week: -1, wins: 0, paid: [] },
    tourney: { weekend: -1, round: 0, out: false, won: false },
    weeklyWonWeek: -1,
    decks: [[...DEFAULT_DECK], [], []],
    activeDeck: 0,
    mastery: {},
    history: [],
    eventWinDay: -1,
  };
}

const int = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : d);
const intOr = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : d);

export function sanitizeDuelProfile(raw: unknown): DuelProfile {
  if (!raw || typeof raw !== "object") return createDuelProfile();
  const r = raw as Record<string, unknown>;
  const trophies = int(r.trophies);
  const m = (r.missions && typeof r.missions === "object" ? r.missions : {}) as Record<string, unknown>;
  const progress: Record<string, number> = {};
  if (m.progress && typeof m.progress === "object") for (const [k, v] of Object.entries(m.progress as Record<string, unknown>)) if (typeof v === "number" && v > 0) progress[k] = Math.floor(v);
  const owned = Array.isArray(r.owned) ? (r.owned as unknown[]).filter((x): x is string => typeof x === "string" && !!getShopItem(x)?.cosmetic) : [];
  const pickOwned = (v: unknown) => (typeof v === "string" && owned.includes(v) ? v : null);
  return {
    trophies,
    bestTrophies: Math.max(trophies, int(r.bestTrophies)),
    wins: int(r.wins),
    losses: int(r.losses),
    deck: sanitizeDeck(r.deck),
    coins: int(r.coins),
    streak: int(r.streak),
    bestStreak: int(r.bestStreak),
    firstWinDay: intOr(r.firstWinDay, -1),
    rankPaidUpTo: Math.max(int(r.rankPaidUpTo), 0),
    missions: { day: intOr(m.day, -1), progress, claimed: Array.isArray(m.claimed) ? (m.claimed as unknown[]).filter((x): x is string => typeof x === "string") : [] },
    shopWeek: intOr(r.shopWeek, -1),
    owned,
    banner: pickOwned(r.banner),
    frame: pickOwned(r.frame),
    towerSkins: Object.fromEntries(
      Object.entries((r.towerSkins && typeof r.towerSkins === "object" ? r.towerSkins : {}) as Record<string, unknown>).filter(
        ([k, v]) => typeof v === "string" && owned.includes(v) && getShopItem(v)?.cosmetic?.tower === k,
      ),
    ) as Partial<Record<TowerType, string>>,
    killFx: pickOwned(r.killFx),
    weekWins: (() => {
      const w = (r.weekWins && typeof r.weekWins === "object" ? r.weekWins : {}) as Record<string, unknown>;
      return { week: intOr(w.week, -1), wins: int(w.wins), paid: Array.isArray(w.paid) ? (w.paid as unknown[]).filter((x): x is number => typeof x === "number") : [] };
    })(),
    tourney: (() => {
      const w = (r.tourney && typeof r.tourney === "object" ? r.tourney : {}) as Record<string, unknown>;
      return { weekend: intOr(w.weekend, -1), round: Math.min(TOURNEY_ROUNDS.length, int(w.round)), out: w.out === true, won: w.won === true };
    })(),
    weeklyWonWeek: intOr(r.weeklyWonWeek, -1),
    decks: (() => {
      const raw = Array.isArray(r.decks) ? (r.decks as unknown[]) : [];
      const slots = Array.from({ length: DECK_SLOTS }, (_, i) => sanitizeDeckSlot(raw[i]));
      // older saves had one deck: it becomes slot 1
      if (!Array.isArray(r.decks)) slots[0] = sanitizeDeck(r.deck);
      return slots;
    })(),
    activeDeck: Math.min(DECK_SLOTS - 1, int(r.activeDeck)),
    mastery: (() => {
      const out: Partial<Record<DuelCardId, { wins: number; claimed: number }>> = {};
      if (r.mastery && typeof r.mastery === "object")
        for (const [k, v] of Object.entries(r.mastery as Record<string, unknown>)) {
          if (!getDuelCard(k) || !v || typeof v !== "object") continue;
          const m = v as Record<string, unknown>;
          const wins = int(m.wins);
          out[k as DuelCardId] = { wins, claimed: Math.min(cardMasteryLevel(wins), int(m.claimed)) };
        }
      return out;
    })(),
    history: sanitizeHistory(r.history),
    eventWinDay: intOr(r.eventWinDay, -1),
  };
}

export type DuelOutcome = "WIN" | "LOSS" | "DRAW";

export interface DuelResult {
  profile: DuelProfile;
  /** Everything this match paid, all together. */
  prize: DuelPrize;
  trophyChange: number;
  /** Rank before and after (for the promotion / demotion banner). */
  rankBefore: DuelRank;
  rankAfter: DuelRank;
  firstWin: boolean;
  streakBonus: number | null;
  /** Rank steps reached for the first time this match. */
  newRanks: number[];
  /** Exclusive looks won this match. */
  unlocked: string[];
}

/** Applies a ranked match: trophies (with the league floor), coins, first win of the day, streak and first-time rank prizes, and mission progress. */
export function applyDuelResult(p: DuelProfile, st: DuelMatchStats, nowMs: number): DuelResult {
  const day = Math.floor(nowMs / 86_400_000);
  const rankBefore = rankFor(p.trophies);
  const floor = leagueFloor(p.trophies);
  const trophies = Math.max(floor, p.trophies + trophyDelta(p.trophies, st.outcome));
  const win = st.outcome === "WIN";
  let prize = P({ coins: MATCH_COINS[st.outcome] });
  const firstWin = win && p.firstWinDay !== day;
  if (firstWin) prize = addPrize(prize, FIRST_WIN_PRIZE);
  const streak = win ? p.streak + 1 : st.outcome === "LOSS" ? 0 : p.streak;
  const streakHit = win ? STREAK_PRIZES.find((s) => s.at === streak) : undefined;
  if (streakHit) prize = addPrize(prize, streakHit.prize);
  let pendingWeeklyUnlock = false;
  const week = duelWeek(nowMs);
  const ww = p.weekWins.week === week ? p.weekWins : { week, wins: 0, paid: [] as number[] };
  const weekWinsNow = ww.wins + (win ? 1 : 0);
  const newPaid = [...ww.paid];
  for (const g of WEEKLY_WIN_GOALS)
    if (weekWinsNow >= g.wins && !newPaid.includes(g.wins)) {
      newPaid.push(g.wins);
      prize = addPrize(prize, g.prize);
      if (g.wins === WEEKLY_WIN_GOALS[WEEKLY_WIN_GOALS.length - 1]!.wins && !p.owned.includes(WEEKLY_TOP_UNLOCK)) pendingWeeklyUnlock = true;
    }
  const bestTrophies = Math.max(p.bestTrophies, trophies);
  const reached = rankFor(bestTrophies).index;
  const newRanks: number[] = [];
  const unlocked: string[] = pendingWeeklyUnlock ? [WEEKLY_TOP_UNLOCK] : [];
  for (let i = p.rankPaidUpTo + 1; i <= reached; i++) {
    newRanks.push(i);
    prize = addPrize(prize, rankPrize(i));
    const step = RANK_STEPS[i]!;
    if (step.division === 1) for (const id of LEAGUE_UNLOCKS[step.league] ?? []) if (!p.owned.includes(id)) unlocked.push(id);
  }
  // missions (progress only; claimed from the lobby)
  const missions = p.missions.day === day ? p.missions : { day, progress: {}, claimed: [] };
  const progress = { ...missions.progress };
  for (const m of duelMissionsFor(day)) progress[m.id] = Math.min(m.target, (progress[m.id] ?? 0) + missionStep(m, st));
  const base = win ? addMasteryWin(p, st.deck) : p;
  return {
    profile: {
      ...base,
      trophies,
      bestTrophies,
      wins: p.wins + (win ? 1 : 0),
      losses: p.losses + (st.outcome === "LOSS" ? 1 : 0),
      coins: p.coins + prize.coins,
      streak,
      bestStreak: Math.max(p.bestStreak, streak),
      firstWinDay: firstWin ? day : p.firstWinDay,
      rankPaidUpTo: Math.max(p.rankPaidUpTo, reached),
      missions: { ...missions, progress },
      weekWins: { week, wins: weekWinsNow, paid: newPaid },
      owned: [...p.owned, ...unlocked],
    },
    unlocked,
    prize,
    trophyChange: trophies - p.trophies,
    rankBefore,
    rankAfter: rankFor(trophies),
    firstWin,
    streakBonus: streakHit ? streakHit.at : null,
    newRanks,
  };
}

/** Claims a finished mission's coins. */
export function claimDuelMission(p: DuelProfile, id: string, nowMs: number): { profile: DuelProfile; gems: number; bonus: boolean } | null {
  const day = Math.floor(nowMs / 86_400_000);
  const all = duelMissionsFor(day);
  const m = all.find((x) => x.id === id);
  if (!m || p.missions.day !== day || p.missions.claimed.includes(id) || (p.missions.progress[id] ?? 0) < m.target) return null;
  const claimed = [...p.missions.claimed, id];
  const bonus = !p.missions.bonusPaid && all.every((x) => claimed.includes(x.id));
  return {
    profile: { ...p, coins: p.coins + m.coins + (bonus ? MISSIONS_ALL_DONE_PRIZE.coins : 0), missions: { ...p.missions, claimed, bonusPaid: p.missions.bonusPaid || bonus } },
    gems: bonus ? MISSIONS_ALL_DONE_PRIZE.gems : 0,
    bonus,
  };
}

// ── weekend tournament ─────────────────────────────────────────────────
/**
 * TORNEIO DE FIM DE SEMANA — Saturday and Sunday (UTC), one run per
 * weekend: three matches in a row against an ever stronger AI, with your
 * own deck. Lose one and the run is over until next weekend. Win all three
 * for the biggest Duel prize and the Champion banner, which can't be bought.
 * Trophies don't move.
 */
export const TOURNEY_ROUNDS: readonly { ai: number; prize: DuelPrize }[] = [
  { ai: 0.75, prize: P({ coins: 60 }) },
  { ai: 0.88, prize: P({ coins: 120 }) },
  { ai: 0.97, prize: P({ coins: 250, gems: 3 }) },
];
export const TOURNEY_BANNER = "BANNER_CHAMPION";

/** The weekend number when it's Saturday or Sunday (UTC), else null. */
export function tourneyWeekend(nowMs: number): number | null {
  const dow = new Date(nowMs).getUTCDay();
  return dow === 6 || dow === 0 ? duelWeek(nowMs + (dow === 0 ? 0 : 86_400_000)) : null;
}

export function tourneyState(p: DuelProfile, nowMs: number): DuelProfile["tourney"] | null {
  const wk = tourneyWeekend(nowMs);
  if (wk === null) return null;
  return p.tourney.weekend === wk ? p.tourney : { weekend: wk, round: 0, out: false, won: false };
}

/** Records a tournament match. */
export function applyTourneyResult(p: DuelProfile, outcome: DuelOutcome, nowMs: number): { profile: DuelProfile; prize: DuelPrize; finished: boolean } | null {
  const t = tourneyState(p, nowMs);
  if (!t || t.out || t.won) return null;
  if (outcome !== "WIN") return { profile: { ...p, tourney: { ...t, out: true } }, prize: NO_PRIZE, finished: true };
  const prize = TOURNEY_ROUNDS[t.round]!.prize;
  const round = t.round + 1;
  const won = round >= TOURNEY_ROUNDS.length;
  const owned = won && !p.owned.includes(TOURNEY_BANNER) ? [...p.owned, TOURNEY_BANNER] : p.owned;
  return { profile: { ...p, coins: p.coins + prize.coins, owned, tourney: { ...t, round, won } }, prize, finished: won };
}

/** Buys from the Duel shop. Materials come back as a prize for the account; cosmetics are owned (and worn) at once. */
export function buyDuelShopItem(p: DuelProfile, id: string, nowMs: number): { profile: DuelProfile; prize: DuelPrize } | null {
  const item = getShopItem(id);
  if (!item || item.earnedOnly || p.coins < item.price) return null;
  const week = duelWeek(nowMs);
  if (item.weekly && p.shopWeek === week) return null;
  if (item.cosmetic && p.owned.includes(id)) return null;
  const profile: DuelProfile = {
    ...p,
    coins: p.coins - item.price,
    shopWeek: item.weekly ? week : p.shopWeek,
    owned: item.cosmetic ? [...p.owned, id] : p.owned,
    banner: item.cosmetic?.kind === "BANNER" ? id : p.banner,
    frame: item.cosmetic?.kind === "FRAME" ? id : p.frame,
    towerSkins: item.cosmetic?.kind === "TOWER_SKIN" && item.cosmetic.tower ? { ...p.towerSkins, [item.cosmetic.tower]: id } : p.towerSkins,
    killFx: item.cosmetic?.kind === "KILL_FX" ? id : p.killFx,
  };
  return { profile, prize: item.prize ?? NO_PRIZE };
}

// ── weekly challenge ────────────────────────────────────────────────────
/**
 * DESAFIO SEMANAL — one fixed match a week, the same for everyone: the same
 * seed, your deck and the opponent's deck are set, and the opponent plays at
 * full skill. Beat it once in the week for its reward. Trophies don't move.
 */
/** Duel Coins for beating the Weekly Challenge (once a week). */
export const WEEKLY_CHALLENGE_COINS = 150;
/** Free Gems for beating the Weekly Challenge — they work in the whole game. */
export const WEEKLY_CHALLENGE_GEMS = 2;
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

/** Wears or takes off an owned Duel cosmetic. */
export function toggleDuelCosmetic(p: DuelProfile, id: string): DuelProfile | null {
  const c = getShopItem(id)?.cosmetic;
  if (!c || !p.owned.includes(id)) return null;
  switch (c.kind) {
    case "BANNER":
      return { ...p, banner: p.banner === id ? null : id };
    case "FRAME":
      return { ...p, frame: p.frame === id ? null : id };
    case "KILL_FX":
      return { ...p, killFx: p.killFx === id ? null : id };
    case "TOWER_SKIN": {
      const next = { ...p.towerSkins };
      if (next[c.tower!] === id) delete next[c.tower!];
      else next[c.tower!] = id;
      return { ...p, towerSkins: next };
    }
  }
}

/** The tower skin ids (not shop ids) worn in the Duel / Eternal castle, per tower. */
export function duelSkinLooks(p: DuelProfile): Partial<Record<TowerType, string>> {
  const out: Partial<Record<TowerType, string>> = {};
  for (const [t, id] of Object.entries(p.towerSkins)) {
    const skinId = getShopItem(id ?? "")?.cosmetic?.skinId;
    if (skinId) out[t as TowerType] = skinId;
  }
  return out;
}

export function duelKillFx(p: DuelProfile): KillFxId | null {
  return p.killFx ? getShopItem(p.killFx)?.cosmetic?.fx ?? null : null;
}

// ── exclusive Duel cosmetics ───────────────────────────────────────────
/** Exclusive looks each league gives the first time you reach it. */
export const LEAGUE_UNLOCKS: Partial<Record<LeagueId, readonly string[]>> = {
  SILVER: ["FRAME_SILVER"],
  GOLD: ["BANNER_GOLD"],
  PLATINUM: ["KILL_LIGHTNING"],
  DIAMOND: ["FRAME_DIAMOND"],
  MASTER: ["BANNER_MASTER"],
  LEGEND: ["FRAME_LEGEND", "SKIN_IRONWOOD_LEGEND", "SKIN_INFERNO_LEGEND", "SKIN_FROSTBORN_LEGEND", "SKIN_STORMCALLER_LEGEND"],
};
/** The first week you reach the top weekly-wins goal, this kill effect is yours. */
export const WEEKLY_TOP_UNLOCK = "KILL_BLOOD";

/** Where an exclusive look comes from (for the shop label). */
export function earnedHow(id: string): { league?: LeagueId; tourney?: boolean; weekly?: boolean } {
  for (const [l, ids] of Object.entries(LEAGUE_UNLOCKS)) if (ids?.includes(id)) return { league: l as LeagueId };
  if (id === "BANNER_CHAMPION") return { tourney: true };
  if (id === WEEKLY_TOP_UNLOCK) return { weekly: true };
  return {};
}
