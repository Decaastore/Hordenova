import { beforeEach, describe, expect, it } from "vitest";
import { canClaimLogin, claimLogin, createDailyLogin, LOGIN_REWARDS } from "./dailyLogin";
import { BEGINNER_MISSIONS, claimBeginner, claimBeginnerFinal } from "./beginnerMissions";
import { claimMilestone, COLLECTIONS, claimableMilestones } from "./collections";
import { CASTLE_SKINS, STORE_CASTLE_SKINS } from "./castleSkins";
import { loadSave, updateSave } from "@/engine/SaveSystem";
import { buyCastleSkin, equipCastleSkin } from "@/engine/StoreService";
import { grantBundle } from "@/engine/RewardBundleGrant";

const DAY = 86_400_000;
beforeEach(() => localStorage.clear());

describe("7-day login", () => {
  it("pays one reward per UTC day, never resets on a missed day, and loops after day 7", () => {
    let s = createDailyLogin();
    const t0 = 20_000 * DAY + 3_600_000;
    const a = claimLogin(s, t0)!;
    expect(a.day).toBe(1);
    expect(a.reward).toEqual(LOGIN_REWARDS[0]);
    s = a.state;
    expect(claimLogin(s, t0 + 1000)).toBeNull();
    expect(canClaimLogin(s, t0 + DAY)).toBe(true);
    // skip three days: the next login still pays day 2
    expect(claimLogin(s, t0 + 4 * DAY)!.day).toBe(2);
    for (let d = 1; d < 7; d++) s = claimLogin(s, t0 + d * DAY)!.state;
    expect(s.step).toBe(0);
    expect(claimLogin(s, t0 + 7 * DAY)!.day).toBe(1);
    // gems stay small
    expect(LOGIN_REWARDS.reduce((a, b) => a + (b.freeGems ?? 0), 0)).toBeLessThanOrEqual(3);
  });
});

describe("First steps", () => {
  it("a step can only be claimed once it is done, once; all steps unlock the Recruit's Keep", () => {
    updateSave({ bestWave: 4 });
    expect(claimBeginner(loadSave(), "WAVE_5")).toBeNull();
    updateSave({ bestWave: 5 });
    const r = claimBeginner(loadSave(), "WAVE_5")!;
    updateSave({ ...grantBundle(loadSave(), r.reward, "t"), beginner: r.state });
    expect(loadSave().gold).toBeGreaterThan(0);
    expect(claimBeginner(loadSave(), "WAVE_5")).toBeNull();
    expect(claimBeginnerFinal(loadSave())).toBeNull();
    updateSave({ beginner: { claimed: BEGINNER_MISSIONS.map((m) => m.id), finalClaimed: false } });
    const fin = claimBeginnerFinal(loadSave())!;
    updateSave({ ...grantBundle(loadSave(), fin.reward, "t"), beginner: fin.state });
    expect(loadSave().unlockedCastleSkinIds).toContain("RECRUIT_KEEP");
    expect(claimBeginnerFinal(loadSave())).toBeNull();
  });
});

describe("Collections", () => {
  it("milestones pay once, only when reached; the full Bestiary gives the Void Spire", () => {
    expect(claimMilestone(loadSave(), "CASTLES", 2)).toBeNull();
    updateSave({ unlockedCastleSkinIds: ["OBSIDIAN_BASTION", "FROST_CITADEL"] });
    expect(claimableMilestones(loadSave())).toBeGreaterThanOrEqual(1);
    const r = claimMilestone(loadSave(), "CASTLES", 2)!;
    updateSave({ collections: r.state });
    expect(claimMilestone(loadSave(), "CASTLES", 2)).toBeNull();
    const bestiary = COLLECTIONS.find((c) => c.id === "BESTIARY")!;
    const last = bestiary.milestones[bestiary.milestones.length - 1]!;
    expect(last.reward.castleSkinId).toBe("VOID_SPIRE");
  });
  it("remembers items held before (Arsenal)", () => {
    updateSave({ discoveredItemIds: ["mosswood_charm"] });
    const arsenal = COLLECTIONS.find((c) => c.id === "ARSENAL")!.entries(loadSave());
    expect(arsenal.find((e) => e.id === "mosswood_charm")!.owned).toBe(true);
  });
});

describe("Castle skins", () => {
  it("only Store skins are sold; buying puts it on the castle; equipping needs ownership", () => {
    expect(STORE_CASTLE_SKINS.length).toBeGreaterThanOrEqual(4);
    expect(CASTLE_SKINS.filter((c) => c.priceGems).every((c) => c.source === "STORE")).toBe(true);
    updateSave({ freeGems: 0, purchasedGems: 0 });
    expect(buyCastleSkin("FROST_CITADEL", "FREE").ok).toBe(false);
    expect(buyCastleSkin("VOID_SPIRE", "FREE").ok).toBe(false);
    expect(equipCastleSkin("FROST_CITADEL").ok).toBe(false);
    updateSave({ freeGems: 5000 });
    const r = buyCastleSkin("FROST_CITADEL", "FREE");
    expect(r.ok).toBe(true);
    expect(loadSave().equippedCastleSkinId).toBe("FROST_CITADEL");
    expect(loadSave().freeGems).toBe(5000 - 900);
    expect(equipCastleSkin(null).ok).toBe(true);
    expect(loadSave().equippedCastleSkinId).toBeNull();
  });
});
