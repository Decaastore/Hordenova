import { ITEM_DEFINITIONS, type ItemId } from "./itemDefinitions";

/**
 * Item System spec sections 11/12/33 — "SE O JOGO MOSTRA UMA CHANCE, ESSA
 * CHANCE É REAL." `weightPercent` on each entry is not a display-only
 * number computed from some other "real" internal weight — it IS the
 * weight `rollDropTable` uses. `DropTableView` (ui/) renders these exact
 * fields. There is no pity system, no hidden multiplier, no per-player
 * modifier anywhere in this file or in the roll function below; if one is
 * ever added, spec section 11 requires it to become a visible field here,
 * not a private adjustment.
 *
 * A table's `entries` weights sum to exactly 100 — verified by
 * dropTables.test.ts for every table in DROP_TABLES — so a roll always
 * produces exactly one item (no "no drop" outcome), matching the worked
 * example in the spec (Common 62% + Rare 25% + Epic 10% + Legendary 2.9%
 * + Mythic 0.1% = 100%).
 */
export interface DropTableEntry {
  itemId: ItemId;
  /** The real probability, in percent (0-100). This is the exact number shown in the UI. */
  weightPercent: number;
}

export interface DropTable {
  id: string;
  sourceType: "BOSS" | "MINI_BOSS" | "PHASE_MILESTONE";
  /** BossDefinition.id (or a future phase-milestone id) this table belongs to. */
  sourceId: string;
  entries: DropTableEntry[];
}

export const DROP_TABLES: Record<string, DropTable> = {
  "hollow-warden": {
    id: "hollow-warden",
    sourceType: "BOSS",
    sourceId: "hollow-warden",
    entries: [
      { itemId: "warden_fragment", weightPercent: 55 },
      { itemId: "mosswood_charm", weightPercent: 25 },
      { itemId: "ancient_core", weightPercent: 12 },
      { itemId: "hollow_sigil", weightPercent: 6.5 },
      { itemId: "wardens_eye", weightPercent: 1.4 },
      { itemId: "crown_of_the_hollow_king", weightPercent: 0.1 },
    ],
  },
};

export function getDropTable(id: string): DropTable | null {
  return DROP_TABLES[id] ?? null;
}

/**
 * Weighted single-item roll. `rng` defaults to Math.random but is
 * injectable so tests can drive exact outcomes deterministically instead
 * of asserting on statistical distributions.
 *
 * Client-side RNG is a known, temporary limitation of the local-only build
 * (spec section 31: server becomes authoritative for drops once a backend
 * exists) — nothing here pretends otherwise, and moving the roll
 * server-side later doesn't change this function's contract (same table
 * shape in, one itemId out).
 */
export function rollDropTable(table: DropTable, rng: () => number = Math.random): ItemId {
  const roll = rng() * 100;
  let cumulative = 0;
  for (const entry of table.entries) {
    cumulative += entry.weightPercent;
    if (roll < cumulative) return entry.itemId;
  }
  // Floating-point edge case at the very top of the range — fall back to
  // the last entry rather than throwing.
  return table.entries[table.entries.length - 1]!.itemId;
}

/** Sum of a table's weights — dropTables.test.ts asserts this is 100 for every table; exposed so the UI can show it too if ever useful for auditing. */
export function totalWeightPercent(table: DropTable): number {
  return table.entries.reduce((sum, entry) => sum + entry.weightPercent, 0);
}

export function itemDefinitionForEntry(entry: DropTableEntry) {
  return ITEM_DEFINITIONS[entry.itemId];
}
