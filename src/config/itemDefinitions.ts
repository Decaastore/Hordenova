import type { Rarity } from "./rarity";

/**
 * Item System spec sections 8/13/17/26 — real item identity instead of
 * `inventory = ["sword", "sword"]`. This file holds DEFINITIONS (the
 * template every dropped copy is stamped from); entities/Item.ts holds the
 * per-copy INSTANCE (unique id, owner, history).
 *
 * Effects are declarative data only in this pass — nothing in CombatSystem
 * reads `ItemEffect` yet (spec section 26: "crie a base de categorias/
 * effects para permitir isso" — build the base, not the full integration).
 * That's a deliberate scope cut, not an oversight: wiring live combat
 * math to a MYTHIC drop is exactly the kind of change that could blow up
 * the ~wave 450-460 balance wall (spec section 27), and doing it without a
 * dedicated balance pass would be irresponsible. The shape below is what a
 * future CombatSystem hook would read.
 */
/**
 * AMULETOS COMO ITENS REAIS — "AMULET" joins the category union as its own
 * first-class type rather than staying folded into the generic "RELIC"
 * bucket. This is a RECLASSIFICATION of the one real amulet this catalog
 * already has (mosswood_charm, below) — its id/name/description/lore/
 * rarity/effects/source/tradable are all untouched, only the category value
 * changes. The union stays extensible on purpose (spec: "quero que o
 * sistema fique preparado para... AMULETOS, ARMAS, ARMADURAS, RECURSOS,
 * ITENS DE BOSS, ITENS RAROS") — a future WEAPON/ARMOR category is exactly
 * this same one-line addition, not a parallel item system.
 */
export type ItemCategory = "MATERIAL" | "AMULET" | "RELIC" | "RUNE" | "ARTIFACT" | "COSMETIC";

export type ItemEffectKind =
  | "TOWER_DAMAGE_PERCENT"
  | "TOWER_ATTACK_SPEED_PERCENT"
  | "BOSS_DAMAGE_PERCENT"
  | "CRIT_CHANCE_PERCENT"
  | "COSMETIC_ONLY";

export interface ItemEffect {
  kind: ItemEffectKind;
  /** Percentage points (2 = +2%). Not yet read by CombatSystem — see file header. */
  value: number;
}

/** Where an item's definition can be obtained — descriptive metadata; the DropTable in dropTables.ts is what actually rolls it. */
export interface ItemSource {
  type: "BOSS_DROP" | "MINI_BOSS_DROP" | "PHASE_MILESTONE";
  /** BossDefinition.id or a phase milestone id. */
  refId: string;
}

export interface ItemDefinition {
  id: string;
  /** i18n keys: items.<id>.name / .description / .lore */
  i18nKey: string;
  rarity: Rarity;
  category: ItemCategory;
  effects: ItemEffect[];
  source: ItemSource;
  /** Soulbound items (spec section 17) bind to the owner at acquisition and can never enter a trade. */
  tradable: boolean;
}

export const ITEM_TYPES = [
  "warden_fragment",
  "mosswood_charm",
  "ancient_core",
  "hollow_sigil",
  "wardens_eye",
  "crown_of_the_hollow_king",
] as const;

export type ItemId = (typeof ITEM_TYPES)[number];

/**
 * Ancient Forest's own small, curated collection (spec section 25: "não
 * criar dezenas de itens agora... prefiro uma pequena coleção inicial
 * realmente boa"). All six drop from the Hollow Warden — see
 * dropTables.ts's HOLLOW_WARDEN_DROP_TABLE, whose weights are the exact
 * real numbers these items drop at (spec section 12: if the UI shows a
 * chance, the chance IS the logic).
 */
export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  // A common trophy of having faced the Warden and lived — soulbound on
  // purpose (spec section 17 asks for at least one real example): a
  // "proof of the hunt" token isn't the kind of thing you'd hand someone
  // else, however common it is.
  warden_fragment: {
    id: "warden_fragment",
    i18nKey: "warden_fragment",
    rarity: "COMMON",
    category: "MATERIAL",
    effects: [],
    source: { type: "BOSS_DROP", refId: "hollow-warden" },
    tradable: false,
  },
  // AMULETOS COMO ITENS REAIS — the game's one existing amulet (its own
  // en/ptBR name is literally "Charm"/"Amuleto", see i18n/locales/*.ts's
  // items.mosswood_charm.name). Previously filed under the generic RELIC
  // category; now correctly its own AMULET type. Nothing else about this
  // definition changed.
  mosswood_charm: {
    id: "mosswood_charm",
    i18nKey: "mosswood_charm",
    rarity: "UNCOMMON",
    category: "AMULET",
    effects: [{ kind: "TOWER_DAMAGE_PERCENT", value: 2 }],
    source: { type: "BOSS_DROP", refId: "hollow-warden" },
    tradable: true,
  },
  ancient_core: {
    id: "ancient_core",
    i18nKey: "ancient_core",
    rarity: "RARE",
    category: "RUNE",
    effects: [{ kind: "TOWER_ATTACK_SPEED_PERCENT", value: 3 }],
    source: { type: "BOSS_DROP", refId: "hollow-warden" },
    tradable: true,
  },
  // AMULETOS COMO ITENS REAIS — confirmed as an amulet (a sigil worn as a
  // pendant). Previously ARTIFACT; only the category changed.
  hollow_sigil: {
    id: "hollow_sigil",
    i18nKey: "hollow_sigil",
    rarity: "EPIC",
    category: "AMULET",
    effects: [{ kind: "BOSS_DAMAGE_PERCENT", value: 5 }],
    source: { type: "BOSS_DROP", refId: "hollow-warden" },
    tradable: true,
  },
  // AMULETOS COMO ITENS REAIS — confirmed as an amulet (an eye pendant).
  // Previously ARTIFACT; only the category changed.
  wardens_eye: {
    id: "wardens_eye",
    i18nKey: "wardens_eye",
    rarity: "LEGENDARY",
    category: "AMULET",
    effects: [{ kind: "CRIT_CHANCE_PERCENT", value: 4 }],
    source: { type: "BOSS_DROP", refId: "hollow-warden" },
    tradable: true,
  },
  // The Mythic. Extremely low weight in the drop table (0.10%) is the
  // ENTIRE reason this feels rare — no hidden pity, no separate "guaranteed
  // after N kills" system quietly boosting the real number (spec sections
  // 10/12/33 are explicit that would be a lie).
  crown_of_the_hollow_king: {
    id: "crown_of_the_hollow_king",
    i18nKey: "crown_of_the_hollow_king",
    rarity: "MYTHIC",
    category: "ARTIFACT",
    effects: [{ kind: "TOWER_DAMAGE_PERCENT", value: 8 }],
    source: { type: "BOSS_DROP", refId: "hollow-warden" },
    tradable: true,
  },
};

export function getItemDefinition(id: string): ItemDefinition | null {
  return (ITEM_DEFINITIONS as Record<string, ItemDefinition>)[id] ?? null;
}

/** Every real item definition at `rarity` — SISTEMA DE FUSÃO DE ITENS reads this to pick the superior item a successful fusion creates. Today exactly 1 per rarity (see file header); if a future catalog expansion adds more than one, the caller picks among these rather than this file inventing a tie-break rule. */
export function getItemDefinitionsByRarity(rarity: Rarity): ItemDefinition[] {
  return Object.values(ITEM_DEFINITIONS).filter((def) => def.rarity === rarity);
}
