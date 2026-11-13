/**
 * A small bundle of account rewards used by the 7-day login, the beginner
 * missions and the collections. Gems here are always FREE Gems, kept small.
 */
export interface RewardBundle {
  gold?: number;
  shards?: number;
  splinters?: number;
  rare?: number;
  epic?: number;
  freeGems?: number;
  castleSkinId?: string;
}
