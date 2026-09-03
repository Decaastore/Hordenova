/**
 * Item System spec section 9 — rarity is a real axis of the economy
 * (scarcity/visual identity/valid sources), NOT a shorthand for "how
 * strong". A COMMON material and a MYTHIC artifact can both matter; what
 * rarity controls is how HARD an item is to get and how the UI presents
 * it, never a guaranteed power curve. Effect strength is set per-item in
 * itemDefinitions.ts, independently of rarity.
 */
export const RARITIES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"] as const;

export type Rarity = (typeof RARITIES)[number];

export interface RarityDefinition {
  id: Rarity;
  /** i18n key: rarity.<id> */
  i18nKey: Rarity;
  /** Sort/display order, lowest first — also used to rank "rarer than" comparisons. */
  order: number;
  color: string;
  glow: string;
}

export const RARITY_DEFINITIONS: Record<Rarity, RarityDefinition> = {
  COMMON: { id: "COMMON", i18nKey: "COMMON", order: 0, color: "#c9c9c9", glow: "rgba(201,201,201,0.45)" },
  UNCOMMON: { id: "UNCOMMON", i18nKey: "UNCOMMON", order: 1, color: "#6fe06f", glow: "rgba(111,224,111,0.5)" },
  RARE: { id: "RARE", i18nKey: "RARE", order: 2, color: "#4ec4f0", glow: "rgba(78,196,240,0.55)" },
  EPIC: { id: "EPIC", i18nKey: "EPIC", order: 3, color: "#a860f0", glow: "rgba(168,96,240,0.6)" },
  LEGENDARY: { id: "LEGENDARY", i18nKey: "LEGENDARY", order: 4, color: "#ffcf5e", glow: "rgba(255,207,94,0.65)" },
  MYTHIC: { id: "MYTHIC", i18nKey: "MYTHIC", order: 5, color: "#ff4f6a", glow: "rgba(255,79,106,0.75)" },
};

export function getRarityDefinition(rarity: Rarity): RarityDefinition {
  return RARITY_DEFINITIONS[rarity];
}

export function isRarerThan(a: Rarity, b: Rarity): boolean {
  return RARITY_DEFINITIONS[a].order > RARITY_DEFINITIONS[b].order;
}
