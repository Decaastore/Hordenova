import type { Rarity } from "./rarity";

/**
 * LOOT NO CHÃO — what falls on the map when something worth having drops,
 * Diablo-style: a beam of light in the rarity's colour where the enemy
 * died, the item's name floating over it, then it flies to your bag. It is
 * the presentation of rewards the game grants anyway (boss and mini-boss
 * item rolls, their Gem Shards, Rift rewards) plus one small new source:
 * an elite has a flat ELITE_SHARD_DROP_CHANCE to drop a Gem Shard.
 */
export type LootKind = "item" | "shards";

export interface LootDrop {
  /** Increasing id so the renderer can tell new drops from ones it already shows. */
  seq: number;
  kind: LootKind;
  rarity: Rarity;
  /** For kind "item". */
  itemDefinitionId?: string;
  /** For kind "shards". */
  amount: number;
  x: number;
  y: number;
}

/** The real chance an elite enemy drops a Gem Shard when it dies (shown in the Wiki). */
export const ELITE_SHARD_DROP_CHANCE = 0.05;
export const ELITE_SHARD_DROP_AMOUNT = 1;

/** How many recent drops the engine keeps for the renderer to show. */
export const MAX_RECENT_LOOT = 16;

/** The rarity a pile of Gem Shards is shown with — a bigger pile glows like a rarer item. */
export function shardPileRarity(amount: number): Rarity {
  if (amount >= 10) return "EPIC";
  if (amount >= 3) return "RARE";
  return "UNCOMMON";
}
