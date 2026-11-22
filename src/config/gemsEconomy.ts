/**
 * GEMS ECONOMY v2 — DUAL CURRENCY. HORDENOVA's single `gems` balance is
 * split into two real, separately-tracked currencies (see SaveData.freeGems/
 * purchasedGems in engine/SaveSystem.ts):
 *
 *   🔒 FREE GEMS — earned exclusively through gameplay (Gem Shard/Fragment
 *   conversion, Roulette, Prestige-milestone/Ascension/Season rewards).
 *   Valid for every system below.
 *
 *   💎 PURCHASED GEMS — bought from a real-money store (not yet built in
 *   this local client — see GameEngine.ts's own note on where that IAP
 *   entry point would plug in). Valid for every system below, PLUS
 *   BUYING on the Marketplace (config/marketplace.ts), which is
 *   Purchased-Gems-ONLY — Free Gems must never buy another player's
 *   tradeable item, or the gameplay economy would leak directly into the
 *   player-to-player one. LISTING an item you own (the seller side) has no
 *   such restriction — a pure F2P player can list and sell using nothing
 *   but Free Gems for the listing fee, and receives Purchased Gems from the
 *   sale regardless of which currency paid for their Trade Unlock.
 *
 * NEVER: a system that auto-picks a currency, blends the two into one
 * payment, or converts one into the other. Every dual-priced action always
 * exposes BOTH prices and lets the player explicitly choose.
 *
 * PRICING METHODOLOGY (the "audit" this file's constants come from): every
 * Gems cost in this codebase (Specialization unlock/change, Prestige,
 * Repositioning, Item Slot unlock, Tower Skins) already went through a
 * dedicated economy simulation pass in an earlier phase — see each config
 * file's own header (real Gem Shard income rates, P1-P100 Prestige pacing
 * targets, the skin price band derived from the existing spending curve).
 * Re-deriving every one of those curves from scratch here would silently
 * invalidate that prior, already-validated pacing work. Instead:
 *
 *   PURCHASED GEMS price = the EXACT pre-existing (already-audited) cost.
 *   A paying player's pace is untouched by this migration — nothing got
 *   quietly more expensive for them.
 *
 *   FREE GEMS price = PURCHASED price x FREE_GEMS_PRICE_MULTIPLIER (1.5x).
 *   This is not an arbitrary pick: it's the exact ratio the user's own
 *   worked Skin example fixes (1,200 Free / 800 Purchased = 1.5x), applied
 *   uniformly so every system reads the same "effort premium" — a free
 *   player pays 50% more, in the SAME currency shape they already earn, for
 *   the SAME thing a payer gets faster. Never impossible, never a rounding
 *   error away from the payer's price.
 */

export type GemCurrency = "FREE" | "PURCHASED";

export interface DualGemPrice {
  /** 🔒 Free Gems price — PURCHASED price x FREE_GEMS_PRICE_MULTIPLIER, rounded. */
  free: number;
  /** 💎 Purchased Gems price — the real, pre-existing, already-audited cost. */
  purchased: number;
}

/** The one ratio every dual-priced system in this file derives its Free price from — see this file's own header for why 1.5x, not an arbitrary pick. */
export const FREE_GEMS_PRICE_MULTIPLIER = 1.5;

/** Derives a `{free, purchased}` pair from an existing, already-audited Purchased-Gems cost. `purchased` is passed through completely unchanged. */
export function dualGemPrice(purchasedPrice: number): DualGemPrice {
  return { free: Math.round(purchasedPrice * FREE_GEMS_PRICE_MULTIPLIER), purchased: purchasedPrice };
}

/** Reads the one price that matters for a given `currency` choice — the single place "which number do I charge" is decided, so no call site ever hand-rolls the free/purchased branch differently. */
export function gemPriceForCurrency(price: DualGemPrice, currency: GemCurrency): number {
  return currency === "FREE" ? price.free : price.purchased;
}

