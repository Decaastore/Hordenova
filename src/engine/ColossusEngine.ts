/**
 * CHEFE GLOBAL — one attempt against the Serpent of the Eclipse.
 *
 * The arena is a floating stone disk with a spiral road; the Serpent comes
 * out of a rift at the outer end and crawls to the Eclipse core at the centre
 * in COLOSSUS_LENGTH_MS. Twelve players each hold ONE tower on one of
 * SLOT_COUNT slots between the spiral's arms and pour damage into whatever
 * part of its body is in range (the head is the weak point).
 *
 * Phases (config/colossus.ts): AWAKEN → STARFALL (falling stars stun the
 * tower on a marked slot — move away in time) → ECLIPSE (damage up, but the
 * Serpent raises scale shields every few seconds — time your Star Strike).
 *
 * Deterministic: fixed 50 ms steps and a seeded RNG, so a seed replays the
 * same attempt. Player 0 is the local player; 1..11 are simulated allies.
 */
import { COLOSSUS_LENGTH_MS, COLOSSUS_ROOM_SIZE, colossusPhaseAt, type ColossusPhaseId } from "@/config/colossus";
import type { TowerType } from "@/config/towerStats";

export const COLOSSUS_W = 1000;
export const COLOSSUS_H = 640;
export const ARENA_CENTER = { x: 500, y: 328 };
const R0 = 292;
const R1 = 62;
const TURNS = 2.25;
const SX = 1.5;
const SY = 0.93;
const THETA0 = Math.PI; // starts on the left
const T_MAX = TURNS * Math.PI * 2;
export const ROAD_WIDTH = 44;

export interface Pt {
  x: number;
  y: number;
}

function spiral(theta: number, dr = 0): Pt {
  const r = R0 - ((R0 - R1) * theta) / T_MAX + dr;
  const a = THETA0 + theta;
  return { x: ARENA_CENTER.x + Math.cos(a) * r * SX, y: ARENA_CENTER.y + Math.sin(a) * r * SY };
}

/** The road, densely sampled, with cumulative length. */
export const SPIRAL_PATH: readonly Pt[] = (() => {
  const pts: Pt[] = [];
  const n = 900;
  for (let i = 0; i <= n; i++) pts.push(spiral((i / n) * T_MAX));
  return pts;
})();

const CUM: number[] = (() => {
  const c = [0];
  for (let i = 1; i < SPIRAL_PATH.length; i++) c.push(c[i - 1]! + Math.hypot(SPIRAL_PATH[i]!.x - SPIRAL_PATH[i - 1]!.x, SPIRAL_PATH[i]!.y - SPIRAL_PATH[i - 1]!.y));
  return c;
})();
export const PATH_LENGTH = CUM[CUM.length - 1]!;

/** Point and heading at distance `s` along the road (clamped to its ends; before 0 it extends back out of the rift). */
export function pathAt(s: number): { x: number; y: number; angle: number } {
  if (s <= 0) {
    const a = SPIRAL_PATH[0]!;
    const b = SPIRAL_PATH[1]!;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    return { x: a.x + Math.cos(ang) * s, y: a.y + Math.sin(ang) * s, angle: ang };
  }
  if (s >= PATH_LENGTH) {
    const a = SPIRAL_PATH[SPIRAL_PATH.length - 2]!;
    const b = SPIRAL_PATH[SPIRAL_PATH.length - 1]!;
    return { x: b.x, y: b.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  let lo = 0;
  let hi = CUM.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (CUM[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const a = SPIRAL_PATH[lo]!;
  const b = SPIRAL_PATH[hi]!;
  const k = (s - CUM[lo]!) / Math.max(1e-6, CUM[hi]! - CUM[lo]!);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** Tower slots, along the gap between the spiral's arms (16 slots for 12 players, so there is room to dodge). */
export const COLOSSUS_SLOTS: readonly Pt[] = (() => {
  const gap = (R0 - R1) / TURNS / 2;
  const out: Pt[] = [];
  for (let i = 0; i < 16; i++) out.push(spiral(0.1 * Math.PI + (i / 15) * 2.34 * Math.PI, -gap));
  return out;
})();
export const SLOT_COUNT = COLOSSUS_SLOTS.length;

/** The Serpent: a head and BODY_SEGMENTS plates trailing behind it. */
export const BODY_SEGMENTS = 30;
export const SEGMENT_GAP = 19;
/** The same range for every tower type, whatever its level or kind. */
export const TOWER_RANGE = 185;
const IRONWOOD_CRIT_CHANCE = 0.25;
const IRONWOOD_CRIT_MULT = 1.8;
/** Ironwood's base hit, chosen so its average with crits is exactly 1.0 like every other tower. */
const IRONWOOD_BASE = 1 / (1 - IRONWOOD_CRIT_CHANCE + IRONWOOD_CRIT_CHANCE * IRONWOOD_CRIT_MULT);
const HEAD_WEAK_POINT = 1.6;
const ECLIPSE_BONUS = 1.25;
const SHIELD_FACTOR = 0.2;
const STRIKE_MULT = 12;
export const STRIKE_CHARGE_MS = 18_000;
export const MOVE_TIME_MS = 800;
export const MOVE_COOLDOWN_MS = 4_000;
export const STAR_WARN_MS = 2_600;
export const STUN_MS = 5_000;
const SHIELD_FIRST_MS = 104_000;
const SHIELD_EVERY_MS = 14_000;
export const SHIELD_MS = 4_000;
const DIVE_MS = 2_500;

/** Whether a tower on `slot` can reach the body part at distance `s` (same test for every tower). */
function inRange(slot: Pt, s: number): boolean {
  const pt = pathAt(s);
  return Math.hypot(pt.x - slot.x, (pt.y - slot.y) * 1.15) <= TOWER_RANGE;
}

/**
 * FAIR PLAY — some slots see the Serpent for longer than others (the outer
 * turns are longer). Each slot's damage is scaled so every slot has the same
 * expected damage over a full attempt: the choice of slot is about WHEN you
 * fight (early or late, head or body), never about how much.
 */
export const SLOT_FAIRNESS: readonly number[] = (() => {
  const exposure = COLOSSUS_SLOTS.map((slot) => {
    let e = 0;
    for (let t = 0; t <= COLOSSUS_LENGTH_MS; t += 250) {
      const head = (PATH_LENGTH * t) / COLOSSUS_LENGTH_MS;
      for (let k = 0; k <= BODY_SEGMENTS; k++) {
        const s = head - k * SEGMENT_GAP;
        if (s < 0 || s > PATH_LENGTH) continue;
        if (inRange(slot, s)) {
          e += k === 0 ? HEAD_WEAK_POINT : 1;
          break;
        }
      }
    }
    return Math.max(1, e);
  });
  const mean = exposure.reduce((a, b) => a + b, 0) / exposure.length;
  return exposure.map((e) => mean / e);
})();

const ATTACK_MS: Record<TowerType, number> = { IRONWOOD: 800, INFERNO: 1200, FROSTBORN: 1000, STORMCALLER: 1100 };

export interface RaidPlayer {
  name: string;
  type: TowerType;
  /** Raid damage per second (config/colossus.ts raidPower). */
  power: number;
  slot: number;
  damage: number;
  attackInMs: number;
  stunnedUntil: number;
  movingUntil: number;
  moveReadyAt: number;
  /** 0..1 Star Strike charge. */
  charge: number;
  skin: string | null;
  isYou: boolean;
}

export interface RaidShot {
  from: number;
  /** Distance along the road of the body part that was hit. */
  s: number;
  type: TowerType;
  at: number;
  crit: boolean;
  strike: boolean;
  head: boolean;
  amount: number;
  shielded: boolean;
}

export interface FallingStar {
  slot: number;
  impactAt: number;
}

export interface Impact {
  slot: number;
  at: number;
  hit: boolean;
}

export interface ColossusSnapshot {
  timeMs: number;
  phase: ColossusPhaseId;
  /** Distance of the head along the road. */
  headS: number;
  players: readonly RaidPlayer[];
  shots: readonly RaidShot[];
  stars: readonly FallingStar[];
  impacts: readonly Impact[];
  shieldUntil: number;
  /** Next shield start (Eclipse only), for the warning. */
  nextShieldAt: number | null;
  frostUntil: number;
  roomDamage: number;
  over: boolean;
  /** 0..1 progress of the final dive into the core (after the clock ends). */
  dive: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALLY_NAMES = [
  "BrasaViva", "LunaTD", "Kraken_br", "MagoDoSul", "Tormenta77", "ReiDaTorre", "Gelo&Fogo", "SerraNegra", "Pixel_Ronin", "ArqueiraSol",
  "Vulto", "Dona_Runa", "Trovão_RJ", "Ferrugem", "NevoaAzul", "CapitãCinza", "Zé_Balista", "Faísca", "Lobo_Antigo", "Orvalho",
  "Caçadora", "Brisa_Fria", "Marreta", "Estilingue", "SombraLeve", "Âmbar", "Coruja_SP", "Relâmpago", "Pedra_Lua", "Carvão",
];

export interface RaidSetup {
  seed: number;
  you: { name: string; type: TowerType; power: number; skin: string | null };
  /** Slot the player picked (any slot; allies take others). */
  slot: number;
}

export class ColossusEngine {
  private rng: () => number;
  private t = 0;
  private players: RaidPlayer[] = [];
  private shots: RaidShot[] = [];
  private stars: FallingStar[] = [];
  private impacts: Impact[] = [];
  private nextStarAt = 45_000;
  private shieldUntil = -1;
  private frostUntil = -1;
  private pendingMoves: { player: number; at: number; to: number }[] = [];
  private roomDamage = 0;
  private ended = false;

  constructor(setup: RaidSetup) {
    this.rng = mulberry32(setup.seed);
    const free = Array.from({ length: SLOT_COUNT }, (_, i) => i).filter((i) => i !== setup.slot);
    // shuffle the free slots so allies land somewhere different each attempt
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [free[i], free[j]] = [free[j]!, free[i]!];
    }
    const names = [...ALLY_NAMES];
    const types: TowerType[] = ["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"];
    this.players.push(this.makePlayer(setup.you.name, setup.you.type, setup.you.power, setup.slot, setup.you.skin, true));
    for (let i = 1; i < COLOSSUS_ROOM_SIZE; i++) {
      const name = names.splice(Math.floor(this.rng() * names.length), 1)[0]!;
      // allies around the player's own strength (log-normal spread)
      const g = (this.rng() + this.rng() + this.rng() - 1.5) * 1.4;
      const power = Math.round(setup.you.power * Math.exp(g * 0.32));
      this.players.push(this.makePlayer(name, types[Math.floor(this.rng() * 4)]!, power, free[i - 1]!, null, false));
    }
  }

  private makePlayer(name: string, type: TowerType, power: number, slot: number, skin: string | null, isYou: boolean): RaidPlayer {
    return { name, type, power, slot, damage: 0, attackInMs: 300 + Math.floor(this.rng() * 600), stunnedUntil: -1, movingUntil: -1, moveReadyAt: 0, charge: 0, skin, isYou };
  }

  get timeMs(): number {
    return this.t;
  }

  headS(): number {
    return (PATH_LENGTH * Math.min(this.t, COLOSSUS_LENGTH_MS)) / COLOSSUS_LENGTH_MS + Math.max(0, this.t - COLOSSUS_LENGTH_MS) * (PATH_LENGTH / COLOSSUS_LENGTH_MS) * 3;
  }

  private shielded(): boolean {
    return this.t < this.shieldUntil;
  }

  private nextShieldAt(): number | null {
    if (this.t >= COLOSSUS_LENGTH_MS) return null;
    if (this.t < SHIELD_FIRST_MS) return colossusPhaseAt(this.t) === "ECLIPSE" ? SHIELD_FIRST_MS : null;
    const k = Math.ceil((this.t - SHIELD_FIRST_MS) / SHIELD_EVERY_MS);
    const at = SHIELD_FIRST_MS + k * SHIELD_EVERY_MS;
    return at < COLOSSUS_LENGTH_MS ? at : null;
  }

  private occupied(slot: number, except = -1): boolean {
    return this.players.some((p, i) => i !== except && p.slot === slot);
  }

  /** Player `who` moves their tower to a free slot (dodging a falling star). */
  moveTo(slot: number, who = 0): boolean {
    const p = this.players[who];
    if (!p || this.ended || this.t >= COLOSSUS_LENGTH_MS) return false;
    if (slot < 0 || slot >= SLOT_COUNT || slot === p.slot || this.occupied(slot, who)) return false;
    if (this.t < p.moveReadyAt || this.t < p.stunnedUntil || this.t < p.movingUntil) return false;
    p.slot = slot;
    p.movingUntil = this.t + MOVE_TIME_MS;
    p.moveReadyAt = this.t + MOVE_COOLDOWN_MS;
    return true;
  }

  /** Fires the charged Star Strike at the best body part in range. */
  strike(who = 0): boolean {
    const p = this.players[who];
    if (!p || p.charge < 1 || this.ended || this.t >= COLOSSUS_LENGTH_MS) return false;
    if (this.t < p.stunnedUntil || this.t < p.movingUntil) return false;
    const target = this.targetFor(p);
    if (!target) return false;
    p.charge = 0;
    this.hit(who, target, STRIKE_MULT, true);
    return true;
  }

  /** The body part this player's tower shoots: the head when in range, else the part nearest the head. */
  private targetFor(p: RaidPlayer): { s: number; head: boolean } | null {
    const slot = COLOSSUS_SLOTS[p.slot]!;
    const head = this.headS();
    for (let k = 0; k <= BODY_SEGMENTS; k++) {
      const s = head - k * SEGMENT_GAP;
      if (s < 0 || s > PATH_LENGTH) continue;
      if (inRange(slot, s)) return { s, head: k === 0 };
    }
    return null;
  }

  private hit(who: number, target: { s: number; head: boolean }, mult: number, strike: boolean): void {
    const p = this.players[who]!;
    const interval = ATTACK_MS[p.type] / 1000;
    let amount = p.power * interval * mult * (target.head ? HEAD_WEAK_POINT : 1);
    // FAIR PLAY — every tower type deals the same damage on average (Ironwood's
    // crits are paid for by a lower base hit), and every slot is evened out
    // by SLOT_FAIRNESS, so no tower and no slot starts ahead.
    let crit = false;
    if (p.type === "IRONWOOD" && !strike) {
      amount *= IRONWOOD_BASE;
      if (this.rng() < IRONWOOD_CRIT_CHANCE) {
        amount *= IRONWOOD_CRIT_MULT;
        crit = true;
      }
    }
    amount *= SLOT_FAIRNESS[p.slot] ?? 1;
    if (this.t < this.frostUntil) amount *= 1.1;
    if (colossusPhaseAt(this.t) === "ECLIPSE") amount *= ECLIPSE_BONUS;
    const shielded = this.shielded();
    if (shielded) amount *= SHIELD_FACTOR;
    amount = Math.round(amount);
    if (p.type === "FROSTBORN") this.frostUntil = Math.max(this.frostUntil, this.t + 2_500);
    p.damage += amount;
    this.roomDamage += amount;
    this.shots.push({ from: who, s: target.s, type: p.type, at: this.t, crit, strike, head: target.head, amount, shielded });
  }

  /** Advances the attempt by `ms` (a multiple of 50 ms). */
  advance(ms: number): void {
    const steps = Math.max(0, Math.floor(ms / 50));
    for (let i = 0; i < steps && !this.ended; i++) this.step();
  }

  private step(): void {
    const DT = 50;
    this.t += DT;
    const live = this.t <= COLOSSUS_LENGTH_MS;
    if (!live) {
      if (this.t >= COLOSSUS_LENGTH_MS + DIVE_MS) this.ended = true;
      this.stars = [];
      this.pruneFx();
      return;
    }
    const phase = colossusPhaseAt(this.t);

    // Eclipse shields
    if (this.t >= SHIELD_FIRST_MS && (this.t - SHIELD_FIRST_MS) % SHIELD_EVERY_MS === 0) this.shieldUntil = this.t + SHIELD_MS;

    // Falling stars
    if (phase !== "AWAKEN" && this.t >= this.nextStarAt && this.t < COLOSSUS_LENGTH_MS - STAR_WARN_MS) {
      const count = phase === "ECLIPSE" ? 3 : 2;
      const taken = new Set(this.stars.map((s) => s.slot));
      const occupied = this.players.map((p) => p.slot).filter((s) => !taken.has(s));
      for (let k = 0; k < count; k++) {
        const pool = occupied.length ? occupied : Array.from({ length: SLOT_COUNT }, (_, i) => i).filter((s) => !taken.has(s));
        if (!pool.length) break;
        // the local player is never targeted twice in a row on purpose — just random, like everyone
        const slot = pool.splice(Math.floor(this.rng() * pool.length), 1)[0]!;
        taken.add(slot);
        this.stars.push({ slot, impactAt: this.t + STAR_WARN_MS });
        // a simulated ally on that slot may step away in time
        const ally = this.players.findIndex((p) => !p.isYou && p.slot === slot);
        if (ally > 0 && this.rng() < 0.55) this.pendingMoves.push({ player: ally, at: this.t + 600 + Math.floor(this.rng() * 900), to: -1 });
      }
      this.nextStarAt = this.t + (phase === "ECLIPSE" ? 5_000 : 7_000);
    }
    for (const mv of this.pendingMoves.filter((m) => m.at <= this.t)) {
      const danger = new Set(this.stars.map((s) => s.slot));
      const options = Array.from({ length: SLOT_COUNT }, (_, i) => i).filter((s) => !danger.has(s) && !this.occupied(s));
      if (options.length) this.moveTo(options[Math.floor(this.rng() * options.length)]!, mv.player);
    }
    this.pendingMoves = this.pendingMoves.filter((m) => m.at > this.t);
    for (const star of this.stars.filter((s) => s.impactAt <= this.t)) {
      const victim = this.players.find((p) => p.slot === star.slot);
      if (victim) victim.stunnedUntil = this.t + STUN_MS;
      this.impacts.push({ slot: star.slot, at: this.t, hit: !!victim });
    }
    this.stars = this.stars.filter((s) => s.impactAt > this.t);

    // Towers
    this.players.forEach((p, i) => {
      const busy = this.t < p.stunnedUntil || this.t < p.movingUntil;
      if (!busy) p.charge = Math.min(1, p.charge + DT / STRIKE_CHARGE_MS);
      if (busy) return;
      // simulated allies fire their Strike when charged — usually not into a shield
      if (!p.isYou && p.charge >= 1 && (!this.shielded() || this.rng() < 0.004)) {
        if (this.strike(i)) return;
      }
      p.attackInMs -= DT;
      if (p.attackInMs > 0) return;
      p.attackInMs += ATTACK_MS[p.type];
      const target = this.targetFor(p);
      if (target) this.hit(i, target, 1, false);
    });
    this.pruneFx();
  }

  private pruneFx(): void {
    this.shots = this.shots.filter((s) => this.t - s.at < 700);
    this.impacts = this.impacts.filter((s) => this.t - s.at < 900);
  }

  /** Ranking of the room by damage (1-based place of player `who`). */
  placeOf(who = 0): number {
    const me = this.players[who]!;
    return 1 + this.players.filter((p) => p !== me && p.damage > me.damage).length;
  }

  snapshot(): ColossusSnapshot {
    return {
      timeMs: this.t,
      phase: colossusPhaseAt(Math.min(this.t, COLOSSUS_LENGTH_MS - 1)),
      headS: this.headS(),
      players: this.players.map((p) => ({ ...p })),
      shots: [...this.shots],
      stars: [...this.stars],
      impacts: [...this.impacts],
      shieldUntil: this.shieldUntil,
      nextShieldAt: this.nextShieldAt(),
      frostUntil: this.frostUntil,
      roomDamage: this.roomDamage,
      over: this.ended,
      dive: Math.max(0, Math.min(1, (this.t - COLOSSUS_LENGTH_MS) / DIVE_MS)),
    };
  }
}
