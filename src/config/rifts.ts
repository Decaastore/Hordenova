import type { EnemyType } from "./enemyStats";

/**
 * FENDAS — an optional, harder wave you choose to take on for better loot,
 * like Path of Exile's maps or Diablo's Nightmare Dungeons.
 *
 *  - You earn one Rift charge every 10 waves cleared (at each fase
 *    checkpoint), holding at most MAX_RIFT_CHARGES.
 *  - Opening a Rift spends a charge and turns your NEXT regular wave into a
 *    Rift wave (never a boss or mini-boss wave — those wait for the next
 *    regular one). You pick its curses: each one makes that wave harder and
 *    adds its percentage to the reward.
 *  - Clear the wave and the Rift pays out (Gem Shards, Gold and item rolls
 *    from the drop table shown in the panel), dropped by the castle. If the
 *    castle falls during it, the Rift is lost.
 *
 * Same rules for everyone — nothing here depends on who is playing.
 */
export type RiftModId = "HASTE" | "TOUGH" | "HORDE" | "FRAGILE";

export interface RiftModDefinition {
  id: RiftModId;
  /** Extra reward this curse adds, in percent. */
  rewardPct: number;
}

export const RIFT_MODS: readonly RiftModDefinition[] = [
  { id: "HASTE", rewardPct: 25 },
  { id: "TOUGH", rewardPct: 35 },
  { id: "HORDE", rewardPct: 40 },
  { id: "FRAGILE", rewardPct: 30 },
];

/** HASTE: enemies move this much faster. */
export const RIFT_HASTE_SPEED = 1.25;
/** TOUGH: enemies have this much more life. */
export const RIFT_TOUGH_HP = 1.5;
/** HORDE: this many more enemies come in the wave. */
export const RIFT_HORDE_EXTRA = 0.5;
/** FRAGILE: each enemy that reaches the castle does this many times the damage. */
export const RIFT_FRAGILE_BREACH = 2;

export const MAX_RIFT_CHARGES = 3;
/** A charge is earned every this many waves cleared. */
export const RIFT_CHARGE_EVERY = 10;

/** Base reward of a cleared Rift with no curses. */
export const RIFT_BASE_SHARDS = 3;
/** Share of the Rift wave's own kill Gold paid again as a bonus, before curses. */
export const RIFT_BASE_GOLD_SHARE = 0.5;
/** The drop table Rift item rolls use (shown in the panel). */
export const RIFT_DROP_TABLE_ID = "rift";

export interface RiftState {
  charges: number;
  /** Curses chosen for the next eligible wave, or null when no Rift is opened. */
  armed: RiftModId[] | null;
  /** The Rift wave being fought right now. */
  active: { wave: number; mods: RiftModId[] } | null;
}

export function createRiftState(): RiftState {
  return { charges: 0, armed: null, active: null };
}

const MOD_IDS = new Set<string>(RIFT_MODS.map((m) => m.id));

function sanitizeMods(raw: unknown): RiftModId[] | null {
  if (!Array.isArray(raw)) return null;
  const mods = [...new Set(raw.filter((m): m is RiftModId => typeof m === "string" && MOD_IDS.has(m)))];
  return mods;
}

export function sanitizeRiftState(raw: unknown): RiftState {
  if (!raw || typeof raw !== "object") return createRiftState();
  const r = raw as Record<string, unknown>;
  const charges = typeof r.charges === "number" && Number.isFinite(r.charges) ? Math.max(0, Math.min(MAX_RIFT_CHARGES, Math.floor(r.charges))) : 0;
  const armed = r.armed === null || r.armed === undefined ? null : sanitizeMods(r.armed);
  const a = r.active as Record<string, unknown> | null | undefined;
  const active =
    a && typeof a === "object" && typeof a.wave === "number" && Number.isFinite(a.wave) ? { wave: Math.floor(a.wave), mods: sanitizeMods(a.mods) ?? [] } : null;
  return { charges, armed, active };
}

/** Total extra reward of a set of curses, in percent. */
export function riftRewardPct(mods: readonly RiftModId[]): number {
  return RIFT_MODS.filter((m) => mods.includes(m.id)).reduce((sum, m) => sum + m.rewardPct, 0);
}

export interface RiftReward {
  shards: number;
  gold: number;
  itemRolls: number;
}

/** What a cleared Rift pays, given its curses and the Gold its wave's kills gave. */
export function riftReward(mods: readonly RiftModId[], waveKillGold: number): RiftReward {
  const k = 1 + riftRewardPct(mods) / 100;
  const pct = riftRewardPct(mods);
  return {
    shards: Math.round(RIFT_BASE_SHARDS * k),
    gold: Math.round(waveKillGold * RIFT_BASE_GOLD_SHARE * k),
    itemRolls: 1 + (pct >= 100 ? 1 : 0),
  };
}

/** Adds the HORDE curse's extra enemies to a wave's spawn list (copies spread through the wave). */
export function withHordeExtra(queue: readonly EnemyType[]): EnemyType[] {
  const extra = Math.round(queue.length * RIFT_HORDE_EXTRA);
  const out = [...queue];
  for (let i = 0; i < extra; i++) {
    const src = queue[Math.floor((i * queue.length) / Math.max(1, extra))]!;
    out.splice(Math.min(out.length, 2 + i * 3), 0, src);
  }
  return out;
}

/** Adds a charge when a wave on a checkpoint boundary is cleared. */
export function chargeAfterWave(state: RiftState, wave: number): RiftState {
  if (wave <= 0 || wave % RIFT_CHARGE_EVERY !== 0) return state;
  return { ...state, charges: Math.min(MAX_RIFT_CHARGES, state.charges + 1) };
}
