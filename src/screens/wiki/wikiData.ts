import { TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { ENEMY_TYPES, type EnemyType } from "@/config/enemyStats";
import { MAIN_BOSSES, MINI_BOSSES, type BossDefinition } from "@/config/bossConfig";
import { PHASES, type PhaseDefinition } from "@/config/phaseConfig";
import { ITEM_TYPES } from "@/config/itemDefinitions";
import { DROP_TABLES } from "@/config/dropTables";
import { PRESTIGE_TOWER_SKINS, TOWER_SKINS, type TowerSkinDefinition } from "@/config/towerSkins";
import { SPECIALIZATIONS_BY_TOWER } from "@/config/specializations";

export type WikiCategory = "TOWERS" | "BESTIARY" | "CASTLE" | "ITEMS" | "PROGRESSION" | "ECONOMY" | "ASCENSION" | "PROJECTIONS";
export const WIKI_CATEGORIES: readonly WikiCategory[] = ["TOWERS", "BESTIARY", "CASTLE", "ITEMS", "PROGRESSION", "ECONOMY", "ASCENSION", "PROJECTIONS"];

/** The six original phases share one roster of 8 archetypes (each biome has its own creature for each). */
export const CORE_PHASE_COUNT = 6;

export function skinsForTower(type: TowerType): TowerSkinDefinition[] {
  return [...TOWER_SKINS, ...PRESTIGE_TOWER_SKINS].filter((s) => s.towerType === type);
}

/** Phases (1-based numbers) a creature type shows up in. */
export function phasesForEnemy(type: EnemyType): number[] {
  return PHASES.flatMap((p, i) => (p.enemyPool.includes(type) ? [i + 1] : []));
}

export function phaseOfMainBoss(bossId: string): { number: number; phase: PhaseDefinition } | null {
  const i = PHASES.findIndex((p) => p.mainBossId === bossId);
  return i >= 0 ? { number: i + 1, phase: PHASES[i]! } : null;
}

/** A mini-boss pinned to one phase (expansion biomes), or null for the original rotating roster. */
export function phaseOfMiniBoss(bossId: string): { number: number; phase: PhaseDefinition } | null {
  const i = PHASES.findIndex((p) => p.miniBossId === bossId);
  return i >= 0 ? { number: i + 1, phase: PHASES[i]! } : null;
}

/** Bosses whose drop table can roll this item (reverse lookup for the Items page). */
export function bossesDroppingItem(itemId: string): BossDefinition[] {
  return [...Object.values(MAIN_BOSSES), ...Object.values(MINI_BOSSES)].filter((b) => {
    const table = b.dropTableId ? DROP_TABLES[b.dropTableId] : null;
    return table?.entries.some((e) => e.itemId === itemId) ?? false;
  });
}

export type SearchTarget =
  | { category: "TOWERS"; tower: TowerType; anchor: string }
  | { category: Exclude<WikiCategory, "TOWERS">; anchor: string };

export interface SearchEntry {
  /** i18n key of the visible name. */
  nameKey: string;
  /** i18n key of the category label shown next to it. */
  kindKey: string;
  target: SearchTarget;
}

/** Every searchable thing in the Wiki — names are matched in the active language. */
export function buildSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const type of TOWER_TYPES) {
    out.push({ nameKey: `towers.${type}.name`, kindKey: "wiki.kinds.tower", target: { category: "TOWERS", tower: type, anchor: `tower-${type}` } });
    for (const spec of SPECIALIZATIONS_BY_TOWER[type]) {
      out.push({ nameKey: `specializations.${spec.id}.name`, kindKey: "wiki.kinds.specialization", target: { category: "TOWERS", tower: type, anchor: `spec-${spec.id}` } });
    }
    for (const skin of skinsForTower(type)) {
      out.push({ nameKey: `towerSkins.${skin.i18nKey}.name`, kindKey: "wiki.kinds.skin", target: { category: "TOWERS", tower: type, anchor: `skin-${skin.id}` } });
    }
  }
  for (const type of ENEMY_TYPES) out.push({ nameKey: `enemies.${type}.name`, kindKey: "wiki.kinds.creature", target: { category: "BESTIARY", anchor: `enemy-${type}` } });
  for (const b of Object.values(MAIN_BOSSES)) out.push({ nameKey: `bosses.${b.i18nKey}.name`, kindKey: "wiki.kinds.boss", target: { category: "BESTIARY", anchor: `boss-${b.id}` } });
  for (const b of Object.values(MINI_BOSSES)) out.push({ nameKey: `bosses.${b.i18nKey}.name`, kindKey: "wiki.kinds.miniBoss", target: { category: "BESTIARY", anchor: `boss-${b.id}` } });
  for (const id of ITEM_TYPES) out.push({ nameKey: `items.${id}.name`, kindKey: "wiki.kinds.item", target: { category: "ITEMS", anchor: `item-${id}` } });
  PHASES.forEach((p, i) =>
    out.push({ nameKey: `phases.${p.i18nKey}.name`, kindKey: "wiki.kinds.phase", target: { category: "BESTIARY", anchor: i < CORE_PHASE_COUNT ? "phase-core" : `phase-${p.id}` } }),
  );
  return out;
}

/** Case/accent-insensitive normalisation for search. */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
