import { STARTER_PACK_SKIN_ID, type RewardPart } from "./seasonPass";
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

/**
 * One-time starter offer (once per account), unlocked with real payments
 * like the packs above. Deliberately different from the gem packs and from
 * the Season Pass: Gems, a Premium tower skin, a Rare item and extra
 * inventory space, for the price of the 220-Gem pack — the first purchase
 * is the hardest one to earn.
 */
export const STARTER_PACK: { id: string; priceBrl: number; contents: readonly RewardPart[] } = {
  id: "STARTER",
  priceBrl: 9.9,
  contents: [
    { kind: "PURCHASED_GEMS", amount: 500 },
    { kind: "SKIN", skinId: STARTER_PACK_SKIN_ID },
    { kind: "ITEM", rarity: "RARE" },
    { kind: "INVENTORY_SLOTS", amount: 10 },
  ],
};

export function gemPackTotal(pack: GemPack): number {
  return pack.gems + pack.bonusGems;
}

/**
 * The store's daily gift: a few Free Gems, once per day, for opening the
 * store. Free Gems are the gameplay currency (never Purchased Gems), so this
 * can never be used to buy another player's item on the Marketplace.
 */
export const DAILY_GIFT_FREE_GEMS = 1;

/**
 * PACOTES COM SKINS EXCLUSIVAS — real-money bundles, once per account, each
 * built around tower skins that exist ONLY in that bundle
 * (config/towerSkins.ts PACK_TOWER_SKINS): never sold for Gems, never in the
 * daily shop or the Season Pass. Everything inside is shown before buying —
 * no random contents. Each bundle also carries a castle skin of its own
 * (config/castleSkins.ts, source PACK). Items stay at Rare (like the starter
 * pack), except one Epic in the biggest bundle (owner's call) — never
 * Legendary or Mythic, so money buys looks, Gems and room, not top-tier power. Gems match the plain
 * gem packs' rate for the price (~22-30 per R$), so the exclusive skins and
 * items are always on top of it, never a hidden discount.
 * Like every real-money purchase: 18+ only, "coming soon" until payments open.
 */
export interface SkinBundle {
  id: string;
  priceBrl: number;
  contents: readonly RewardPart[];
  tag?: "POPULAR" | "BEST_VALUE";
}

export const SKIN_BUNDLES: readonly SkinBundle[] = [
  {
    id: "BUNDLE_EMBER",
    priceBrl: 19.9,
    contents: [
      { kind: "SKIN", skinId: "INFERNO_PACK_EMBERHEART" },
      { kind: "CASTLE_SKIN", skinId: "EMBER_KEEP" },
      { kind: "PURCHASED_GEMS", amount: 450 },
    ],
  },
  {
    id: "BUNDLE_WINTER",
    priceBrl: 39.9,
    contents: [
      { kind: "SKIN", skinId: "FROSTBORN_PACK_WINTER_CROWN" },
      { kind: "CASTLE_SKIN", skinId: "WINTER_CROWN_CITADEL" },
      { kind: "PURCHASED_GEMS", amount: 900 },
      { kind: "ITEM", rarity: "RARE" },
    ],
  },
  {
    id: "BUNDLE_SENTINEL",
    priceBrl: 69.9,
    contents: [
      { kind: "SKIN", skinId: "IRONWOOD_PACK_EMERALD_SENTINEL" },
      { kind: "CASTLE_SKIN", skinId: "EMERALD_BASTION" },
      { kind: "PURCHASED_GEMS", amount: 1700 },
      { kind: "ITEM", rarity: "RARE" },
      { kind: "INVENTORY_SLOTS", amount: 10 },
    ],
    tag: "POPULAR",
  },
  {
    id: "BUNDLE_CRIMSON",
    priceBrl: 129.9,
    contents: [
      { kind: "SKIN", skinId: "STORMCALLER_PACK_CRIMSON_STORM" },
      { kind: "CASTLE_SKIN", skinId: "CRIMSON_STORM_KEEP" },
      { kind: "PURCHASED_GEMS", amount: 3600 },
      { kind: "ITEM", rarity: "RARE" },
      { kind: "ITEM", rarity: "RARE" },
      { kind: "INVENTORY_SLOTS", amount: 10 },
    ],
  },
  {
    id: "BUNDLE_ECLIPSE",
    priceBrl: 199.9,
    contents: [
      { kind: "SKIN", skinId: "IRONWOOD_PACK_ECLIPSE" },
      { kind: "SKIN", skinId: "FROSTBORN_PACK_ECLIPSE" },
      { kind: "CASTLE_SKIN", skinId: "ECLIPSE_SPIRE" },
      { kind: "PURCHASED_GEMS", amount: 5800 },
      { kind: "ITEM", rarity: "RARE" },
      { kind: "ITEM", rarity: "RARE" },
      { kind: "INVENTORY_SLOTS", amount: 10 },
    ],
  },
  {
    id: "BUNDLE_SOVEREIGN",
    priceBrl: 299.9,
    contents: [
      { kind: "SKIN", skinId: "INFERNO_PACK_SOVEREIGN" },
      { kind: "SKIN", skinId: "STORMCALLER_PACK_SOVEREIGN" },
      { kind: "CASTLE_SKIN", skinId: "SOVEREIGN_PALACE" },
      { kind: "PURCHASED_GEMS", amount: 9000 },
      { kind: "ITEM", rarity: "EPIC" },
      { kind: "ITEM", rarity: "RARE" },
      { kind: "ITEM", rarity: "RARE" },
      { kind: "INVENTORY_SLOTS", amount: 20 },
    ],
    tag: "BEST_VALUE",
  },
];

/** The bundle a pack-exclusive skin comes in, if any. */
export function bundleForSkin(skinId: string): SkinBundle | null {
  return SKIN_BUNDLES.find((b) => b.contents.some((p) => p.kind === "SKIN" && p.skinId === skinId)) ?? null;
}

/** The bundle a pack-exclusive castle skin comes in, if any. */
export function bundleForCastleSkin(castleSkinId: string): SkinBundle | null {
  return SKIN_BUNDLES.find((b) => b.contents.some((p) => p.kind === "CASTLE_SKIN" && p.skinId === castleSkinId)) ?? null;
}

/** The castle skin inside a bundle, if any. */
export function bundleCastleSkinId(bundle: SkinBundle): string | null {
  for (const p of bundle.contents) if (p.kind === "CASTLE_SKIN") return p.skinId;
  return null;
}

/** Skins inside a bundle. */
export function bundleSkinIds(bundle: SkinBundle): string[] {
  return bundle.contents.flatMap((p) => (p.kind === "SKIN" ? [p.skinId] : []));
}
