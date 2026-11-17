import type { TowerType } from "./towerStats";
import { dualGemPrice, type DualGemPrice } from "./gemsEconomy";

/**
 * TORRES DE FUSÃO — two towers of different elements standing close together
 * can be fused into one. The fused tower keeps the first tower's body,
 * level, specialization and attack, and takes on the second tower's element
 * on every hit (its burn, its chill, its chain of lightning or its critical
 * shot), plus a damage bonus. The second tower is not lost: it rides inside
 * the fused one (still counting towards the map and per-type limits, so a
 * fusion never means more towers) and can be split back out, for free, onto
 * any free build site.
 */

/** Both towers must be at least this level before they can fuse. */
export const FUSION_MIN_LEVEL = 10;
/** The two towers must stand at most this far apart (world units). */
export const FUSION_MAX_DISTANCE = 210;
/** The fused tower hits this much harder than the tower it was built from. */
export const FUSION_DAMAGE_MULT = 1.5;

/** Strength of the absorbed element's effect on the fused tower's hits (fraction of that tower's own special at its level). */
export const FUSION_BURN_SHARE = 0.6;
export const FUSION_SLOW_SHARE = 0.7;
export const FUSION_CRIT_SHARE = 0.7;
/** How many extra enemies the absorbed lightning jumps to, and the damage each jump keeps. */
export const FUSION_CHAIN_TARGETS = 2;
export const FUSION_CHAIN_FALLOFF = 0.55;

/** Gold to fuse two towers — a real late-game sink, growing with both levels. */
export function getFusionCost(levelA: number, levelB: number): number {
  return 2000 + 150 * (levelA + levelB);
}

/**
 * The same fusion paid in gems instead of gold — the player's choice. Free
 * gems cost 1.5× the purchased price (the usual dual price); capped so a
 * late fusion never turns into a gem wall.
 */
export const FUSION_GEM_PRICE_CAP = 600;
export function getFusionGemPrice(levelA: number, levelB: number): DualGemPrice {
  return dualGemPrice(Math.min(FUSION_GEM_PRICE_CAP, 200 + 5 * (levelA + levelB)));
}

/** How a fusion is paid: gold, or one of the two gem balances. */
export type FusionPayment = "GOLD" | "FREE" | "PURCHASED";

export type FusionId = "STEAM" | "PLASMA" | "HAIL" | "FIRE_ARROWS" | "FROST_ARROWS" | "THUNDER_ARROWS";

/** Which fusion two elements make (order doesn't matter), or null for the same element twice. */
export function getFusionId(a: TowerType, b: TowerType): FusionId | null {
  if (a === b) return null;
  const has = (t: TowerType) => a === t || b === t;
  if (has("INFERNO") && has("FROSTBORN")) return "STEAM";
  if (has("INFERNO") && has("STORMCALLER")) return "PLASMA";
  if (has("FROSTBORN") && has("STORMCALLER")) return "HAIL";
  if (has("IRONWOOD") && has("INFERNO")) return "FIRE_ARROWS";
  if (has("IRONWOOD") && has("FROSTBORN")) return "FROST_ARROWS";
  return "THUNDER_ARROWS";
}

/** The two colours of each fusion, for its aura, its link and its shots. */
export const FUSION_COLORS: Record<FusionId, [string, string]> = {
  STEAM: ["#ff7a2a", "#9ae6ff"],
  PLASMA: ["#ff5a2a", "#c49bff"],
  HAIL: ["#9ae6ff", "#c49bff"],
  FIRE_ARROWS: ["#ffd27a", "#ff6a1a"],
  FROST_ARROWS: ["#ffd27a", "#9ae6ff"],
  THUNDER_ARROWS: ["#ffd27a", "#c49bff"],
};

export const ELEMENT_COLOR: Record<TowerType, string> = {
  IRONWOOD: "#ffd27a",
  INFERNO: "#ff7a2a",
  FROSTBORN: "#9ae6ff",
  STORMCALLER: "#c49bff",
};
