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
 *   entry point would plug in). Valid for every system below, PLUS the
 *   Marketplace (config/marketplace.ts), which is Purchased-Gems-ONLY —
 *   Free Gems must never buy another player's tradeable item, or the
 *   gameplay economy would leak directly into the player-to-player one.
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
 *
 * The one deliberate exception is Trade Unlock, which the spec fixes at an
 * explicit flat 500/500 (see TRADE_UNLOCK_PRICE below) — unlocking Trading
 * itself is not a "buy power faster" decision, so it carries no premium
 * either way.
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

/**
 * TRADE UNLOCK — the one gate before the Marketplace (config/marketplace.ts)
 * becomes usable at all (listing OR bidding). Fixed at an explicit flat
 * 500 Free OR 500 Purchased Gems (spec's own exact numbers) — deliberately
 * NOT run through FREE_GEMS_PRICE_MULTIPLIER, since unlocking access isn't a
 * "power now vs. later" decision the effort-premium logic applies to.
 * Spending EITHER currency here only unlocks Trading — it never converts
 * currency, and Marketplace PURCHASES remain Purchased-Gems-only regardless
 * of which currency paid for this unlock (see GameEngine/MarketplaceService's
 * own "no conversion" contracts).
 */
export const TRADE_UNLOCK_PRICE: DualGemPrice = { free: 500, purchased: 500 };
