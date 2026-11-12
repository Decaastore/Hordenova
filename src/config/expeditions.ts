import { PHASES } from "./phaseConfig";
import { ITEM_DEFINITIONS, type ItemId } from "./itemDefinitions";
import { dualGemPrice, type DualGemPrice } from "./gemsEconomy";
import type { Rarity } from "./rarity";

/**
 * EXPEDIÇÕES E FORJA — the waiting rewards that replace chests. Nothing here
 * is luck you pay for: an expedition shows its exact prize before it leaves,
 * and the Forge shows the exact materials and time of the item you choose.
 * What can be bought is time (finish now) and room (more scout groups),
 * never a better chance.
 *
 *  - Regions are the game's phases. A region opens once your record has
 *    gone past it, and deeper regions pay more.
 *  - Durations are 1h, 4h, 8h and 24h; longer pays more per trip. Gold is
 *    kept to a few waves' worth so trips help without rushing the slow pace.
 *  - Bosses, Rifts and expeditions give Forge materials: Splinters and
 *    Essences by rarity. The top items stay rare because their Essences only
 *    come from the deepest, longest trips.
 *
 * Same rules for everyone.
 */

// ── regions ─────────────────────────────────────────────────────────────
export interface ExpeditionRegion {
  /** PHASES index. */
  index: number;
  i18nKey: string;
  /** Record needed: the wave after the region ends. */
  unlockWave: number;
  /** 1..4 — how much the region pays. */
  tier: number;
}

export function expeditionRegions(): ExpeditionRegion[] {
  return PHASES.map((p, i) => ({
    index: i,
    i18nKey: p.i18nKey,
    unlockWave: PHASES[i + 1]?.startWave ?? p.startWave + 20,
    tier: Math.min(4, 1 + Math.floor(i / 3)),
  }));
}

export function unlockedRegions(record: number): ExpeditionRegion[] {
  return expeditionRegions().filter((r) => record >= r.unlockWave);
}

// ── durations and prizes ───────────────────────────────────────────────
export const EXPEDITION_HOURS = [1, 4, 8, 24] as const;
export type ExpeditionHours = (typeof EXPEDITION_HOURS)[number];

export type EssenceRarity = "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
export const ESSENCE_RARITIES: readonly EssenceRarity[] = ["RARE", "EPIC", "LEGENDARY", "MYTHIC"];
export type Essences = Record<EssenceRarity, number>;
export const NO_ESSENCES: Essences = { RARE: 0, EPIC: 0, LEGENDARY: 0, MYTHIC: 0 };

export interface ExpeditionPrize {
  gold: number;
  shards: number;
  splinters: number;
  essences: Essences;
}

/** The exact prize of a trip — shown before it leaves, paid as shown. */
export function expeditionPrize(tier: number, hours: ExpeditionHours): ExpeditionPrize {
  const t = Math.max(1, Math.min(4, Math.floor(tier)));
  switch (hours) {
    case 1:
      return { gold: 60 * t, shards: 0, splinters: 2 * t, essences: { ...NO_ESSENCES } };
    case 4:
      return { gold: 200 * t, shards: 1, splinters: 6 * t, essences: { ...NO_ESSENCES, RARE: t } };
    case 8:
      return { gold: 360 * t, shards: 2, splinters: 11 * t, essences: { ...NO_ESSENCES, RARE: 2 * t, EPIC: t - 1 } };
    case 24:
      return {
        gold: 900 * t,
        shards: 5,
        splinters: 30 * t,
        essences: { RARE: 5 * t, EPIC: 2 * t, LEGENDARY: t >= 3 ? t - 2 : 0, MYTHIC: t >= 4 ? 1 : 0 },
      };
  }
}

// ── scout groups ────────────────────────────────────────────────────────
export const BASE_SCOUT_GROUPS = 2;
export const MAX_SCOUT_GROUPS = 4;
/** Each extra group (3rd and 4th), permanent. */
export const EXTRA_GROUP_PRICE: DualGemPrice = dualGemPrice(300);

export interface Expedition {
  regionIndex: number;
  hours: ExpeditionHours;
  startedAt: number;
  endsAt: number;
}

/** Gems to finish something now, by the time left: 5 to 60 (1 Gem per 24 minutes). */
export function rushPrice(msLeft: number): DualGemPrice {
  const minutes = Math.max(0, msLeft) / 60_000;
  return dualGemPrice(Math.max(5, Math.min(60, Math.ceil(minutes / 24))));
}

// ── forge ───────────────────────────────────────────────────────────────
export interface ForgeRecipe {
  itemId: ItemId;
  splinters: number;
  essences: Essences;
  hours: number;
}

export const FORGE_RECIPES: readonly ForgeRecipe[] = [
  { itemId: "mosswood_charm", splinters: 20, essences: { ...NO_ESSENCES }, hours: 4 },
  { itemId: "ancient_core", splinters: 40, essences: { ...NO_ESSENCES, RARE: 6 }, hours: 8 },
  { itemId: "hollow_sigil", splinters: 120, essences: { ...NO_ESSENCES, RARE: 15, EPIC: 10 }, hours: 24 },
  { itemId: "wardens_eye", splinters: 300, essences: { ...NO_ESSENCES, EPIC: 25, LEGENDARY: 12 }, hours: 48 },
  { itemId: "crown_of_the_hollow_king", splinters: 800, essences: { ...NO_ESSENCES, LEGENDARY: 40, MYTHIC: 20 }, hours: 96 },
];

export function getRecipe(itemId: string): ForgeRecipe | null {
  return FORGE_RECIPES.find((r) => r.itemId === itemId) ?? null;
}

export function recipeRarity(r: ForgeRecipe): Rarity {
  return ITEM_DEFINITIONS[r.itemId].rarity;
}

/** Splinters a defeated boss leaves (mini-bosses 1, region bosses 5). */
export const BOSS_SPLINTERS = 5;
export const MINI_BOSS_SPLINTERS = 1;
/** A cleared Rift: Splinters plus one Rare Essence per curse. */
export const RIFT_SPLINTERS = 4;

// ── state ───────────────────────────────────────────────────────────────
export interface ExpeditionState {
  /** Scout groups owned (2 base, up to 4). */
  groups: number;
  active: Expedition[];
  splinters: number;
  essences: Essences;
  forging: { itemId: ItemId; endsAt: number } | null;
}

export function createExpeditionState(): ExpeditionState {
  return { groups: BASE_SCOUT_GROUPS, active: [], splinters: 0, essences: { ...NO_ESSENCES }, forging: null };
}

const int = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : d);

export function sanitizeExpeditionState(raw: unknown): ExpeditionState {
  if (!raw || typeof raw !== "object") return createExpeditionState();
  const r = raw as Record<string, unknown>;
  const groups = Math.max(BASE_SCOUT_GROUPS, Math.min(MAX_SCOUT_GROUPS, int(r.groups, BASE_SCOUT_GROUPS)));
  const regions = expeditionRegions().length;
  const active: Expedition[] = Array.isArray(r.active)
    ? (r.active as unknown[])
        .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
        .map((e) => ({ regionIndex: int(e.regionIndex), hours: int(e.hours) as ExpeditionHours, startedAt: int(e.startedAt), endsAt: int(e.endsAt) }))
        .filter((e) => e.regionIndex < regions && (EXPEDITION_HOURS as readonly number[]).includes(e.hours))
        .slice(0, MAX_SCOUT_GROUPS + 1) // +1: a VIP group's trip outlives the subscription
    : [];
  const ess = (r.essences && typeof r.essences === "object" ? r.essences : {}) as Record<string, unknown>;
  const f = r.forging as Record<string, unknown> | null | undefined;
  const forging = f && typeof f === "object" && typeof f.itemId === "string" && getRecipe(f.itemId) ? { itemId: f.itemId as ItemId, endsAt: int(f.endsAt) } : null;
  return {
    groups,
    active,
    splinters: int(r.splinters),
    essences: { RARE: int(ess.RARE), EPIC: int(ess.EPIC), LEGENDARY: int(ess.LEGENDARY), MYTHIC: int(ess.MYTHIC) },
    forging,
  };
}

export function canAffordRecipe(state: ExpeditionState, r: ForgeRecipe): boolean {
  return state.splinters >= r.splinters && ESSENCE_RARITIES.every((k) => state.essences[k] >= r.essences[k]);
}

export function addEssences(a: Essences, b: Essences, sign = 1): Essences {
  return { RARE: a.RARE + sign * b.RARE, EPIC: a.EPIC + sign * b.EPIC, LEGENDARY: a.LEGENDARY + sign * b.LEGENDARY, MYTHIC: a.MYTHIC + sign * b.MYTHIC };
}
