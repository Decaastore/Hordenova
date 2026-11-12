import { describe, expect, it } from "vitest";
import { DuelEngine } from "./DuelEngine";
import { applyDuelResult, buyDuelShopItem, claimDuelMission, createDuelProfile, DEFAULT_DECK, duelMissionsFor, FIRST_WIN_PRIZE, isValidDeck, MATCH_COINS, RANK_STEPS, rankFor, rankPrize, sanitizeDeck } from "@/config/duel";

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
  const stats = (outcome: "WIN" | "LOSS" | "DRAW") => ({ outcome, myCastle: 20, foeCastle: 0, sends: 5, deck: [...DEFAULT_DECK] });
  const day = 1_000 * 86_400_000;

  it("ranks: leagues of three divisions, a league floor, and prizes paid once per rank", () => {
    expect(rankFor(0)).toMatchObject({ league: "BRONZE", division: 1 });
    expect(rankFor(250)).toMatchObject({ league: "BRONZE", division: 3 });
    expect(rankFor(300)).toMatchObject({ league: "SILVER", division: 1 });
    expect(rankFor(1500)).toMatchObject({ league: "MASTER" });
    expect(rankFor(2400)).toMatchObject({ league: "LEGEND", next: null });
    let p = { ...createDuelProfile(), trophies: 290, bestTrophies: 290, rankPaidUpTo: 2 };
    const up = applyDuelResult(p, stats("WIN"), day);
    expect(up.rankAfter.league).toBe("SILVER");
    expect(up.newRanks).toEqual([3]);
    expect(up.prize.shards).toBeGreaterThan(0);
    p = up.profile;
    // drop back: never below Silver's start, and climbing again doesn't pay twice
    p = applyDuelResult(p, stats("LOSS"), day).profile;
    expect(p.trophies).toBe(300);
    expect(applyDuelResult({ ...p, trophies: 290 }, stats("WIN"), day).newRanks).toEqual([]);
  });

  it("first win of the day and streaks pay extra; losses still give a few coins", () => {
    let p = createDuelProfile();
    const w1 = applyDuelResult(p, stats("WIN"), day);
    expect(w1.firstWin).toBe(true);
    expect(w1.prize.coins).toBe(MATCH_COINS.WIN + FIRST_WIN_PRIZE.coins);
    p = w1.profile;
    expect(applyDuelResult(p, stats("WIN"), day).firstWin).toBe(false);
    p = applyDuelResult(applyDuelResult(p, stats("WIN"), day).profile, stats("WIN"), day).profile;
    expect(p.streak).toBe(3);
    expect(applyDuelResult(p, stats("LOSS"), day).prize.coins).toBe(MATCH_COINS.LOSS);
    expect(applyDuelResult(p, stats("LOSS"), day).profile.streak).toBe(0);
  });

  it("Epic essences stay hard: only league promotions, a 10-win streak and one a week in the shop; Legendary only at Legend", () => {
    for (let i = 0; i < RANK_STEPS.length; i++) {
      const pr = rankPrize(i);
      if (pr.epic) expect(RANK_STEPS[i]!.division).toBe(1);
      if (pr.legendary) expect(RANK_STEPS[i]!.league).toBe("LEGEND");
    }
    let p = { ...createDuelProfile(), coins: 5000 };
    const r1 = buyDuelShopItem(p, "EPIC", day)!;
    expect(r1.prize.epic).toBe(1);
    expect(buyDuelShopItem(r1.profile, "EPIC", day)).toBeNull();
    expect(buyDuelShopItem(r1.profile, "EPIC", day + 7 * 86_400_000)).not.toBeNull();
    p = buyDuelShopItem(p, "BANNER_VOID", day)!.profile;
    expect(p.banner).toBe("BANNER_VOID");
    expect(buyDuelShopItem(p, "BANNER_VOID", day)).toBeNull();
  });

  it("missions move with matches and are claimed once", () => {
    let p = createDuelProfile();
    const ms = duelMissionsFor(1000);
    expect(ms).toHaveLength(3);
    for (let i = 0; i < 20; i++) p = applyDuelResult(p, { outcome: "WIN", myCastle: 20, foeCastle: 0, sends: 5, deck: ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_CRAWLERS", "S_RUNNERS", "S_BRUTE", "S_SHIELDS"] }, day).profile;
    for (const m of ms) {
      const c = claimDuelMission(p, m.id, day)!;
      expect(c.coins).toBe(p.coins + m.coins);
      p = c;
      expect(claimDuelMission(p, m.id, day)).toBeNull();
    }
  });

  it("validates decks", () => {
    expect(isValidDeck(DEFAULT_DECK)).toBe(true);
    expect(isValidDeck(["T_IRONWOOD"])).toBe(false);
    expect(sanitizeDeck(["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_CRAWLERS", "S_RUNNERS", "S_BRUTE", "T_IRONWOOD"])).toEqual([...DEFAULT_DECK]);
  });
});

describe("weekly challenge and season rule", () => {
  it("the weekly challenge is the same for everyone that week, with valid decks", async () => {
    const { weeklyChallenge, isValidDeck: valid } = await import("@/config/duel");
    const a = weeklyChallenge(2900);
    expect(a).toEqual(weeklyChallenge(2900));
    expect(valid(a.myDeck)).toBe(true);
    expect(valid(a.foeDeck)).toBe(true);
    expect(weeklyChallenge(2901).seed).not.toBe(a.seed);
  });

  it("every Season rule pairs an upside with a downside", async () => {
    const { SEASON_RULES, getSeasonRule } = await import("@/config/seasonRules");
    for (const r of SEASON_RULES) {
      const up = [r.killGoldPct > 0, r.castleHpPct > 0, r.rangePct > 0, r.critPct > 0, r.attackSpeedPct > 0].some(Boolean);
      const down = [r.enemySpeedPct > 0, r.enemyHpPct > 0, r.rangePct < 0, r.attackSpeedPct < 0].some(Boolean);
      expect(up && down).toBe(true);
    }
    expect(getSeasonRule(1).id).toBe(SEASON_RULES[0]!.id);
    expect(getSeasonRule(1 + SEASON_RULES.length).id).toBe(SEASON_RULES[0]!.id);
  });
});
