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
    expect(up.prize.coins).toBeGreaterThan(0);
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

  it("the Duel pays Duel Coins and Free Gems — never Gem Shards or Forge materials", async () => {
    const { DUEL_SHOP, STREAK_PRIZES: streaks } = await import("@/config/duel");
    // Free Gems are fine (they work in the whole game); Forge materials and Gem Shards never come from the Duel
    const onlyCoins = (pr: { shards: number; splinters: number; rare: number; epic: number; legendary: number }) => pr.shards + pr.splinters + pr.rare + pr.epic + pr.legendary === 0;
    for (let i = 0; i < RANK_STEPS.length; i++) expect(onlyCoins(rankPrize(i))).toBe(true);
    for (const s2 of streaks) expect(onlyCoins(s2.prize)).toBe(true);
    expect(onlyCoins(FIRST_WIN_PRIZE)).toBe(true);
    for (const item of DUEL_SHOP) {
      expect(item.cosmetic).toBeTruthy();
      expect(item.prize).toBeUndefined();
    }
    let p = { ...createDuelProfile(), coins: 5000 };
    expect(buyDuelShopItem(p, "EPIC", day)).toBeNull();
    p = buyDuelShopItem(p, "BANNER_VOID", day)!.profile;
    expect(p.banner).toBe("BANNER_VOID");
    expect(buyDuelShopItem(p, "BANNER_VOID", day)).toBeNull();
  });

  it("missions move with matches and are claimed once", () => {
    let p = createDuelProfile();
    const ms = duelMissionsFor(1000);
    expect(ms).toHaveLength(3);
    for (let i = 0; i < 20; i++) p = applyDuelResult(p, { outcome: "WIN", myCastle: 20, foeCastle: 0, sends: 5, deck: ["T_IRONWOOD", "T_INFERNO", "T_FROSTBORN", "T_STORMCALLER", "S_CRAWLERS", "S_RUNNERS", "S_BRUTE", "S_SHIELDS"] }, day).profile;
    let gems = 0;
    for (const m of ms) {
      const c = claimDuelMission(p, m.id, day)!;
      expect(c.profile.coins).toBe(p.coins + m.coins);
      gems += c.gems;
      p = c.profile;
      expect(claimDuelMission(p, m.id, day)).toBeNull();
    }
    expect(gems).toBe(3); // all three done: Free Gems bonus, once
  });

  it("weekly wins pay Free Gems once per goal, and the Weekend Tournament crowns a champion", async () => {
    const { WEEKLY_WIN_GOALS, applyTourneyResult, tourneyState, TOURNEY_ROUNDS, TOURNEY_BANNER } = await import("@/config/duel");
    let p = createDuelProfile();
    let gems = 0;
    for (let i = 0; i < 25; i++) {
      const r = applyDuelResult(p, stats("WIN"), day);
      gems += r.prize.gems;
      p = r.profile;
    }
    expect(p.weekWins.paid).toEqual([10, 25]);
    expect(gems).toBeGreaterThanOrEqual(WEEKLY_WIN_GOALS[0]!.prize.gems + WEEKLY_WIN_GOALS[1]!.prize.gems);
    // a Saturday and a Wednesday
    const sat = Date.UTC(2026, 10, 14, 12);
    const wed = Date.UTC(2026, 10, 11, 12);
    expect(tourneyState(p, wed)).toBeNull();
    let q = createDuelProfile();
    let tg = 0;
    for (let i = 0; i < TOURNEY_ROUNDS.length; i++) {
      const r = applyTourneyResult(q, "WIN", sat)!;
      tg += r.prize.gems;
      q = r.profile;
    }
    expect(q.tourney.won).toBe(true);
    expect(q.owned).toContain(TOURNEY_BANNER);
    expect(tg).toBe(25);
    expect(applyTourneyResult(q, "WIN", sat)).toBeNull(); // one run per weekend
    const lost = applyTourneyResult(createDuelProfile(), "LOSS", sat)!;
    expect(lost.profile.tourney.out).toBe(true);
    expect(buyDuelShopItem({ ...createDuelProfile(), coins: 99999 }, TOURNEY_BANNER, sat)).toBeNull(); // never sold
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

describe("Duel cosmetics", () => {
  it("Duel skins and kill effects are bought with coins, worn per tower, and only shown in the Duel and the Eternal castle", async () => {
    const { buyDuelShopItem: buy, createDuelProfile: fresh, duelSkinLooks, duelKillFx, toggleDuelCosmetic } = await import("@/config/duel");
    const { DUEL_TOWER_SKINS, getSkinsForTower } = await import("@/config/towerSkins");
    const { TOWER_SPRITES } = await import("@/rendering/towerSpriteMeta");
    for (const s of DUEL_TOWER_SKINS) {
      expect(Object.keys(TOWER_SPRITES[s.towerType]?.[s.id] ?? {})).toHaveLength(6);
      expect(getSkinsForTower(s.towerType).some((x) => x.id === s.id)).toBe(false); // never in the Gem store / tower panel
      expect(s.gameplayEffect).toEqual({});
    }
    let p = { ...fresh(), coins: 5000 };
    p = buy(p, "SKIN_INFERNO_GLADIATOR", 0)!.profile;
    p = buy(p, "KILL_SOULS", 0)!.profile;
    expect(duelSkinLooks(p)).toEqual({ INFERNO: "INFERNO_GLADIATOR" });
    expect(duelKillFx(p)).toBe("SOULS");
    p = toggleDuelCosmetic(p, "SKIN_INFERNO_GLADIATOR")!;
    expect(duelSkinLooks(p)).toEqual({});
    expect(toggleDuelCosmetic(p, "SKIN_IRONWOOD_CHAMPION")).toBeNull(); // not owned
  });

  it("the Season castle never shows Duel looks; the Eternal castle does", async () => {
    window.localStorage.clear();
    const { updateSave, loadSave, ETERNAL_STORAGE_KEY } = await import("./SaveSystem");
    const { GameEngine } = await import("./GameEngine");
    const { lookSkinId, activeKillFx } = await import("@/rendering/duelLooks");
    const { buyDuelShopItem: buy } = await import("@/config/duel");
    let duel = { ...loadSave().duel, coins: 5000 };
    duel = buy(duel, "SKIN_INFERNO_GLADIATOR", 0)!.profile;
    duel = buy(duel, "KILL_GOLD", 0)!.profile;
    updateSave({ duel });
    new GameEngine(ETERNAL_STORAGE_KEY).startRun();
    expect(lookSkinId("INFERNO", null)).toBe("INFERNO_GLADIATOR");
    expect(activeKillFx()).toBe("GOLD");
    new GameEngine().startRun();
    expect(lookSkinId("INFERNO", "INFERNO_BLUE_FLAME")).toBe("INFERNO_BLUE_FLAME");
    expect(activeKillFx()).toBeNull();
  });
});
