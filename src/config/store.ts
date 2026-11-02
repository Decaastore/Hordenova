/**
 * STORE — what the Loja page sells.
 *
 * GEM PACKS are bought with real money, which the game cannot take yet:
 * there is no payment provider connected. Until there is, the packs are
 * shown with their price and a "coming soon" state, and NOTHING here (or in
 * engine/StoreService.ts) ever grants Purchased Gems without a payment.
 * When payments go live, `REAL_MONEY_PAYMENTS_ENABLED` flips to true and
 * StoreService.requestGemPackPurchase is where the checkout starts; the
 * Gems themselves must be credited only after the provider confirms the
 * payment (GameEngine.addPurchasedGems / the save's purchasedGems).
 *
 * Pricing: about 20 Gems per R$ 1 on the smallest pack, with a growing
 * bonus on bigger packs — so the best-value packs reward commitment
 * without making the small ones feel like a rip-off. For reference, the
 * existing Gem prices: a tower skin is 120 / 350 / 800 Purchased Gems
 * (config/towerSkins.ts), a reposition 200 (config/repositioning.ts).
 */

export const REAL_MONEY_PAYMENTS_ENABLED = false;

export interface GemPack {
  id: string;
  /** Gems in the pack before the bonus. */
  gems: number;
  /** Extra Gems on top — shown as "+N bonus". */
  bonusGems: number;
  /** Price in Brazilian reais. */
  priceBrl: number;
  tag?: "POPULAR" | "BEST_VALUE";
}

export const GEM_PACKS: readonly GemPack[] = [
  { id: "GEMS_100", gems: 100, bonusGems: 0, priceBrl: 4.9 },
  { id: "GEMS_220", gems: 200, bonusGems: 20, priceBrl: 9.9 },
  { id: "GEMS_600", gems: 500, bonusGems: 100, priceBrl: 24.9 },
  { id: "GEMS_1300", gems: 1000, bonusGems: 300, priceBrl: 49.9, tag: "POPULAR" },
  { id: "GEMS_2800", gems: 2000, bonusGems: 800, priceBrl: 99.9 },
  { id: "GEMS_7500", gems: 5000, bonusGems: 2500, priceBrl: 249.9, tag: "BEST_VALUE" },
];

export function gemPackTotal(pack: GemPack): number {
  return pack.gems + pack.bonusGems;
}

/**
 * The store's daily gift: a few Free Gems, once per day, for opening the
 * store. Free Gems are the gameplay currency (never Purchased Gems), so this
 * can never be used to buy another player's item on the Marketplace.
 */
export const DAILY_GIFT_FREE_GEMS = 5;
