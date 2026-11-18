import { dualGemPrice, type DualGemPrice } from "./gemsEconomy";

/**
 * INVENTORY EXPANSION — the Gem sink gemSinks.ts reserved as
 * `inventory_expansion`. Pure CONVENIENCE: more room to keep items, never
 * any combat or drop advantage (an item that arrives at a full bag already
 * waits in the overflow area, never lost — this only saves the shuffling).
 *
 * Each purchase adds INVENTORY_EXPANSION_SLOTS slots, up to
 * MAX_INVENTORY_EXPANSIONS purchases. The price climbs with every purchase
 * already made; Free Gems pay the usual 1.5x (gemsEconomy.ts).
 */
export const INVENTORY_EXPANSION_SLOTS = 10;
export const MAX_INVENTORY_EXPANSIONS = 10;
export const INVENTORY_EXPANSION_BASE_PRICE = 100;
export const INVENTORY_EXPANSION_PRICE_STEP = 50;

/** The price of the next expansion after `bought` purchases, or null when the cap is reached. */
export function getInventoryExpansionPrice(bought: number): DualGemPrice | null {
  if (!Number.isFinite(bought) || bought < 0 || bought >= MAX_INVENTORY_EXPANSIONS) return null;
  return dualGemPrice(INVENTORY_EXPANSION_BASE_PRICE + INVENTORY_EXPANSION_PRICE_STEP * Math.floor(bought));
}

export function sanitizeInventoryExpansions(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.min(MAX_INVENTORY_EXPANSIONS, Math.floor(raw)) : 0;
}
