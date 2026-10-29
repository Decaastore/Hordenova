import { describe, expect, it } from "vitest";
import { loadSave, type SaveData } from "@/engine/SaveSystem";
import { buildProfileFromSave, countOwnedSkins, defaultDisplayName, parsePublicProfile, sanitizeDisplayName } from "./playerProfile";
import { HttpProfileService, LocalProfileService } from "./profileService";

function sampleSave(): SaveData {
  const save = loadSave("hordenova.test.profile");
  save.playerId = "player-abc123";
  save.seasonBestWave = 47;
  save.bestWave = 90;
  save.prestigeLevel = 12;
  save.towerLoadout = [
    { slotId: "slot-1", type: "IRONWOOD", level: 20, specializationId: "IRONWOOD_EXECUTIONER", specializationLevel: 3, equippedSkinId: "IRONWOOD_ARCANE_ENGINE", masteryLevel: 0, equippedItemInstanceIds: ["it-1", null, null] },
    { slotId: "slot-2", type: "IRONWOOD", level: 8, specializationId: null, specializationLevel: 0, equippedSkinId: null, masteryLevel: 0, equippedItemInstanceIds: [null, null, null] },
    { slotId: "slot-3", type: "FROSTBORN", level: 31, specializationId: null, specializationLevel: 0, equippedSkinId: null, masteryLevel: 0, equippedItemInstanceIds: [] },
  ];
  save.inventory = [{ instanceId: "it-1", itemDefinitionId: "warden_fragment", ownerId: save.playerId, acquiredAt: 0, source: "DROP", tradable: true, pendingTrade: false, pendingAuction: false, history: [] } as never];
  save.ownedTowerSkinIds = ["IRONWOOD_ARCANE_ENGINE", "FROSTBORN_VOID_FROST", "NOT_A_REAL_SKIN"];
  save.masteryUnlocked = { IRONWOOD: true };
  save.towerMasteryLevels = { IRONWOOD: 5 };
  return save;
}

describe("buildProfileFromSave", () => {
  it("summarises every tower type with its best level, upgrades, items and owned skins", () => {
    const p = buildProfileFromSave(sampleSave(), "Deca", 1000);
    expect(p.displayName).toBe("Deca");
    expect(p.seasonBestWave).toBe(47);
    expect(p.towers).toHaveLength(4);
    const iron = p.towers.find((t) => t.type === "IRONWOOD")!;
    expect(iron).toMatchObject({
      placed: 2,
      bestLevel: 20,
      masteryUnlocked: true,
      masteryLevel: 5,
      specializationId: "IRONWOOD_EXECUTIONER",
      specializationLevel: 3,
      equippedSkinId: "IRONWOOD_ARCANE_ENGINE",
      ownedSkinIds: ["IRONWOOD_ARCANE_ENGINE"],
      equippedItemIds: ["warden_fragment"],
    });
    const frost = p.towers.find((t) => t.type === "FROSTBORN")!;
    expect(frost.bestLevel).toBe(31);
    expect(frost.ownedSkinIds).toEqual(["FROSTBORN_VOID_FROST"]);
    expect(p.towers.find((t) => t.type === "INFERNO")!.bestLevel).toBe(0);
    // Unknown skin ids never reach the public profile.
    expect(countOwnedSkins(p)).toBe(2);
  });

  it("never exposes private economy data", () => {
    const json = JSON.stringify(buildProfileFromSave(sampleSave(), "Deca"));
    for (const key of ["gold", "freeGems", "purchasedGems", "inventory", "auctionListings", "instanceId"]) expect(json).not.toContain(`"${key}"`);
  });
});

describe("parsePublicProfile", () => {
  it("rejects payloads without a player id", () => {
    expect(parsePublicProfile(null)).toBeNull();
    expect(parsePublicProfile({ displayName: "x" })).toBeNull();
  });

  it("clamps numbers and drops unknown towers, skins, specializations and items", () => {
    const p = parsePublicProfile({
      playerId: "p-1",
      displayName: "<b>Hacker</b>",
      seasonBestWave: -5,
      prestigeLevel: 1e30,
      towers: [
        { type: "IRONWOOD", bestLevel: 9999, specializationId: "FROSTBORN_SHATTER", ownedSkinIds: ["INFERNO_ASHEN_TYRANT", "IRONWOOD_CELESTIAL_WARDEN"], equippedItemIds: ["warden_fragment", "fake"] },
        { type: "DRAGON", bestLevel: 10 },
      ],
    })!;
    expect(p.displayName).toBe("bHacker/b");
    expect(p.seasonBestWave).toBe(0);
    expect(p.prestigeLevel).toBe(1_000_000_000);
    expect(p.towers.map((t) => t.type)).toEqual(["IRONWOOD", "INFERNO", "FROSTBORN", "STORMCALLER"]);
    const iron = p.towers[0]!;
    expect(iron.bestLevel).toBe(60);
    expect(iron.specializationId).toBeNull();
    expect(iron.ownedSkinIds).toEqual(["IRONWOOD_CELESTIAL_WARDEN"]);
    expect(iron.equippedItemIds).toEqual(["warden_fragment"]);
  });

  it("falls back to a readable default name", () => {
    expect(sanitizeDisplayName("  ", "player-xyz9")).toBe(defaultDisplayName("player-xyz9"));
    expect(defaultDisplayName("player-xyz9")).toBe("Defensor #XYZ9");
  });
});

describe("profile services", () => {
  it("offline, the leaderboard only ever contains the local player", async () => {
    const svc = new LocalProfileService();
    const rows = await svc.getLeaderboard();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.playerId).toBe(svc.getMyProfile().playerId);
    expect(await svc.getProfile("someone-else")).toBeNull();
  });

  it("online, fetches and sanitizes other players' profiles from the REST contract", async () => {
    const calls: string[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/leaderboard?limit=50")) return new Response(JSON.stringify({ entries: [{ rank: 1, playerId: "p-2", displayName: "Rival", seasonBestWave: 120, prestigeLevel: 40 }] }));
      if (url.endsWith("/profiles/p-2")) return new Response(JSON.stringify({ playerId: "p-2", displayName: "Rival", towers: [{ type: "INFERNO", bestLevel: 44 }] }));
      if (init?.method === "PUT") return new Response(null, { status: 204 });
      return new Response(null, { status: 404 });
    }) as typeof fetch;
    const svc = new HttpProfileService("https://api.example", fake);
    const rows = await svc.getLeaderboard(50);
    expect(rows[0]).toMatchObject({ rank: 1, playerId: "p-2", displayName: "Rival", seasonBestWave: 120 });
    const rival = await svc.getProfile("p-2");
    expect(rival!.towers.find((t) => t.type === "INFERNO")!.bestLevel).toBe(44);
    expect(await svc.getProfile("p-404")).toBeNull();
    await svc.publishMyProfile();
    expect(calls.some((c) => c.startsWith("PUT https://api.example/profiles/"))).toBe(true);
  });
});
