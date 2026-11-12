import { dualGemPrice, type DualGemPrice } from "./gemsEconomy";
import { getTowerSkinDualPrice, TOWER_SKINS } from "./towerSkins";
import { NO_ESSENCES, type Essences } from "./expeditions";

/**
 * LOJA DIÁRIA, OFERTAS DE MOMENTO E VIP.
 *
 *  - Loja diária: four offers for Gems that change every day at the same
 *    moment for everyone (UTC day). Each can be bought once that day. What it
 *    sells is shown in full: a tower skin on sale, and Forge materials. Never
 *    a random box, and never Legendary or Mythic Essences — those only come
 *    from playing, so the top items keep their value.
 *  - Ofertas de momento: real-money bundles that show up at the moments a
 *    player most wants help (the castle fell, a boss held the wall). They last
 *    a few hours. Like every real-money purchase, they are for 18+ only and
 *    stay "coming soon" until payments open.
 *  - VIP: a monthly subscription (real money, same rules). Convenience and
 *    status only: one more scout group, a daily Gem gift you collect by
 *    entering the game. No damage, no Season edge.
 */

// ── daily shop ──────────────────────────────────────────────────────────
export type DailyOfferKind = "SKIN" | "SPLINTERS" | "RARE_ESSENCE" | "EPIC_ESSENCE";

export interface DailyOffer {
  id: string;
  kind: DailyOfferKind;
  price: DualGemPrice;
  /** SKIN */
  skinId?: string;
  /** Percent off the skin's normal price. */
  discountPct?: number;
  splinters?: number;
  essences?: Essences;
}

/** Day number in UTC — the shop turns over at the same moment for everyone. */
export function shopDay(nowMs: number): number {
  return Math.floor(nowMs / 86_400_000);
}

function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const DAILY_SKIN_DISCOUNT_PCT = 25;

/** The day's four offers — identical for every player that day. */
export function dailyOffers(day: number): DailyOffer[] {
  const r = rng(day + 101);
  const skin = TOWER_SKINS[Math.floor(r() * TOWER_SKINS.length)]!;
  const base = getTowerSkinDualPrice(skin).purchased;
  const discounted = Math.round((base * (100 - DAILY_SKIN_DISCOUNT_PCT)) / 100);
  const splinters = [40, 60, 80][Math.floor(r() * 3)]!;
  return [
    { id: `d${day}-skin`, kind: "SKIN", skinId: skin.id, discountPct: DAILY_SKIN_DISCOUNT_PCT, price: dualGemPrice(discounted) },
    { id: `d${day}-spl`, kind: "SPLINTERS", splinters, price: dualGemPrice(Math.round(splinters * 0.75)) },
    { id: `d${day}-rare`, kind: "RARE_ESSENCE", essences: { ...NO_ESSENCES, RARE: 10 }, price: dualGemPrice(50) },
    { id: `d${day}-epic`, kind: "EPIC_ESSENCE", essences: { ...NO_ESSENCES, EPIC: 3 }, price: dualGemPrice(90) },
  ];
}

export interface DailyShopState {
  day: number;
  bought: string[];
}

export function createDailyShopState(): DailyShopState {
  return { day: 0, bought: [] };
}

export function sanitizeDailyShopState(raw: unknown): DailyShopState {
  if (!raw || typeof raw !== "object") return createDailyShopState();
  const r = raw as Record<string, unknown>;
  return {
    day: typeof r.day === "number" && Number.isFinite(r.day) ? Math.max(0, Math.floor(r.day)) : 0,
    bought: Array.isArray(r.bought) ? r.bought.filter((x): x is string => typeof x === "string").slice(0, 20) : [],
  };
}

/** The shop state for today (a new day forgets yesterday's purchases). */
export function dailyShopFor(state: DailyShopState, nowMs: number): DailyShopState {
  const day = shopDay(nowMs);
  return state.day === day ? state : { day, bought: [] };
}

// ── moment offers (real money) ─────────────────────────────────────────
export type MomentTrigger = "CASTLE_FELL" | "BOSS_HELD" | "NEW_DEPTH";

export interface MomentOffer {
  id: string;
  trigger: MomentTrigger;
  priceBrl: number;
  /** What it gives, all shown up front. */
  purchasedGems: number;
  splinters: number;
  essences: Essences;
  /** Hours it stays available after showing up. */
  hours: number;
}

export const MOMENT_OFFERS: readonly MomentOffer[] = [
  { id: "MOMENT_REBUILD", trigger: "CASTLE_FELL", priceBrl: 9.9, purchasedGems: 220, splinters: 60, essences: { ...NO_ESSENCES, RARE: 10 }, hours: 6 },
  { id: "MOMENT_BOSS", trigger: "BOSS_HELD", priceBrl: 24.9, purchasedGems: 600, splinters: 120, essences: { ...NO_ESSENCES, RARE: 15, EPIC: 6 }, hours: 6 },
  { id: "MOMENT_DEPTH", trigger: "NEW_DEPTH", priceBrl: 49.9, purchasedGems: 1300, splinters: 250, essences: { ...NO_ESSENCES, RARE: 25, EPIC: 12 }, hours: 12 },
];

export interface ActiveMomentOffer {
  id: string;
  expiresAt: number;
}

/** A moment offer won't show again for this long after it last appeared. */
export const MOMENT_COOLDOWN_MS = 24 * 3_600_000;

export interface MomentOfferState {
  active: ActiveMomentOffer | null;
  /** Last time each offer appeared. */
  lastShown: Record<string, number>;
}

export function createMomentOfferState(): MomentOfferState {
  return { active: null, lastShown: {} };
}

export function sanitizeMomentOfferState(raw: unknown): MomentOfferState {
  if (!raw || typeof raw !== "object") return createMomentOfferState();
  const r = raw as Record<string, unknown>;
  const a = r.active as Record<string, unknown> | null | undefined;
  const active = a && typeof a.id === "string" && MOMENT_OFFERS.some((o) => o.id === a.id) && typeof a.expiresAt === "number" ? { id: a.id, expiresAt: a.expiresAt } : null;
  const lastShown: Record<string, number> = {};
  if (r.lastShown && typeof r.lastShown === "object") for (const [k, v] of Object.entries(r.lastShown as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v)) lastShown[k] = v;
  return { active, lastShown };
}

/** Shows the offer for `trigger` if none is on screen and it hasn't shown in the last day. */
export function triggerMomentOffer(state: MomentOfferState, trigger: MomentTrigger, nowMs: number): MomentOfferState {
  if (state.active && state.active.expiresAt > nowMs) return state;
  const offer = MOMENT_OFFERS.find((o) => o.trigger === trigger);
  if (!offer) return state;
  if (nowMs - (state.lastShown[offer.id] ?? -Infinity) < MOMENT_COOLDOWN_MS) return state;
  return { active: { id: offer.id, expiresAt: nowMs + offer.hours * 3_600_000 }, lastShown: { ...state.lastShown, [offer.id]: nowMs } };
}

export function activeMomentOffer(state: MomentOfferState, nowMs: number): { offer: MomentOffer; expiresAt: number } | null {
  if (!state.active || state.active.expiresAt <= nowMs) return null;
  const offer = MOMENT_OFFERS.find((o) => o.id === state.active!.id);
  return offer ? { offer, expiresAt: state.active.expiresAt } : null;
}

// ── VIP (real money) ───────────────────────────────────────────────────
export const VIP_PRICE_BRL = 14.9;
export const VIP_DAYS = 30;
/** Purchased Gems collected each day the player enters the game while VIP. */
export const VIP_DAILY_GEMS = 20;
export const VIP_EXTRA_SCOUT_GROUPS = 1;

export interface VipState {
  /** End of the paid period (ms). 0 = never subscribed. */
  until: number;
  /** Last UTC day the daily VIP Gems were collected. */
  lastGiftDay: number;
}

export function createVipState(): VipState {
  return { until: 0, lastGiftDay: -1 };
}

export function sanitizeVipState(raw: unknown): VipState {
  if (!raw || typeof raw !== "object") return createVipState();
  const r = raw as Record<string, unknown>;
  return {
    until: typeof r.until === "number" && Number.isFinite(r.until) ? Math.max(0, r.until) : 0,
    lastGiftDay: typeof r.lastGiftDay === "number" && Number.isFinite(r.lastGiftDay) ? Math.floor(r.lastGiftDay) : -1,
  };
}

export function isVipActive(vip: VipState, nowMs: number): boolean {
  return vip.until > nowMs;
}

export function vipGiftAvailable(vip: VipState, nowMs: number): boolean {
  return isVipActive(vip, nowMs) && vip.lastGiftDay !== shopDay(nowMs);
}
