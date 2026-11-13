import { describe, expect, it } from "vitest";
import { DuelEngine, LANE_W, METEOR_FALL_MS, type DuelPlay } from "./DuelEngine";
import { DUEL_LENGTH_MS, deckAverageCost, getDuelCard, isValidDeck, type DuelCardId } from "@/config/duel";

const SPELL_DECK: DuelCardId[] = ["X_METEOR", "X_FREEZE", "X_RAGE", "T_IRONWOOD", "T_INFERNO", "S_CRAWLERS", "S_SWARM", "S_BRUTE"];
const SEND_DECK: DuelCardId[] = ["S_CRAWLERS", "S_RUNNERS", "S_BRUTE", "S_SWARM", "S_SHIELDS", "S_IRONCLAD", "T_IRONWOOD", "T_INFERNO"];

/** A two-player match whose opening hands already hold the wanted cards. */
function matchWith(decks: [DuelCardId[], DuelCardId[]], want0: DuelCardId[], want1: DuelCardId[]): DuelEngine {
  for (let seed = 1; seed < 20000; seed++) {
    const e = new DuelEngine(seed, decks, null);
    const [a, b] = e.snapshot().players;
    if (want0.every((c) => a!.hand.includes(c)) && want1.every((c) => b!.hand.includes(c))) return e;
  }
  throw new Error("no seed");
}

describe("Duel spells", () => {
  it("spell decks are valid and the average cost is shown like Clash's elixir", () => {
    expect(isValidDeck(SPELL_DECK)).toBe(true);
    expect(isValidDeck(["X_METEOR", "X_FREEZE", "X_RAGE", "T_IRONWOOD", "T_INFERNO", "S_CRAWLERS", "T_FROSTBORN", "T_STORMCALLER"])).toBe(false); // only 1 creature
    expect(deckAverageCost(SPELL_DECK)).toBeCloseTo((4 + 3 + 3 + 3 + 4 + 2 + 5 + 4) / 8);
  });

  it("aimed spells must land on your own road", () => {
    const e = matchWith([SPELL_DECK, SEND_DECK], ["X_FREEZE"], []);
    expect(e.canPlay(0, "X_FREEZE")).toBe(false); // no spot
    expect(e.canPlay(0, "X_FREEZE", undefined, { x: LANE_W + 300, y: 300 })).toBe(false); // opponent's side
    expect(e.canPlay(0, "X_FREEZE", undefined, { x: 300, y: 300 })).toBe(true);
  });

  it("Meteor falls, then hits every creature in the area", () => {
    const e = matchWith([SPELL_DECK, SEND_DECK], ["X_METEOR"], ["S_SWARM"]);
    expect(e.play(1, "S_SWARM")).toBe(true);
    e.advance(7000);
    const all = e.snapshot().units.filter((u) => u.side === 0 && u.dist > 0);
    expect(all.length).toBeGreaterThan(3);
    // aim where the group will be when the rock lands
    e.advance(0);
    const target = { ...all[Math.floor(all.length / 2)]!.inst.position };
    target.y += (58 * METEOR_FALL_MS) / 1000;
    expect(e.play(0, "X_METEOR", undefined, target)).toBe(true);
    const total = () => e.snapshot().units.filter((u) => u.side === 0).reduce((s, u) => s + u.hp, 0);
    const before = total();
    e.advance(METEOR_FALL_MS - 100);
    expect(total()).toBe(before); // still falling (no towers on that road)
    e.advance(200);
    expect(e.snapshot().units.filter((u) => u.side === 0).length).toBeLessThan(all.length); // the small ones die
    expect(total()).toBeLessThan(before);
  });

  it("Freeze stops creatures in the area for a while", () => {
    const e = matchWith([SPELL_DECK, SEND_DECK], ["X_FREEZE"], ["S_BRUTE"]);
    expect(e.play(1, "S_BRUTE")).toBe(true);
    e.advance(6000);
    const brute = () => e.snapshot().units.find((u) => u.side === 0 && u.card.id === "S_BRUTE")!;
    const d0 = brute().dist;
    expect(e.play(0, "X_FREEZE", undefined, { ...brute().inst.position })).toBe(true);
    e.advance(2000);
    expect(brute().dist).toBe(d0);
    e.advance(1500);
    expect(brute().dist).toBeGreaterThan(d0);
  });

  it("Rage makes your towers fire faster", () => {
    const shots = (rage: boolean) => {
      const e = matchWith([SPELL_DECK, SEND_DECK], ["T_IRONWOOD", "X_RAGE"], ["S_IRONCLAD"]);
      expect(e.play(0, "T_IRONWOOD", 0)).toBe(true);
      e.advance(6000);
      expect(e.play(1, "S_IRONCLAD")).toBe(true);
      e.advance(4000);
      // wait until it walks into range, then (maybe) rage and count shots
      for (let i = 0; i < 400 && !e.snapshot().shots.length; i++) e.advance(50);
      if (rage) expect(e.play(0, "X_RAGE")).toBe(true);
      let n = 0;
      let last = -1;
      for (let i = 0; i < 100; i++) {
        e.advance(50);
        for (const s of e.snapshot().shots) if (s.side === 0 && s.at > last) n++, (last = s.at);
      }
      return n;
    };
    expect(shots(true)).toBeGreaterThan(shots(false));
  });

  it("sudden death: in overtime the first castle hit decides", () => {
    const e = new DuelEngine(4, [SEND_DECK, SEND_DECK], null);
    e.advance(DUEL_LENGTH_MS + 1000);
    expect(e.snapshot().overtime).toBe(true);
    // overtime fills mana three times as fast
    const m0 = e.snapshot().players[0]!.mana;
    expect(m0).toBe(10);
    const send = e.snapshot().players[0]!.hand.find((c) => getDuelCard(c)!.kind === "SEND")!;
    expect(e.play(0, send)).toBe(true);
    for (let i = 0; i < 400 && !e.over; i++) e.advance(100);
    expect(e.over).toBe(true);
    expect(e.outcome).toBe("WIN");
  });

  it("the AI casts spells, and a match replays exactly from its seed and the log", () => {
    const AI_DECK: DuelCardId[] = ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "S_RUNNERS", "S_SWARM", "S_SHIELDS", "X_METEOR", "X_FREEZE"];
    const live = new DuelEngine(77, [SEND_DECK, AI_DECK], 1);
    for (let i = 0; i < 90 && !live.over; i++) {
      live.advance(2000);
      const hand = live.snapshot().players[0]!.hand;
      for (const c of hand) if (getDuelCard(c)!.kind === "SEND" && live.play(0, c)) break;
    }
    live.advance(300_000);
    expect(live.log.some((p) => p.side === 1 && p.card.startsWith("X_"))).toBe(true);
    // replay: only the player's plays are needed — the AI decides the same way again
    const mine: DuelPlay[] = live.log.filter((p) => p.side === 0);
    const again = new DuelEngine(77, [SEND_DECK, AI_DECK], 1);
    for (const p of mine) {
      again.advance(p.t - again.timeMs);
      expect(again.play(p.side, p.card, p.slot, p.at)).toBe(true);
    }
    again.advance(300_000);
    expect(again.outcome).toBe(live.outcome);
    expect(again.fingerprint()).toBe(live.fingerprint());
  });

});
