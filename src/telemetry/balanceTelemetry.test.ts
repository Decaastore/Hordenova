import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "@/engine/GameEngine";
import { updateSave } from "@/engine/SaveSystem";
import {
  flushBalanceEvents,
  pendingBalanceEvents,
  recordBalanceEvent,
  summarizeBalanceEvents,
  TELEMETRY_QUEUE_MAX,
  type BalanceEvent,
} from "./balanceTelemetry";

const defence = { towerCount: 1, towersByType: { IRONWOOD: 1 }, avgTowerLevel: 3, maxTowerLevel: 3, castleMaxHp: 100 };
const fell = (wave: number, at = wave): BalanceEvent => ({ type: "castle_fell", device: "d", at, mode: "main", wave, phase: 1, map: "ANCIENT_FOREST", boss: false, bossFallStreak: 0, restartedPhase: true, defence });

function runUntilStopped(engine: GameEngine): void {
  for (let i = 0; i < 20_000 && engine.getHudSnapshot().phase !== "PROGRESSION_STOPPED"; i++) engine.update(100);
}

describe("balance telemetry", () => {
  beforeEach(() => window.localStorage.clear());

  it("the real game screen's engine records where the castle fell — anonymous gameplay facts only", () => {
    updateSave({ currentWave: 37, bestWave: 37, towerLoadout: [], mapLayoutId: null, lastPlayedAt: null });
    const engine = new GameEngine();
    engine.enableTelemetry(true);
    engine.startRun();
    runUntilStopped(engine);

    const events = pendingBalanceEvents();
    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.type).toBe("castle_fell");
    expect(e.wave).toBe(engine.getFailureReport()!.waveReached);
    expect(e.phase).toBe(4);
    expect(e.map).toBe("VOLCANIC_WASTES");
    expect(e.mode).toBe("main");
    // nothing that identifies a person: no save player id, no display name
    const json = JSON.stringify(e);
    const playerId = engine.getPlayerId();
    if (playerId) expect(json).not.toContain(playerId);
    expect(Object.keys(e).sort()).toEqual(["at", "boss", "bossFallStreak", "defence", "device", "map", "mode", "phase", "restartedPhase", "type", "wave"].sort());
  });

  it("engines that don't opt in (tests, simulations, offline progress) record nothing", () => {
    updateSave({ currentWave: 37, bestWave: 37, towerLoadout: [], mapLayoutId: null, lastPlayedAt: null });
    const engine = new GameEngine();
    engine.startRun();
    runUntilStopped(engine);
    expect(pendingBalanceEvents()).toHaveLength(0);
  });

  it("the local queue is bounded", () => {
    for (let i = 0; i < TELEMETRY_QUEUE_MAX + 25; i++) recordBalanceEvent(fell(10, i));
    const q = pendingBalanceEvents();
    expect(q).toHaveLength(TELEMETRY_QUEUE_MAX);
    expect(q[0]!.at).toBe(25); // oldest dropped first
  });

  it("without a server URL nothing is sent; with one, a batch is posted and removed from the queue", async () => {
    recordBalanceEvent(fell(12));
    recordBalanceEvent(fell(13));
    const fetchImpl = vi.fn(async () => ({ ok: true }) as Response);
    expect(await flushBalanceEvents(fetchImpl as unknown as typeof fetch, null)).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();

    expect(await flushBalanceEvents(fetchImpl as unknown as typeof fetch, "https://example.test/telemetry")).toBe(2);
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.events).toHaveLength(2);
    expect(pendingBalanceEvents()).toHaveLength(0);
  });

  it("a failed send keeps the events for next time", async () => {
    recordBalanceEvent(fell(12));
    const failing = vi.fn(async () => ({ ok: false }) as Response);
    expect(await flushBalanceEvents(failing as unknown as typeof fetch, "https://example.test/telemetry")).toBe(0);
    expect(pendingBalanceEvents()).toHaveLength(1);
  });

  it("summarises the data the way balancing starts from", () => {
    const events: BalanceEvent[] = [fell(30), fell(30), fell(12), { type: "boss_defeated", device: "d", at: 1, mode: "main", wave: 30, phase: 3, map: "ANCIENT_FOREST", fallsBeforeWin: 2, defence }];
    const s = summarizeBalanceEvents(events);
    expect(s.fallsByWave).toEqual({ 30: 2, 12: 1 });
    expect(s.bossFallsBeforeWin).toEqual({ 30: 2 });
  });
});
