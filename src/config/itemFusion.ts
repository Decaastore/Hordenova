import { RARITIES, type Rarity } from "./rarity";

/**
 * SISTEMA DE FUSÃO DE ITENS — a large, intentional ITEM SINK: select exactly
 * 3 items of the SAME rarity for one attempt at exactly 1 item of the NEXT
 * rarity tier. These chances are FINAL per the task spec and must NEVER be
 * increased to make the game easier — they exist specifically to keep RARE
 * and above extremely scarce, since these items may become tradable in the
 * existing/future trade system (config/itemDefinitions.ts's `tradable`
 * flag). Fusion must never become an easy way to mass-produce rare items.
 *
 * On FAILURE the 3 items are consumed with ZERO compensation (no items, no
 * Gems, no Gold, no Fragments returned) — this is INTENCIONAL, not a bug.
 * There is NO pity system, NO guarantee after N attempts, and this chance
 * can NEVER be increased by Prestige, Mastery, Specialization, or by paying
 * additional Gems — see engine/ItemFusion.ts's rollFusion, which reads
 * ONLY this table and nothing else.
 */
export const FUSION_ITEM_COUNT = 3;

/** Success chance per SOURCE rarity (the rarity of the 3 items being fused), keyed by Rarity. FINAL — never a balance lever. */
const FUSION_SUCCESS_CHANCE: Record<Rarity, number> = {
  COMMON: 0.4, // 3 Comuns -> Normal (Uncommon): 40%
  UNCOMMON: 0.2, // 3 Normais -> Raro: 20%
  RARE: 0.03, // 3 Raros -> Épico: 3%
  EPIC: 0.01, // 3 Épicos -> Lendário: 1%
  LEGENDARY: 0.0025, // 3 Lendários -> Mítico: 0.25%
  // MYTHIC has no real next tier in the current 6-tier RARITIES array — see
  // getNextRarity below, which returns null and is what actually blocks the
  // attempt (spec: "raridade máxima... UI deve mostrar que não existe fusão
  // superior e nunca permitir a tentativa"). This 0.05% is carried only for
  // documentation/future-proofing (the task spec's own "3 Míticos -> próxima
  // raridade (0.05%)" example) and is never read by rollFusion in practice.
  MYTHIC: 0.0005,
};

/** The success chance for fusing 3 items of `rarity`. Always a real, final number — never inflated by anything (see file header). */
export function getFusionSuccessChance(rarity: Rarity): number {
  return FUSION_SUCCESS_CHANCE[rarity];
}

/** The rarity tier fusing 3 `rarity` items targets, or null when `rarity` is already the maximum (MYTHIC) and no higher tier exists — the exact condition the UI/engine use to block the attempt entirely. */
export function getNextRarity(rarity: Rarity): Rarity | null {
  const index = RARITIES.indexOf(rarity);
  if (index < 0 || index >= RARITIES.length - 1) return null;
  return RARITIES[index + 1] ?? null;
}
