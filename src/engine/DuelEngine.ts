import {
  DUEL_CARDS,
  DUEL_CASTLE_HP,
  DUEL_DOUBLE_MANA_FROM_MS,
  DUEL_LENGTH_MS,
  DUEL_MANA_EVERY_MS,
  DUEL_MAX_MANA,
  DUEL_START_MANA,
  DUEL_TICK_MS,
  DUEL_HP_GROWTH_PER_MIN,
  getDuelCard,
  HAND_SIZE,
  MAX_DUEL_TOWER_LEVEL,
  type DuelCard,
  type DuelCardId,
  type DuelOutcome,
  type DuelSendCard,
  type DuelTowerCard,
} from "@/config/duel";
import { createEnemyInstance, type EnemyInstance } from "@/entities/Enemy";
import { createTowerInstance, type TowerInstance } from "@/entities/Tower";
import type { TowerType } from "@/config/towerStats";

/**
 * DUELO — the match itself. Fixed 50ms ticks and a seeded random, so the
 * same seed and the same plays always give the same match (the base an
 * online Duel will need). The renderer only reads `snapshot()`.
 */

export type Side = 0 | 1;

export interface Pt {
  x: number;
  y: number;
}

/** One lane, in its own 640x660 space; side 1 is drawn shifted right by LANE_W. */
export const LANE_W = 640;
export const LANE_H = 660;
const LANE_CORNERS: readonly Pt[] = [
  { x: 320, y: 40 },
  { x: 320, y: 105 },
  { x: 110, y: 105 },
  { x: 110, y: 255 },
  { x: 530, y: 255 },
  { x: 530, y: 405 },
  { x: 110, y: 405 },
  { x: 110, y: 535 },
  { x: 320, y: 535 },
  { x: 320, y: 610 },
];
/** Rounds every corner of a polyline with an arc of `radius` (the road bends instead of turning on a point). */
export function roundCorners(pts: readonly Pt[], radius: number, steps = 7): Pt[] {
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const la = Math.hypot(b.x - a.x, b.y - a.y);
    const lc = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radius, la / 2, lc / 2);
    const p0 = { x: b.x + ((a.x - b.x) / la) * r, y: b.y + ((a.y - b.y) / la) * r };
    const p2 = { x: b.x + ((c.x - b.x) / lc) * r, y: b.y + ((c.y - b.y) / lc) * r };
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      // quadratic Bézier through the corner — a smooth bend
      out.push({ x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * b.x + t * t * p2.x, y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * b.y + t * t * p2.y });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** The road every creature walks — the same points the Duel ground was baked with. */
const LANE_PATH: readonly Pt[] = roundCorners(LANE_CORNERS, 42);

export const LANE_SLOTS: readonly Pt[] = [
  { x: 225, y: 180 },
  { x: 425, y: 180 },
  { x: 225, y: 330 },
  { x: 425, y: 330 },
  { x: 225, y: 470 },
  { x: 425, y: 470 },
];
export const CASTLE_AT: Pt = { x: 320, y: 615 };

export function lanePath(side: Side): Pt[] {
  return LANE_PATH.map((p) => ({ x: p.x + side * LANE_W, y: p.y }));
}
export function slotPos(side: Side, i: number): Pt {
  const s = LANE_SLOTS[i]!;
  return { x: s.x + side * LANE_W, y: s.y };
}

/** Creatures sent later in the match come stronger, so a match can't stall behind full defences. */
export function duelHpScale(t: number): number {
  return 1 + DUEL_HP_GROWTH_PER_MIN * (t / 60_000);
}

const SEGS = LANE_PATH.slice(1).map((p, i) => Math.hypot(p.x - LANE_PATH[i]!.x, p.y - LANE_PATH[i]!.y));
const PATH_LEN = SEGS.reduce((a, b) => a + b, 0);

function pointAt(side: Side, dist: number): { p: Pt; angle: number } {
  let d = Math.max(0, dist);
  for (let i = 0; i < SEGS.length; i++) {
    const a = LANE_PATH[i]!;
    const b = LANE_PATH[i + 1]!;
    if (d <= SEGS[i]! || i === SEGS.length - 1) {
      const t = Math.min(1, d / SEGS[i]!);
      return { p: { x: a.x + (b.x - a.x) * t + side * LANE_W, y: a.y + (b.y - a.y) * t }, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    d -= SEGS[i]!;
  }
  return { p: { x: CASTLE_AT.x + side * LANE_W, y: CASTLE_AT.y }, angle: Math.PI / 2 };
}

export function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Unit {
  id: number;
  /** The lane it walks (the side being attacked). */
  side: Side;
  card: DuelSendCard;
  dist: number;
  hp: number;
  slowUntil: number;
  inst: EnemyInstance;
  angle: number;
  turnRate: number;
}

interface DTower {
  side: Side;
  slot: number;
  card: DuelTowerCard;
  level: number;
  cooldown: number;
  inst: TowerInstance;
  lastShotAt: number;
}

export interface Shot {
  side: Side;
  type: TowerType;
  from: Pt;
  to: Pt;
  at: number;
  /** STORMCALLER chain: extra hops. */
  hops?: Pt[];
}

interface Player {
  mana: number;
  manaAcc: number;
  castle: number;
  hand: DuelCardId[];
  queue: DuelCardId[];
  next: DuelCardId;
  plays: number;
  sends: number;
}

export interface DuelSnapshot {
  timeMs: number;
  over: boolean;
  outcome: DuelOutcome | null;
  players: readonly { mana: number; castle: number; hand: readonly DuelCardId[]; next: DuelCardId; sends: number }[];
  units: readonly Unit[];
  towers: readonly DTower[];
  shots: readonly Shot[];
  breaches: readonly { side: Side; at: number; dmg: number }[];
  /** Creatures that fell in the last moment (for death puffs). */
  deaths: readonly { x: number; y: number; at: number; big: boolean }[];
  doubleMana: boolean;
}

export class DuelEngine {
  readonly seed: number;
  private r: () => number;
  private t = 0;
  private uid = 1;
  private players: [Player, Player];
  private units: Unit[] = [];
  private towers: DTower[] = [];
  private shots: Shot[] = [];
  private breaches: { side: Side; at: number; dmg: number }[] = [];
  private deaths: { x: number; y: number; at: number; big: boolean }[] = [];
  private ai: { skill: number; nextThinkAt: number } | null;
  over = false;
  outcome: DuelOutcome | null = null;
  private skinBySide: [Partial<Record<TowerType, string>>, Partial<Record<TowerType, string>>];

  /** `aiSkill` 0..1 makes side 1 an AI; null leaves both sides to `play`. */
  constructor(seed: number, decks: [readonly DuelCardId[], readonly DuelCardId[]], aiSkill: number | null, skins: Partial<Record<TowerType, string>> = {}) {
    this.seed = seed;
    this.r = rng(seed);
    this.players = [this.newPlayer(decks[0]), this.newPlayer(decks[1])];
    this.ai = aiSkill === null ? null : { skill: Math.max(0, Math.min(1, aiSkill)), nextThinkAt: 3000 };
    this.skinBySide = [skins, {}];
  }

  private newPlayer(deck: readonly DuelCardId[]): Player {
    const cards = [...deck];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [cards[i], cards[j]] = [cards[j]!, cards[i]!];
    }
    return { mana: DUEL_START_MANA, manaAcc: 0, castle: DUEL_CASTLE_HP, hand: cards.slice(0, HAND_SIZE), queue: cards.slice(HAND_SIZE + 1), next: cards[HAND_SIZE]!, plays: 0, sends: 0 };
  }

  get timeMs(): number {
    return this.t;
  }

  /** Can `side` play hand card `cardId` (on `slot` for a tower) right now? */
  canPlay(side: Side, cardId: DuelCardId, slot?: number): boolean {
    if (this.over) return false;
    const p = this.players[side];
    const card = getDuelCard(cardId);
    if (!card || !p.hand.includes(cardId) || p.mana < card.cost) return false;
    if (card.kind === "TOWER") {
      if (slot === undefined || slot < 0 || slot >= LANE_SLOTS.length) return false;
      const there = this.towers.find((t) => t.side === side && t.slot === slot);
      if (there && (there.card.id !== card.id || there.level >= MAX_DUEL_TOWER_LEVEL)) return false;
    }
    return true;
  }

  /** Plays a card: a tower card builds (or levels up the same tower) on your road; a creature card sends its group down the other road. */
  play(side: Side, cardId: DuelCardId, slot?: number): boolean {
    if (!this.canPlay(side, cardId, slot)) return false;
    const p = this.players[side];
    const card = getDuelCard(cardId)!;
    p.mana -= card.cost;
    p.plays += 1;
    // cycle: the played card goes to the back, the next one comes in
    p.hand = p.hand.map((c) => (c === cardId ? p.next : c));
    p.queue.push(cardId);
    p.next = p.queue.shift()!;
    if (card.kind === "TOWER") this.buildTower(side, card, slot!);
    else {
      p.sends += 1;
      this.send((1 - side) as Side, card);
    }
    return true;
  }

  private buildTower(side: Side, card: DuelTowerCard, slot: number): void {
    const there = this.towers.find((t) => t.side === side && t.slot === slot);
    if (there) {
      there.level += 1;
      there.inst.level = [1, 21, 41][there.level - 1]!;
      return;
    }
    const pos = slotPos(side, slot);
    const inst = createTowerInstance(`d${side}-${slot}`, card.tower, pos, 1, null, 0, this.skinBySide[side][card.tower] ?? null);
    this.towers.push({ side, slot, card, level: 1, cooldown: 400, inst, lastShotAt: -1e9 });
  }

  private send(side: Side, card: DuelSendCard): void {
    const hp = Math.round(card.hp * duelHpScale(this.t));
    for (let i = 0; i < card.count; i++) {
      const inst = createEnemyInstance(card.enemy, 1);
      inst.id = `du${this.uid}`;
      inst.maxHp = hp;
      inst.hp = hp;
      this.units.push({ id: this.uid++, side, card, dist: -i * 26, hp, slowUntil: 0, inst, angle: Math.PI / 2, turnRate: 0 });
    }
  }

  /** Runs whole ticks up to `ms` of game time. */
  advance(ms: number): void {
    const steps = Math.floor(ms / DUEL_TICK_MS);
    for (let i = 0; i < steps && !this.over; i++) this.tick();
  }

  private tick(): void {
    const dt = DUEL_TICK_MS;
    this.t += dt;
    const every = this.t >= DUEL_DOUBLE_MANA_FROM_MS ? DUEL_MANA_EVERY_MS / 2 : DUEL_MANA_EVERY_MS;
    for (const p of this.players) {
      p.manaAcc += dt;
      while (p.manaAcc >= every) {
        p.manaAcc -= every;
        p.mana = Math.min(DUEL_MAX_MANA, p.mana + 1);
      }
    }
    if (this.ai && this.t >= this.ai.nextThinkAt) this.thinkAi();

    // move
    for (const u of this.units) {
      const slow = this.t < u.slowUntil ? 0.6 : 1;
      u.dist += (u.card.speed * slow * dt) / 1000;
      const { p, angle } = pointAt(u.side, u.dist);
      u.inst.position = p;
      // turn smoothly at corners instead of snapping (the body banks into the turn)
      let diff = angle - u.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = (7 * dt) / 1000;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
      u.angle += turn;
      u.turnRate = turn / dt;
      u.inst.direction = { x: Math.cos(angle), y: Math.sin(angle) };
      // the creature's own gait is driven by the distance it has walked
      u.inst.distanceTraveled = Math.max(0, u.dist);
      u.inst.baseSpeed = u.card.speed;
      u.inst.hp = u.hp;
    }
    // breach
    for (const u of this.units) {
      if (u.dist >= PATH_LEN && u.hp > 0) {
        this.players[u.side].castle -= u.card.breach;
        this.breaches.push({ side: u.side, at: this.t, dmg: u.card.breach });
        u.hp = 0;
      }
    }
    // towers
    for (const tw of this.towers) {
      tw.cooldown -= dt;
      if (tw.cooldown > 0) continue;
      const inRange = this.units
        .filter((u) => u.side === tw.side && u.hp > 0 && u.dist > 0 && Math.hypot(u.inst.position.x - tw.inst.position.x, u.inst.position.y - tw.inst.position.y) <= tw.card.range)
        .sort((a, b) => b.dist - a.dist);
      const target = inRange[0];
      if (!target) continue;
      tw.cooldown = 1000 / tw.card.rate;
      tw.lastShotAt = this.t;
      tw.inst.cooldownRemainingMs = 0;
      const dmg = tw.card.damage[tw.level - 1]!;
      const shot: Shot = { side: tw.side, type: tw.card.tower, from: { ...tw.inst.position }, to: { ...target.inst.position }, at: this.t };
      this.hit(target, dmg);
      if (tw.card.slow) target.slowUntil = this.t + 1500;
      if (tw.card.splash) {
        for (const u of this.units) if (u !== target && u.side === tw.side && u.hp > 0 && Math.hypot(u.inst.position.x - target.inst.position.x, u.inst.position.y - target.inst.position.y) <= tw.card.splash) this.hit(u, dmg * 0.6);
      }
      if (tw.card.chain) {
        shot.hops = [];
        let from = target;
        const hitSet = new Set([target.id]);
        for (let k = 0; k < tw.card.chain; k++) {
          const nxt = this.units
            .filter((u) => u.side === tw.side && u.hp > 0 && !hitSet.has(u.id))
            .sort((a, b) => Math.hypot(a.inst.position.x - from.inst.position.x, a.inst.position.y - from.inst.position.y) - Math.hypot(b.inst.position.x - from.inst.position.x, b.inst.position.y - from.inst.position.y))[0];
          if (!nxt || Math.hypot(nxt.inst.position.x - from.inst.position.x, nxt.inst.position.y - from.inst.position.y) > 90) break;
          hitSet.add(nxt.id);
          this.hit(nxt, dmg * 0.7);
          shot.hops.push({ ...nxt.inst.position });
          from = nxt;
        }
      }
      this.shots.push(shot);
    }
    for (const u of this.units) if (u.hp <= 0 && u.dist < PATH_LEN) this.deaths.push({ x: u.inst.position.x, y: u.inst.position.y, at: this.t, big: u.card.breach >= 3 });
    this.units = this.units.filter((u) => u.hp > 0);
    this.deaths = this.deaths.filter((d) => this.t - d.at < 900);
    this.shots = this.shots.filter((s) => this.t - s.at < 400);
    this.breaches = this.breaches.filter((b) => this.t - b.at < 1200);

    // end
    const [a, b] = this.players;
    if (a.castle <= 0 || b.castle <= 0) this.finish(a.castle <= 0 && b.castle <= 0 ? "DRAW" : a.castle <= 0 ? "LOSS" : "WIN");
    else if (this.t >= DUEL_LENGTH_MS) this.finish(a.castle > b.castle ? "WIN" : a.castle < b.castle ? "LOSS" : "DRAW");
  }

  private hit(u: Unit, dmg: number): void {
    u.hp -= dmg * (1 - (u.card.armor ?? 0));
  }

  /** Gives up the match: a loss. */
  surrender(): void {
    if (!this.over) this.finish("LOSS");
  }

  private finish(outcome: DuelOutcome): void {
    this.over = true;
    this.outcome = outcome;
  }

  // ── AI ────────────────────────────────────────────────────────────────
  /** Simple, readable AI: defends when its road is busy, builds when it has room, otherwise sends. Higher skill reacts faster and spends smarter. */
  private thinkAi(): void {
    const ai = this.ai!;
    ai.nextThinkAt = this.t + 2800 - ai.skill * 2000 + this.r() * 600;
    const me = this.players[1];
    const hand = me.hand.map((id) => getDuelCard(id)!).filter((c) => c.cost <= me.mana);
    if (hand.length === 0) return;
    const threat = this.units.filter((u) => u.side === 1).reduce((s, u) => s + u.hp, 0);
    const myTowers = this.towers.filter((t) => t.side === 1);
    const power = myTowers.reduce((s, t) => s + t.card.damage[t.level - 1]! * t.card.rate, 0);
    const towerCards = hand.filter((c): c is DuelTowerCard => c.kind === "TOWER");
    const sendCards = hand.filter((c): c is DuelSendCard => c.kind === "SEND");
    const needDefense = myTowers.length < 2 || threat > power * (6 + ai.skill * 4);
    // a careless AI sometimes just plays something
    if (this.r() > 0.15 + ai.skill * 0.8) {
      const c = hand[Math.floor(this.r() * hand.length)]!;
      this.aiPlay(c);
      return;
    }
    if (needDefense && towerCards.length) {
      this.aiPlay(towerCards.sort((a, b) => b.cost - a.cost)[0]!);
      return;
    }
    // save up a bit before sending when skilled, so sends come in bunches
    if (sendCards.length && me.mana >= 3 + Math.round(ai.skill * 3)) {
      this.aiPlay(sendCards.sort((a, b) => b.cost - a.cost)[0]!);
      return;
    }
    if (towerCards.length && myTowers.length < 6 && me.mana >= 7) this.aiPlay(towerCards[0]!);
  }

  private aiPlay(card: DuelCard): void {
    if (card.kind === "SEND") {
      this.play(1, card.id);
      return;
    }
    const mine = this.towers.filter((t) => t.side === 1);
    const upgrade = mine.find((t) => t.card.id === card.id && t.level < MAX_DUEL_TOWER_LEVEL);
    const free = LANE_SLOTS.map((_, i) => i).filter((i) => !mine.some((t) => t.slot === i));
    const slot = free.length ? free[Math.floor(this.r() * free.length)]! : upgrade?.slot;
    if (slot !== undefined) this.play(1, card.id, slot);
  }

  snapshot(): DuelSnapshot {
    return {
      timeMs: this.t,
      over: this.over,
      outcome: this.outcome,
      players: this.players.map((p) => ({ mana: p.mana, castle: p.castle, hand: [...p.hand], next: p.next, sends: p.sends })),
      units: this.units,
      towers: this.towers,
      shots: this.shots,
      breaches: this.breaches,
      deaths: this.deaths,
      doubleMana: this.t >= DUEL_DOUBLE_MANA_FROM_MS,
    };
  }

  /** A stable fingerprint of the match state (determinism tests). */
  fingerprint(): string {
    return JSON.stringify([this.t, this.players.map((p) => [p.mana, p.castle, p.hand]), this.units.map((u) => [u.side, Math.round(u.dist), Math.round(u.hp)]), this.towers.map((t) => [t.side, t.slot, t.level])]);
  }
}

export const ALL_DUEL_CARDS = DUEL_CARDS;
