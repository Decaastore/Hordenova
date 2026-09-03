import { describe, expect, it } from "vitest";
import { checkLocalFirst } from "./WorldFirst";

describe("WorldFirst — checkLocalFirst (LOCAL first, not a global claim, see file header)", () => {
  it("returns a record the first time this save ever sees a definition", () => {
    const record = checkLocalFirst({}, "crown_of_the_hollow_king", "item-1", "player-1", 12345);
    expect(record).toEqual({ itemDefinitionId: "crown_of_the_hollow_king", instanceId: "item-1", playerId: "player-1", obtainedAt: 12345 });
  });

  it("returns null once that definition already has a recorded first", () => {
    const existing = { crown_of_the_hollow_king: { itemDefinitionId: "crown_of_the_hollow_king", instanceId: "item-1", playerId: "player-1", obtainedAt: 100 } };
    expect(checkLocalFirst(existing, "crown_of_the_hollow_king", "item-2", "player-1", 200)).toBeNull();
  });

  it("is per-definition — a first for one item doesn't block a first for another", () => {
    const existing = { warden_fragment: { itemDefinitionId: "warden_fragment", instanceId: "item-1", playerId: "player-1", obtainedAt: 100 } };
    const record = checkLocalFirst(existing, "crown_of_the_hollow_king", "item-2", "player-1", 200);
    expect(record).not.toBeNull();
  });
});
