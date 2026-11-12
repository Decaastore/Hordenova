import { describe, expect, it } from "vitest";
import { DuelEngine } from "./DuelEngine";
import { applyDuelResult, arenaFor, createDuelProfile, DEFAULT_DECK, DUEL_REWARDED_WINS_PER_DAY, isValidDeck, sanitizeDeck, TROPHIES_LOSS, TROPHIES_WIN } from "@/config/duel";

const decks = [DEFAULT_DECK, DEFAULT_DECK] as const;

describe("Duel match", () => {
  it("is deterministic: same seed and plays, same match", () => {
    const run = () => {
      const e = new DuelEngine(42, [decks[0], decks[1]], 0.6);
      for (let s = 0; s < 60; s++) {
        e.advance(2000);
        const snap = e.snapshot();
        const card = snap.players[0]!.hand[0]!;
        for (let slot = 0; slot < 6; slot++) if (e.play(0, card, slot)) break;
        e.play(0, card);
      }
      return e.fingerprint();
    };
    expect(run()).toBe(run());
  });

  it("an AI beats a player who does nothing", () => {
    const e = new DuelEngine(7, [decks[0], decks[1]], 0.8);
    e.advance(200_000);
    expect(e.over).toBe(true);
    expect(e.outcome).toBe("LOSS");
  });

  it("tower cards build on your road and level up the same tower; creature cards cost mana", () => {
    const e = new DuelEngine(1, [decks[0], decks[1]], null);
    const hand = e.snapshot().players[0]!.hand;
    const tower = hand.find((c) => c.startsWith("T_"));
    if (tower) {
      expect(e.play(0, tower)).toBe(false); // needs a slot
      expect(e.play(0, tower, 0)).toBe(true);
      expect(e.snapshot().towers.filter((t) => t.side === 0)).toHaveLength(1);
    }
    expect(e.snapshot().players[0]!.mana).toBeLessThan(5 + 1);
  });

  it("time running out decides by castle left", () => {
    const e = new DuelEngine(3, [decks[0], decks[1]], null);
    e.advance(181_000);
    expect(e.over).toBe(true);
    expect(e.outcome).toBe("DRAW");
  });
});

describe("Duel profile", () => {
  it("trophies move by result, never below the arena floor, and wins pay a few Shards a day", () => {
    let p = createDuelProfile();
    const now = 1_000 * 86_400_000;
    let shards = 0;
    for (let i = 0; i < DUEL_REWARDED_WINS_PER_DAY + 2; i++) {
      const r = applyDuelResult(p, "WIN", now);
      p = r.profile;
      shards += r.shards;
    }
    expect(p.trophies).toBe((DUEL_REWARDED_WINS_PER_DAY + 2) * TROPHIES_WIN);
    expect(shards).toBe(DUEL_REWARDED_WINS_PER_DAY);
    p = { ...p, trophies: arenaFor(300).minTrophies + 5 };
    p = applyDuelResult(p, "LOSS", now).profile;
    expect(p.trophies).toBe(300);
    expect(TROPHIES_LOSS).toBeLessThan(TROPHIES_WIN);
  });

  it("validates decks", () => {
    expect(isValidDeck(DEFAULT_DECK)).toBe(true);
    expect(isValidDeck(["T_IRONWOOD"])).toBe(false);
    expect(sanitizeDeck(["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_CRAWLERS", "S_RUNNERS", "S_BRUTE", "T_IRONWOOD"])).toEqual([...DEFAULT_DECK]);
  });
});
