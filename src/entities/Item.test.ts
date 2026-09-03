import { describe, expect, it } from "vitest";
import { createItemInstance } from "./Item";

describe("createItemInstance", () => {
  it("generates a unique instanceId per call, even for the same definition/owner", () => {
    const a = createItemInstance("warden_fragment", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    const b = createItemInstance("warden_fragment", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    expect(a.instanceId).not.toBe(b.instanceId);
  });

  it("stamps tradable from the item definition (soulbound example: warden_fragment)", () => {
    const item = createItemInstance("warden_fragment", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    expect(item.tradable).toBe(false);
  });

  it("stamps tradable=true for a tradable definition (mosswood_charm)", () => {
    const item = createItemInstance("mosswood_charm", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    expect(item.tradable).toBe(true);
  });

  it("records an ACQUIRED history entry with the owner as the very first event", () => {
    const item = createItemInstance("ancient_core", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" }, 5000);
    expect(item.history).toEqual([{ timestamp: 5000, event: "ACQUIRED", fromOwner: null, toOwner: "player-1" }]);
  });

  it("starts with pendingTrade=false", () => {
    const item = createItemInstance("hollow_sigil", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    expect(item.pendingTrade).toBe(false);
  });

  it("falls back to tradable=false for an unknown definition id rather than throwing", () => {
    const item = createItemInstance("does_not_exist", "player-1", { type: "BOSS_DROP", refId: "hollow-warden" });
    expect(item.tradable).toBe(false);
  });
});
