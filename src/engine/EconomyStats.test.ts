import { describe, expect, it } from "vitest";
import { getGlobalEconomyStats, getLocalItemStats } from "./EconomyStats";
import { createItemInstance } from "@/entities/Item";

describe("EconomyStats", () => {
  it("getGlobalEconomyStats is always unavailable in this local-only build — spec sections 18/21/33: never fabricate a global number", () => {
    expect(getGlobalEconomyStats()).toEqual({ available: false });
  });

  it("getLocalItemStats counts real owned copies from the actual inventory, not a guess", () => {
    const inventory = [
      createItemInstance("warden_fragment", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" }),
      createItemInstance("warden_fragment", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" }),
      createItemInstance("ancient_core", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" }),
    ];
    const stats = getLocalItemStats(inventory, {}, "warden_fragment");
    expect(stats.ownedCount).toBe(2);
    expect(stats.firstAcquiredAt).toBeNull();
  });

  it("getLocalItemStats reports firstAcquiredAt from localFirstDiscoveries when present", () => {
    const discoveries = { warden_fragment: { itemDefinitionId: "warden_fragment", instanceId: "i1", playerId: "p1", obtainedAt: 999 } };
    const stats = getLocalItemStats([], discoveries, "warden_fragment");
    expect(stats.ownedCount).toBe(0);
    expect(stats.firstAcquiredAt).toBe(999);
  });
});
