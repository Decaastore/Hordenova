import { describe, expect, it } from "vitest";
import { ACTIVE_FREE_GEMS_PER_DAY, ACTIVE_FREE_GEMS_PER_MONTH, bestTrophy, RANKED_PRIZES, rankedTitleFor, type RankedBoard } from "./rankedRewards";
import { COLOSSUS_DAILY_GEMS, COLOSSUS_WORLD_GEMS } from "./colossus";
import { LOGIN_REWARDS } from "./dailyLogin";
import { DAILY_GIFT_FREE_GEMS, GEM_PACKS } from "./store";
import { TOWER_SKINS, isGemPurchasableSkin } from "./towerSkins";
import { CASTLE_SKINS } from "./castleSkins";
import { FREE_GEMS_PRICE_MULTIPLIER } from "./gemsEconomy";
import { DAILY_EPIC_AMOUNT, DAILY_EPIC_GEMS, DAILY_RARE_AMOUNT, DAILY_RARE_GEMS } from "./shopOffers";
import { ITEM_DEFINITIONS, getItemDefinitionsByRarity, isRankedItemDefinition } from "./itemDefinitions";
import { getShopItem } from "./duel";
import { GameEngine } from "@/engine/GameEngine";

/**
 * PURCHASING-POWER CHECK (owner's call, Nov 2026: "faça testes de poder de
 * compra"). Every ranking Gem prize is measured against the game's own
 * economy — what an active free player earns, what the Store sells, what the
 * daily Forge offers could turn into power, and what the same Gems cost in
 * real money — so a prize stays a prize and never floods the Store.
 */
const free = (purchased: number) => Math.round(purchased * FREE_GEMS_PRICE_MULTIPLIER);
const first = (b: RankedBoard) => RANKED_PRIZES[b][0]!.freeGems;
const totalPaid = (b: RankedBoard) => RANKED_PRIZES[b].reduce((s, t) => s + t.freeGems * (t.to - t.from + 1), 0);

/** The whole cosmetic catalogue the Store sells for Gems, at the Free Gems price. */
const CATALOGUE_FREE =
  TOWER_SKINS.filter(isGemPurchasableSkin).reduce((s, k) => s + free(k.gemCost), 0) +
  CASTLE_SKINS.filter((c) => c.source === "STORE").reduce((s, c) => s + free(c.priceGems ?? 0), 0);
/** A year of buying every daily Forge offer (Rare + Epic Essences) with Free Gems — the only way Gems turn into power. */
const FORGE_YEAR_FREE = 365 * (free(DAILY_RARE_AMOUNT * DAILY_RARE_GEMS) + free(DAILY_EPIC_AMOUNT * DAILY_EPIC_GEMS));
/** Real money per Purchased Gem at the Store's best pack; a Free Gem is worth 1/1.5 of that. */
const BRL_PER_PURCHASED = Math.min(...GEM_PACKS.map((p) => p.priceBrl / (p.gems + p.bonusGems)));
const brl = (freeGems: number) => (freeGems / FREE_GEMS_PRICE_MULTIPLIER) * BRL_PER_PURCHASED;

describe("ranking prizes — purchasing power", () => {
  it("the free-income yardstick is built from the game's real sources", () => {
    expect(DAILY_GIFT_FREE_GEMS).toBe(1);
    expect(COLOSSUS_DAILY_GEMS).toBe(1);
    expect(COLOSSUS_WORLD_GEMS).toBe(3);
    expect(LOGIN_REWARDS.reduce((s, r) => s + (r.freeGems ?? 0), 0)).toBe(2);
    expect(GameEngine.GEM_SHARD_TO_GEM_RATE).toBe(10);
    expect(ACTIVE_FREE_GEMS_PER_DAY).toBeGreaterThan(6);
    expect(ACTIVE_FREE_GEMS_PER_DAY).toBeLessThan(9);
  });

  it("a monthly #1 (Duel, Season) is worth at most ~3 months of an active free player's Gems", () => {
    for (const b of ["DUEL", "SEASON"] as const) expect(first(b)).toBeLessThanOrEqual(ACTIVE_FREE_GEMS_PER_MONTH * 3);
  });

  it("the yearly Eternal #1 is worth at most ~a year of an active free player's Gems", () => {
    expect(first("ETERNAL")).toBeLessThanOrEqual(ACTIVE_FREE_GEMS_PER_MONTH * 12);
  });

  it("even winning #1 everywhere for a whole year can't empty the Store's skin catalogue", () => {
    const year = 12 * (first("DUEL") + first("SEASON")) + first("ETERNAL");
    expect(year).toBeLessThan(CATALOGUE_FREE * 0.6);
  });

  it("even winning #1 everywhere covers only a small share of a year of daily Forge offers (the only Gems-to-power route)", () => {
    const year = 12 * (first("DUEL") + first("SEASON")) + first("ETERNAL");
    expect(year).toBeLessThan(FORGE_YEAR_FREE * 0.15);
  });

  it("in real money: a monthly #1 is under R$ 15, the yearly Eternal #1 under R$ 60, and all 30 prize places of a month together under R$ 150", () => {
    expect(brl(first("DUEL"))).toBeLessThan(15);
    expect(brl(first("SEASON"))).toBeLessThan(15);
    expect(brl(first("ETERNAL"))).toBeLessThan(60);
    expect(brl(totalPaid("DUEL") + totalPaid("SEASON"))).toBeLessThan(150);
  });

  it("prints the purchasing-power table", () => {
    const rows = (["ETERNAL", "DUEL", "SEASON"] as const).map((b) => ({
      board: b,
      first: first(b),
      monthsOfIncome: +(first(b) / ACTIVE_FREE_GEMS_PER_MONTH).toFixed(1),
      catalogueShare: `${((first(b) / CATALOGUE_FREE) * 100).toFixed(1)}%`,
      brl: +brl(first(b)).toFixed(2),
      paidPerPeriod: totalPaid(b),
    }));
    console.log(JSON.stringify({ incomePerMonth: ACTIVE_FREE_GEMS_PER_MONTH, catalogueFree: CATALOGUE_FREE, forgeYearFree: FORGE_YEAR_FREE, rows }));
  });
});

describe("ranking prizes — what can't be bought", () => {
  it("the Eternal relics are account-bound, never a fusion/reward result, and never stronger than a regular item of their rarity", () => {
    const relics = Object.values(ITEM_DEFINITIONS).filter(isRankedItemDefinition);
    expect(relics.map((r) => r.id).sort()).toEqual(["eternal_sand", "immortal_hourglass"]);
    const sum = (d: (typeof relics)[number]) => d.effects.reduce((s, e) => s + e.value, 0);
    for (const r of relics) {
      expect(r.tradable).toBe(false);
      expect(getItemDefinitionsByRarity(r.rarity).some((d) => d.id === r.id)).toBe(false);
      const regular = getItemDefinitionsByRarity(r.rarity);
      expect(regular.length).toBeGreaterThan(0);
      expect(sum(r)).toBeLessThanOrEqual(Math.max(...regular.map(sum)));
    }
    expect(RANKED_PRIZES.ETERNAL[0]!.relic).toBe("immortal_hourglass");
  });

  it("every Duel look a ranking gives exists and is earned-only (never sold for coins)", () => {
    for (const b of ["ETERNAL", "DUEL", "SEASON"] as const)
      for (const t of RANKED_PRIZES[b])
        for (const id of t.looks ?? []) {
          expect(getShopItem(id)?.cosmetic, id).toBeTruthy();
          expect(getShopItem(id)?.earnedOnly, id).toBe(true);
        }
  });

  it("titles: one per placement band, and the profile shows the most prestigious trophy", () => {
    expect(rankedTitleFor("ETERNAL", 1)).toBe("ETERNAL_1");
    expect(rankedTitleFor("DUEL", 3)).toBe("DUEL_TOP3");
    expect(rankedTitleFor("SEASON", 20)).toBe("SEASON_TOP20");
    expect(rankedTitleFor("SEASON", 21)).toBeNull();
    const best = bestTrophy([
      { board: "SEASON" as const, place: 1, atMs: 3 },
      { board: "DUEL" as const, place: 1, atMs: 1 },
      { board: "ETERNAL" as const, place: 4, atMs: 2 },
    ]);
    expect(best?.board).toBe("DUEL");
  });
});
