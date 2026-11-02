/**
 * BALANCE TELEMETRY — how competitive games tune difficulty: not per player
 * (every player faces the same waves, so a ranking stays fair), but for
 * everyone at once, from real data on where players actually get stuck.
 *
 * The game records a few anonymous gameplay facts — where the castle fell,
 * how many tries a boss took, what the defence looked like — and nothing
 * personal: no name, no e-mail, no account id, just a random id generated
 * on this device so repeated attempts can be told apart from many players.
 *
 * Today the game has no server, so events only queue up locally (bounded).
 * Setting the build variable VITE_TELEMETRY_URL (same pattern as the
 * Ranking's VITE_PROFILE_API_URL) turns on sending: batches are POSTed as
 *   POST {url}  { events: BalanceEvent[] }
 * and removed from the queue once the server answers 2xx.
 */
import type { TowerType } from "@/config/towerStats";

export interface DefenceSnapshot {
  towerCount: number;
  /** Towers per type, e.g. { IRONWOOD: 3, INFERNO: 2 }. */
  towersByType: Partial<Record<TowerType, number>>;
  avgTowerLevel: number;
  maxTowerLevel: number;
  castleMaxHp: number;
}

interface EventBase {
  /** Anonymous, random, per device. */
  device: string;
  at: number;
  /** "main" for the player's real save ("other" for any alternate save slot). */
  mode: string;
  wave: number;
  /** HUD phase number (10-wave blocks) and the map the wave was played on. */
  phase: number;
  map: string;
}

export type BalanceEvent =
  | (EventBase & { type: "castle_fell"; boss: boolean; bossFallStreak: number; restartedPhase: boolean; defence: DefenceSnapshot })
  | (EventBase & { type: "boss_defeated"; fallsBeforeWin: number; defence: DefenceSnapshot });

export const TELEMETRY_QUEUE_KEY = "hordenova.telemetry.queue.v1";
export const TELEMETRY_DEVICE_KEY = "hordenova.telemetry.device.v1";
/** Bounded so a game with no server never grows storage without limit. */
export const TELEMETRY_QUEUE_MAX = 300;
const SEND_BATCH = 50;

function readQueue(): BalanceEvent[] {
  try {
    const raw = window.localStorage.getItem(TELEMETRY_QUEUE_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? (v as BalanceEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: BalanceEvent[]): void {
  try {
    window.localStorage.setItem(TELEMETRY_QUEUE_KEY, JSON.stringify(events.slice(-TELEMETRY_QUEUE_MAX)));
  } catch {
    // storage full or blocked — telemetry is best-effort, never breaks the game
  }
}

export function deviceId(): string {
  try {
    let id = window.localStorage.getItem(TELEMETRY_DEVICE_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `d-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem(TELEMETRY_DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "unavailable";
  }
}

/** Adds one event to the local queue (oldest dropped past TELEMETRY_QUEUE_MAX). */
export function recordBalanceEvent(event: BalanceEvent): void {
  const queue = readQueue();
  queue.push(event);
  writeQueue(queue);
}

export function pendingBalanceEvents(): readonly BalanceEvent[] {
  return readQueue();
}

function endpoint(): string | null {
  try {
    const url = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_TELEMETRY_URL;
    return url && url.trim() ? url.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Sends queued events if a server is configured. Safe to call any time;
 * does nothing without VITE_TELEMETRY_URL. Returns how many were sent.
 */
export async function flushBalanceEvents(fetchImpl: typeof fetch = (...a) => fetch(...a), url: string | null = endpoint()): Promise<number> {
  if (!url) return 0;
  const queue = readQueue();
  if (queue.length === 0) return 0;
  const batch = queue.slice(0, SEND_BATCH);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (!res.ok) return 0;
    // drop exactly what was sent (new events may have arrived meanwhile)
    const sentKeys = new Set(batch.map((e) => `${e.at}|${e.type}|${e.wave}`));
    writeQueue(readQueue().filter((e) => !sentKeys.has(`${e.at}|${e.type}|${e.wave}`)));
    return batch.length;
  } catch {
    return 0;
  }
}

/**
 * Local summary — the kind of table the balancing work starts from: for
 * each wave, how often the castle fell there, and for each boss, the
 * average number of falls before it was beaten.
 */
export function summarizeBalanceEvents(events: readonly BalanceEvent[]): {
  fallsByWave: Record<number, number>;
  bossFallsBeforeWin: Record<number, number>;
} {
  const fallsByWave: Record<number, number> = {};
  const wins: Record<number, number[]> = {};
  for (const e of events) {
    if (e.type === "castle_fell") fallsByWave[e.wave] = (fallsByWave[e.wave] ?? 0) + 1;
    else (wins[e.wave] ??= []).push(e.fallsBeforeWin);
  }
  const bossFallsBeforeWin: Record<number, number> = {};
  for (const [wave, list] of Object.entries(wins)) bossFallsBeforeWin[Number(wave)] = list.reduce((a, b) => a + b, 0) / list.length;
  return { fallsByWave, bossFallsBeforeWin };
}
