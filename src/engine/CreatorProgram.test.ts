import { beforeEach, describe, expect, it } from "vitest";
import { loadSave } from "./SaveSystem";
import * as creatorsConfig from "@/config/creators";
import { creatorBonusGems, creatorMonthlyPayout, creatorShareTier, findCreator, normalizeCreatorCode, SUPPORTER_LOOKS, type Creator } from "@/config/creators";
import { DAILY_WATCH_POINTS_CAP, LIVE_REWARDS, LIVE_REWARDS_ENABLED, watchPoints } from "@/config/liveRewards";
import { getShopItem, earnedHow } from "@/config/duel";

const TEST_CREATOR: Creator = { code: "TESTE_1", name: "Canal de Teste", platform: "TWITCH", channelUrl: "https://twitch.tv/teste", since: "2026-11-27" };

describe("Creator Program: rules", () => {
  it("codes are 3–16 letters, digits or _, compared upper-case", () => {
    expect(normalizeCreatorCode(" abc_12 ")).toBe("ABC_12");
    expect(normalizeCreatorCode("ab")).toBeNull();
    expect(normalizeCreatorCode("has-dash")).toBeNull();
    expect(findCreator("teste_1", [TEST_CREATOR])?.name).toBe("Canal de Teste");
    expect(findCreator("OUTRO", [TEST_CREATOR])).toBeNull();
  });

  it("no creator is approved by default (never invented)", () => {
    expect(creatorsConfig.CREATORS).toHaveLength(0);
  });

  it("the month's tier applies to all of its sales: 5% / 10% from R$ 1.000 / 15% from R$ 5.000", () => {
    expect(creatorShareTier(0).pct).toBe(5);
    expect(creatorShareTier(999).pct).toBe(5);
    expect(creatorShareTier(1000).pct).toBe(10);
    expect(creatorShareTier(5000).pct).toBe(15);
    expect(creatorMonthlyPayout(2000)).toBe(200);
    expect(creatorMonthlyPayout(500)).toBe(25);
    expect(creatorMonthlyPayout(6000)).toBe(900);
  });

  it("the player's purchase bonus is 5% of the pack's Purchased Gems", () => {
    expect(creatorBonusGems(1300)).toBe(65);
    expect(creatorBonusGems(100)).toBe(5);
  });

  it("the Supporter looks exist, are earned only, and say how they're earned", () => {
    for (const id of SUPPORTER_LOOKS) {
      expect(getShopItem(id)?.earnedOnly).toBe(true);
      expect(earnedHow(id).creator).toBe(true);
    }
  });
});

describe("Creator Program: the player's code", () => {
  beforeEach(() => window.localStorage.clear());

  it("an approved code is saved on the account and grants the Supporter looks; an unknown one is refused", async () => {
    creatorsConfig.setApprovedCreators([TEST_CREATOR]);
    const svc = await import("./CreatorService");
    const save = await import("./SaveSystem");
    expect(svc.applyCreatorCode("nope_code")).toEqual({ ok: false, reason: "UNKNOWN" });
    expect(svc.applyCreatorCode("!!")).toEqual({ ok: false, reason: "INVALID" });
    const r = svc.applyCreatorCode("teste_1", 1000);
    expect(r.ok).toBe(true);
    const s = save.loadSave();
    expect(s.creatorCode).toBe("TESTE_1");
    expect(s.creatorCodeSetAt).toBe(1000);
    for (const id of SUPPORTER_LOOKS) expect(s.duel.owned).toContain(id);
    expect(svc.applyCreatorCode("TESTE_1")).toEqual({ ok: false, reason: "SAME" });
    expect(svc.creatorCheckout(1300)).toEqual({ creatorCode: "TESTE_1", bonusGems: 65, bonusPct: 5 });
    svc.clearCreatorCode();
    expect(save.loadSave().creatorCode).toBeNull();
    expect(svc.creatorCheckout(1300).bonusGems).toBe(0);
    // the looks stay after removing the code
    for (const id of SUPPORTER_LOOKS) expect(save.loadSave().duel.owned).toContain(id);
    creatorsConfig.setApprovedCreators(creatorsConfig.CREATORS);
  });

  it("a creator link (?criador=CODE) sets the code only on an account that supports nobody yet", async () => {
    creatorsConfig.setApprovedCreators([TEST_CREATOR]);
    const svc = await import("./CreatorService");
    const save = await import("./SaveSystem");
    const loc = { search: "?criador=teste_1", href: "http://localhost/?criador=teste_1" };
    expect(svc.captureCreatorLink(loc)?.code).toBe("TESTE_1");
    save.updateSave({ creatorCode: "OUTRO_X" });
    expect(svc.captureCreatorLink(loc)).toBeNull();
    expect(save.loadSave().creatorCode).toBe("OUTRO_X");
    creatorsConfig.setApprovedCreators(creatorsConfig.CREATORS);
  });

  it("a fresh save supports nobody", () => {
    expect(loadSave().creatorCode).toBeNull();
  });
});

describe("Live Rewards", () => {
  it("stay off (and hidden) until the online server is set up", () => {
    expect(LIVE_REWARDS_ENABLED).toBe(false);
    for (const id of ["BANNER_LIVE", "FRAME_LIVE", "KILL_LIVE"]) expect(earnedHow(id).live).toBe(true);
  });

  it("points come in 5-minute ticks, capped per day; the catalogue gives no Gems", () => {
    expect(watchPoints(4, 0)).toBe(0);
    expect(watchPoints(5, 0)).toBe(10);
    expect(watchPoints(60, 0)).toBe(120);
    expect(watchPoints(600, 0)).toBe(DAILY_WATCH_POINTS_CAP);
    expect(watchPoints(60, DAILY_WATCH_POINTS_CAP - 30)).toBe(30);
    for (const r of LIVE_REWARDS) expect((r.parts ?? []).some((p) => p.kind === "GEMS" || p.kind === "PURCHASED_GEMS")).toBe(false);
    for (const r of LIVE_REWARDS) if (r.duelLook) expect(getShopItem(r.duelLook)?.earnedOnly).toBe(true);
  });
});
