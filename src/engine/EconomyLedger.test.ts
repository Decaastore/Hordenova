import { beforeEach, describe, expect, it } from "vitest";
import { appendLedgerEvent, getItemHistory, getLedgerEvents } from "./EconomyLedger";

describe("EconomyLedger", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("appends events and returns them in write order via getLedgerEvents", () => {
    appendLedgerEvent({ eventType: "ITEM_CREATED", itemInstanceId: "i1", itemDefinitionId: "warden_fragment", fromOwner: null, toOwner: "p1", source: "hollow-warden" }, 100);
    appendLedgerEvent({ eventType: "ITEM_ACQUIRED", itemInstanceId: "i1", itemDefinitionId: "warden_fragment", fromOwner: null, toOwner: "p1", source: "hollow-warden" }, 200);

    const events = getLedgerEvents();
    expect(events).toHaveLength(2);
    expect(events[0]!.eventType).toBe("ITEM_CREATED");
    expect(events[1]!.eventType).toBe("ITEM_ACQUIRED");
  });

  it("assigns each event a unique eventId", () => {
    const a = appendLedgerEvent({ eventType: "ITEM_CREATED", itemInstanceId: "i1", itemDefinitionId: "d", fromOwner: null, toOwner: "p1", source: "s" });
    const b = appendLedgerEvent({ eventType: "ITEM_CREATED", itemInstanceId: "i2", itemDefinitionId: "d", fromOwner: null, toOwner: "p1", source: "s" });
    expect(a.eventId).not.toBe(b.eventId);
  });

  it("getItemHistory filters to one instance and sorts oldest first", () => {
    appendLedgerEvent({ eventType: "ITEM_CREATED", itemInstanceId: "i1", itemDefinitionId: "d", fromOwner: null, toOwner: "p1", source: "s" }, 500);
    appendLedgerEvent({ eventType: "ITEM_CREATED", itemInstanceId: "i2", itemDefinitionId: "d", fromOwner: null, toOwner: "p1", source: "s" }, 100);
    appendLedgerEvent({ eventType: "ITEM_TRADED", itemInstanceId: "i1", itemDefinitionId: "d", fromOwner: "p1", toOwner: "p2", source: "trade:x" }, 900);

    const history = getItemHistory("i1");
    expect(history.map((e) => e.eventType)).toEqual(["ITEM_CREATED", "ITEM_TRADED"]);
    expect(history[0]!.timestamp).toBeLessThan(history[1]!.timestamp);
  });

  it("survives corrupted JSON in the ledger's storage key instead of throwing", () => {
    window.localStorage.setItem("hordenova.ledger.v1", "{not json");
    expect(getLedgerEvents()).toEqual([]);
  });

  it("caps stored events at 500, dropping the oldest first", () => {
    for (let i = 0; i < 505; i++) {
      appendLedgerEvent({ eventType: "ITEM_CREATED", itemInstanceId: `i${i}`, itemDefinitionId: "d", fromOwner: null, toOwner: "p1", source: "s" }, i);
    }
    const events = getLedgerEvents();
    expect(events).toHaveLength(500);
    // The first 5 (oldest) were trimmed — event i0..i4 should be gone, i5 should be the oldest survivor.
    expect(events[0]!.itemInstanceId).toBe("i5");
    expect(events[events.length - 1]!.itemInstanceId).toBe("i504");
  });
});
