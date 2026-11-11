import type { ItemInstance } from "@/entities/Item";
import { getItemDefinition, type ItemDefinition, type ItemEffect } from "./itemDefinitions";
import type { Rarity } from "./rarity";

/**
 * ATRIBUTOS SORTEADOS — every dropped copy of an item rolls its own value
 * for each effect inside a range that is shown to the player (60% to 140% of
 * the definition's listed value). Two copies of the same item can differ,
 * which is what makes a drop worth looking at and a re-roll worth paying
 * for. The range is the whole truth: no hidden weighting, a roll is uniform
 * inside it.
 *
 * Copies created before rolls existed carry no `rolls` and simply use the
 * definition's listed value — the middle of the range — so nobody's item
 * changes on update.
 */
export const ROLL_MIN_FACTOR = 0.6;
export const ROLL_MAX_FACTOR = 1.4;

export interface EffectRange {
  min: number;
  max: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function effectRange(effect: ItemEffect): EffectRange {
  return { min: round1(effect.value * ROLL_MIN_FACTOR), max: round1(effect.value * ROLL_MAX_FACTOR) };
}

/** One rolled value per effect of the definition (uniform inside each shown range, one decimal). */
export function rollItemEffects(def: ItemDefinition, rng: () => number = Math.random): number[] {
  return def.effects.map((effect) => {
    const { min, max } = effectRange(effect);
    return round1(min + (max - min) * rng());
  });
}

/** The effects of this exact copy, with its own rolled values. */
export function itemEffectsOf(item: Pick<ItemInstance, "itemDefinitionId" | "rolls">): ItemEffect[] {
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def) return [];
  return def.effects.map((effect, i) => ({ kind: effect.kind, value: item.rolls?.[i] ?? effect.value }));
}

/** Where this copy's roll sits inside its range, 0..1 (average over its effects) — shown as the item's "quality". */
export function itemRollQuality(item: Pick<ItemInstance, "itemDefinitionId" | "rolls">): number | null {
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def || def.effects.length === 0) return null;
  const parts = def.effects.map((effect, i) => {
    const { min, max } = effectRange(effect);
    const v = item.rolls?.[i] ?? effect.value;
    return max > min ? (v - min) / (max - min) : 1;
  });
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** Re-roll price in Gem Shards, by rarity. Items without effects can't be re-rolled. */
export const REROLL_SHARD_COST: Record<Rarity, number> = {
  COMMON: 0,
  UNCOMMON: 4,
  RARE: 8,
  EPIC: 15,
  LEGENDARY: 30,
  MYTHIC: 60,
};

export function rerollCost(item: Pick<ItemInstance, "itemDefinitionId">): number | null {
  const def = getItemDefinition(item.itemDefinitionId);
  if (!def || def.effects.length === 0) return null;
  return REROLL_SHARD_COST[def.rarity];
}

/** The combined bonus a tower gets from the items equipped in its slots (percentage points). */
export interface ItemBonus {
  damagePct: number;
  attackSpeedPct: number;
  bossDamagePct: number;
  critChancePct: number;
}

export const NO_ITEM_BONUS: ItemBonus = { damagePct: 0, attackSpeedPct: 0, bossDamagePct: 0, critChancePct: 0 };

export function itemBonusFrom(items: readonly Pick<ItemInstance, "itemDefinitionId" | "rolls">[]): ItemBonus {
  const bonus = { ...NO_ITEM_BONUS };
  for (const item of items) {
    for (const effect of itemEffectsOf(item)) {
      if (effect.kind === "TOWER_DAMAGE_PERCENT") bonus.damagePct += effect.value;
      else if (effect.kind === "TOWER_ATTACK_SPEED_PERCENT") bonus.attackSpeedPct += effect.value;
      else if (effect.kind === "BOSS_DAMAGE_PERCENT") bonus.bossDamagePct += effect.value;
      else if (effect.kind === "CRIT_CHANCE_PERCENT") bonus.critChancePct += effect.value;
    }
  }
  return bonus;
}

/** Damage multiplier of an item-granted critical hit (towers without their own crit). */
export const ITEM_CRIT_MULTIPLIER = 1.5;
