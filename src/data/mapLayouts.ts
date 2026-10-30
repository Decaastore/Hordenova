import { buildCatmullRomSpline, distanceToPolyline, getPathLength, type Vector2 } from "@/utils/geometry";
import { WORLD_SIZE } from "@/config/gameBalance";
import { ENEMY_PATH, PATH_CONTROL_POINTS_FOR_LAYOUTS as FOREST_CONTROL_POINTS, TOWER_SLOTS, type SlotDistanceCategory, type TowerSlotDefinition } from "./mapWhisperingWoods";

/**
 * MAP LAYOUTS — every phase (biome) has its own battlefield: its own road
 * from the rift to the castle and its own 14 build sites. Up to
 * MAX_TOWERS_ON_MAP towers can stand on a map at once, so every map leaves
 * two sites empty: where to build is a real choice, not a fixed answer.
 *
 * Two kinds of site are special and drawn differently on the ground:
 *  - HIGH_GROUND (a raised rocky outcrop): tower range x HIGH_GROUND_RANGE_MULT.
 *  - RUNE_ALTAR (a glowing rune altar): tower damage x RUNE_ALTAR_DAMAGE_MULT.
 *
 * BALANCE (enforced by mapLayouts.test.ts):
 *  - Crossing time is the same on every map: each layout carries a
 *    `speedScale` (this road's length / the reference road's length) that enemy
 *    movement is multiplied by, so a longer road is never an easier map and
 *    a shorter one never a harder one.
 *  - Coverage matches the original map: the summed share of the road the
 *    best 12 sites can reach (at short, medium and long tower range, traits
 *    included) stays within a few percent of the Ancient Forest's. The
 *    layouts were generated against that target offline and frozen here as
 *    plain data.
 *  - Every site respects the existing structural rules (spacing, distance
 *    from the road and from the castle gate, map bounds).
 *
 * Ancient Forest keeps its original road and its original 12 sites exactly
 * (ids and positions), plus two new ones.
 */

export type SiteTrait = "NONE" | "HIGH_GROUND" | "RUNE_ALTAR";
export const HIGH_GROUND_RANGE_MULT = 1.15;
export const RUNE_ALTAR_DAMAGE_MULT = 1.1;
export const MAX_TOWERS_ON_MAP = 12;
export const SITES_PER_MAP = 14;

export interface BuildSite extends TowerSlotDefinition {
  trait: SiteTrait;
}

export interface MapLayout {
  id: string;
  /** Developer-facing one-liner describing the route. */
  summary: string;
  controlPoints: readonly Vector2[];
  /** Dense walked/drawn road, rift (start) to castle gate (end). */
  path: readonly Vector2[];
  length: number;
  /** Enemy movement multiplier that keeps crossing time equal to the reference map. */
  speedScale: number;
  sites: readonly BuildSite[];
}

interface LayoutSource {
  id: string;
  summary: string;
  controlPoints: readonly Vector2[];
  sites: readonly { id: string; x: number; y: number; trait: SiteTrait }[];
}

function pts(list: readonly (readonly [number, number])[]): Vector2[] {
  return list.map(([x, y]) => ({ x, y }));
}
function site(id: string, x: number, y: number, trait: SiteTrait) {
  return { id, x, y, trait };
}

const FOREST_TRAITS: Record<string, SiteTrait> = { "slot-5": "RUNE_ALTAR", "slot-7": "HIGH_GROUND", "slot-10": "HIGH_GROUND", "slot-11": "RUNE_ALTAR" };

const SOURCES: Record<string, LayoutSource> = {
  ANCIENT_FOREST: {
    id: "ANCIENT_FOREST",
    summary: "The original woodland snake: three long lanes joined by two hairpins.",
    controlPoints: FOREST_CONTROL_POINTS,
    sites: [
      ...TOWER_SLOTS.map((s) => site(s.id, s.position.x, s.position.y, FOREST_TRAITS[s.id] ?? "NONE")),
      site("slot-13", 121.0, 574.0, "NONE"),
      site("slot-14", 913.0, 126.0, "NONE"),
    ],
  },
  VOLCANIC_WASTES: {
    id: "VOLCANIC_WASTES",
    summary: "In along the bottom, round the caldera rim, and into the heart of the lava field.",
    controlPoints: pts([[0, 510], [560, 520], [880, 470], [910, 160], [560, 80], [160, 100], [120, 300], [330, 320], [690, 300]]),
    sites: [
      site("slot-1", 129.0, 438.0, "RUNE_ALTAR"),
      site("slot-2", 233.0, 430.0, "NONE"),
      site("slot-3", 345.0, 422.0, "HIGH_GROUND"),
      site("slot-4", 473.0, 422.0, "NONE"),
      site("slot-5", 569.0, 558.0, "NONE"),
      site("slot-6", 689.0, 438.0, "RUNE_ALTAR"),
      site("slot-7", 817.0, 214.0, "NONE"),
      site("slot-8", 513.0, 118.0, "NONE"),
      site("slot-9", 369.0, 166.0, "NONE"),
      site("slot-10", 217.0, 158.0, "HIGH_GROUND"),
      site("slot-11", 137.0, 230.0, "NONE"),
      site("slot-12", 289.0, 222.0, "NONE"),
      site("slot-13", 537.0, 270.0, "NONE"),
      site("slot-14", 577.0, 406.0, "NONE"),
    ],
  },
  FROZEN_TUNDRA: {
    id: "FROZEN_TUNDRA",
    summary: "Tight switchbacks climbing up and down a frozen pass.",
    controlPoints: pts([[0, 70], [170, 70], [170, 520], [380, 520], [380, 80], [590, 80], [590, 520], [800, 520], [800, 300], [1000, 300]]),
    sites: [
      site("slot-1", 105.0, 174.0, "RUNE_ALTAR"),
      site("slot-2", 121.0, 382.0, "NONE"),
      site("slot-3", 257.0, 446.0, "HIGH_GROUND"),
      site("slot-4", 89.0, 542.0, "NONE"),
      site("slot-5", 441.0, 478.0, "RUNE_ALTAR"),
      site("slot-6", 337.0, 318.0, "NONE"),
      site("slot-7", 321.0, 222.0, "NONE"),
      site("slot-8", 433.0, 134.0, "HIGH_GROUND"),
      site("slot-9", 513.0, 86.0, "NONE"),
      site("slot-10", 633.0, 278.0, "NONE"),
      site("slot-11", 497.0, 310.0, "NONE"),
      site("slot-12", 545.0, 550.0, "NONE"),
      site("slot-13", 705.0, 438.0, "NONE"),
      site("slot-14", 753.0, 222.0, "NONE"),
    ],
  },
  CURSED_DESERT: {
    id: "CURSED_DESERT",
    summary: "Big dune waves rolling across the whole map.",
    controlPoints: pts([[0, 300], [55, 75], [170, 65], [240, 300], [310, 530], [430, 535], [500, 300], [570, 65], [690, 65], [760, 300], [830, 530], [950, 530], [1000, 380]]),
    sites: [
      site("slot-1", 97.0, 158.0, "RUNE_ALTAR"),
      site("slot-2", 281.0, 142.0, "NONE"),
      site("slot-3", 185.0, 230.0, "NONE"),
      site("slot-4", 177.0, 350.0, "NONE"),
      site("slot-5", 217.0, 486.0, "NONE"),
      site("slot-6", 369.0, 518.0, "NONE"),
      site("slot-7", 409.0, 430.0, "NONE"),
      site("slot-8", 537.0, 358.0, "NONE"),
      site("slot-9", 409.0, 302.0, "HIGH_GROUND"),
      site("slot-10", 665.0, 254.0, "HIGH_GROUND"),
      site("slot-11", 849.0, 262.0, "NONE"),
      site("slot-12", 681.0, 350.0, "NONE"),
      site("slot-13", 849.0, 414.0, "RUNE_ALTAR"),
      site("slot-14", 809.0, 566.0, "NONE"),
    ],
  },
  DARK_RUINS: {
    id: "DARK_RUINS",
    summary: "A broken stairway: long ramps that double back down through the ruins.",
    controlPoints: pts([[0, 200], [120, 75], [660, 75], [320, 300], [940, 300], [600, 525], [1000, 525]]),
    sites: [
      site("slot-1", 25.0, 294.0, "NONE"),
      site("slot-2", 105.0, 174.0, "NONE"),
      site("slot-3", 41.0, 46.0, "NONE"),
      site("slot-4", 257.0, 142.0, "HIGH_GROUND"),
      site("slot-5", 497.0, 94.0, "RUNE_ALTAR"),
      site("slot-6", 673.0, 38.0, "NONE"),
      site("slot-7", 705.0, 142.0, "HIGH_GROUND"),
      site("slot-8", 249.0, 366.0, "NONE"),
      site("slot-9", 401.0, 366.0, "NONE"),
      site("slot-10", 633.0, 214.0, "NONE"),
      site("slot-11", 817.0, 350.0, "NONE"),
      site("slot-12", 681.0, 398.0, "RUNE_ALTAR"),
      site("slot-13", 537.0, 446.0, "NONE"),
      site("slot-14", 617.0, 574.0, "NONE"),
    ],
  },
  ABYSS: {
    id: "ABYSS",
    summary: "A spiral that winds inward to the void at the centre.",
    controlPoints: pts([[0, 550], [830, 550], [880, 140], [140, 100], [110, 380], [560, 400], [600, 260], [430, 250]]),
    sites: [
      site("slot-1", 177.0, 494.0, "NONE"),
      site("slot-2", 377.0, 526.0, "NONE"),
      site("slot-3", 529.0, 518.0, "NONE"),
      site("slot-4", 761.0, 198.0, "NONE"),
      site("slot-5", 657.0, 158.0, "NONE"),
      site("slot-6", 233.0, 182.0, "NONE"),
      site("slot-7", 145.0, 238.0, "NONE"),
      site("slot-8", 105.0, 430.0, "RUNE_ALTAR"),
      site("slot-9", 273.0, 470.0, "RUNE_ALTAR"),
      site("slot-10", 449.0, 462.0, "NONE"),
      site("slot-11", 489.0, 374.0, "NONE"),
      site("slot-12", 617.0, 454.0, "HIGH_GROUND"),
      site("slot-13", 553.0, 294.0, "NONE"),
      site("slot-14", 553.0, 182.0, "HIGH_GROUND"),
    ],
  },
  DWARVEN_UNDERCITY: {
    id: "DWARVEN_UNDERCITY",
    summary: "Square mine galleries and shafts.",
    controlPoints: pts([[0, 90], [320, 90], [320, 300], [110, 300], [110, 520], [560, 520], [560, 90], [800, 90], [800, 420], [1000, 420]]),
    sites: [
      site("slot-1", 121.0, 38.0, "NONE"),
      site("slot-2", 257.0, 118.0, "RUNE_ALTAR"),
      site("slot-3", 369.0, 310.0, "RUNE_ALTAR"),
      site("slot-4", 241.0, 214.0, "NONE"),
      site("slot-5", 201.0, 398.0, "HIGH_GROUND"),
      site("slot-6", 129.0, 214.0, "NONE"),
      site("slot-7", 113.0, 430.0, "NONE"),
      site("slot-8", 545.0, 470.0, "NONE"),
      site("slot-9", 545.0, 374.0, "NONE"),
      site("slot-10", 625.0, 214.0, "NONE"),
      site("slot-11", 457.0, 206.0, "NONE"),
      site("slot-12", 681.0, 118.0, "NONE"),
      site("slot-13", 865.0, 118.0, "NONE"),
      site("slot-14", 721.0, 214.0, "HIGH_GROUND"),
    ],
  },
  COLOSSUS_GRAVEYARD: {
    id: "COLOSSUS_GRAVEYARD",
    summary: "Weaves between two colossal ribcages.",
    controlPoints: pts([[0, 300], [110, 90], [370, 90], [490, 300], [370, 510], [630, 510], [750, 300], [630, 90], [890, 90], [960, 260], [1000, 400]]),
    sites: [
      site("slot-1", 121.0, 174.0, "NONE"),
      site("slot-2", 33.0, 110.0, "NONE"),
      site("slot-3", 209.0, 134.0, "RUNE_ALTAR"),
      site("slot-4", 289.0, 30.0, "NONE"),
      site("slot-5", 441.0, 254.0, "NONE"),
      site("slot-6", 497.0, 390.0, "RUNE_ALTAR"),
      site("slot-7", 305.0, 406.0, "NONE"),
      site("slot-8", 593.0, 574.0, "NONE"),
      site("slot-9", 721.0, 510.0, "NONE"),
      site("slot-10", 793.0, 438.0, "NONE"),
      site("slot-11", 793.0, 190.0, "NONE"),
      site("slot-12", 633.0, 270.0, "HIGH_GROUND"),
      site("slot-13", 561.0, 142.0, "HIGH_GROUND"),
      site("slot-14", 721.0, 110.0, "NONE"),
    ],
  },
  FLOATING_ISLES: {
    id: "FLOATING_ISLES",
    summary: "Island hops on wide, looping arcs.",
    controlPoints: pts([[0, 480], [200, 540], [380, 420], [300, 230], [420, 80], [640, 90], [720, 260], [600, 420], [780, 540], [950, 470], [860, 300], [950, 140], [1000, 100]]),
    sites: [
      site("slot-1", 177.0, 502.0, "NONE"),
      site("slot-2", 273.0, 438.0, "HIGH_GROUND"),
      site("slot-3", 457.0, 470.0, "NONE"),
      site("slot-4", 361.0, 278.0, "NONE"),
      site("slot-5", 401.0, 166.0, "NONE"),
      site("slot-6", 337.0, 78.0, "NONE"),
      site("slot-7", 505.0, 110.0, "NONE"),
      site("slot-8", 649.0, 174.0, "RUNE_ALTAR"),
      site("slot-9", 617.0, 262.0, "NONE"),
      site("slot-10", 553.0, 446.0, "NONE"),
      site("slot-11", 657.0, 558.0, "NONE"),
      site("slot-12", 785.0, 462.0, "RUNE_ALTAR"),
      site("slot-13", 961.0, 358.0, "NONE"),
      site("slot-14", 801.0, 254.0, "HIGH_GROUND"),
    ],
  },
  LOST_SUN_TEMPLE: {
    id: "LOST_SUN_TEMPLE",
    summary: "Spirals outward from the sun altar in the middle of the temple.",
    controlPoints: pts([[480, 320], [690, 320], [690, 165], [290, 165], [170, 330], [310, 530], [830, 530], [950, 380], [900, 160], [1000, 120]]),
    sites: [
      site("slot-1", 513.0, 406.0, "NONE"),
      site("slot-2", 593.0, 238.0, "NONE"),
      site("slot-3", 465.0, 70.0, "NONE"),
      site("slot-4", 457.0, 198.0, "RUNE_ALTAR"),
      site("slot-5", 209.0, 150.0, "NONE"),
      site("slot-6", 249.0, 238.0, "NONE"),
      site("slot-7", 225.0, 334.0, "RUNE_ALTAR"),
      site("slot-8", 297.0, 566.0, "NONE"),
      site("slot-9", 433.0, 462.0, "NONE"),
      site("slot-10", 593.0, 486.0, "HIGH_GROUND"),
      site("slot-11", 721.0, 446.0, "NONE"),
      site("slot-12", 929.0, 542.0, "NONE"),
      site("slot-13", 873.0, 406.0, "NONE"),
      site("slot-14", 865.0, 286.0, "HIGH_GROUND"),
    ],
  },
  CRYSTAL_SEA: {
    id: "CRYSTAL_SEA",
    summary: "Follows the shoreline between crystal reefs and ends out on a reef.",
    controlPoints: pts([[0, 150], [360, 150], [500, 55], [700, 150], [950, 170], [950, 460], [640, 460], [480, 540], [220, 460], [300, 300], [680, 295]]),
    sites: [
      site("slot-1", 145.0, 110.0, "NONE"),
      site("slot-2", 297.0, 206.0, "NONE"),
      site("slot-3", 353.0, 86.0, "NONE"),
      site("slot-4", 889.0, 206.0, "NONE"),
      site("slot-5", 897.0, 558.0, "NONE"),
      site("slot-6", 881.0, 430.0, "NONE"),
      site("slot-7", 721.0, 422.0, "NONE"),
      site("slot-8", 601.0, 414.0, "RUNE_ALTAR"),
      site("slot-9", 289.0, 446.0, "NONE"),
      site("slot-10", 209.0, 550.0, "NONE"),
      site("slot-11", 193.0, 302.0, "RUNE_ALTAR"),
      site("slot-12", 377.0, 358.0, "HIGH_GROUND"),
      site("slot-13", 401.0, 222.0, "HIGH_GROUND"),
      site("slot-14", 521.0, 190.0, "NONE"),
    ],
  },
  ABYSSAL_FORTRESS: {
    id: "ABYSSAL_FORTRESS",
    summary: "Two zig-zag wall walks, then into the keep between them.",
    controlPoints: pts([[0, 575], [200, 440], [400, 575], [600, 440], [800, 575], [960, 460], [800, 190], [600, 45], [400, 190], [200, 45], [60, 170], [290, 318], [600, 318]]),
    sites: [
      site("slot-1", 129.0, 422.0, "NONE"),
      site("slot-2", 209.0, 374.0, "RUNE_ALTAR"),
      site("slot-3", 377.0, 462.0, "NONE"),
      site("slot-4", 593.0, 550.0, "NONE"),
      site("slot-5", 497.0, 430.0, "NONE"),
      site("slot-6", 881.0, 510.0, "NONE"),
      site("slot-7", 841.0, 406.0, "HIGH_GROUND"),
      site("slot-8", 601.0, 134.0, "NONE"),
      site("slot-9", 433.0, 110.0, "NONE"),
      site("slot-10", 457.0, 230.0, "NONE"),
      site("slot-11", 321.0, 206.0, "NONE"),
      site("slot-12", 177.0, 118.0, "HIGH_GROUND"),
      site("slot-13", 225.0, 230.0, "NONE"),
      site("slot-14", 417.0, 374.0, "RUNE_ALTAR"),
    ],
  },
  ASHEN_VALLEY: {
    id: "ASHEN_VALLEY",
    summary: "A long meander down a river of ash.",
    controlPoints: pts([[0, 110], [230, 70], [430, 200], [300, 370], [90, 430], [240, 560], [570, 520], [660, 330], [560, 150], [760, 60], [950, 160], [900, 400], [1000, 520]]),
    sites: [
      site("slot-1", 273.0, 182.0, "HIGH_GROUND"),
      site("slot-2", 473.0, 230.0, "NONE"),
      site("slot-3", 337.0, 262.0, "NONE"),
      site("slot-4", 353.0, 430.0, "RUNE_ALTAR"),
      site("slot-5", 193.0, 446.0, "NONE"),
      site("slot-6", 65.0, 566.0, "NONE"),
      site("slot-7", 265.0, 526.0, "NONE"),
      site("slot-8", 441.0, 462.0, "NONE"),
      site("slot-9", 545.0, 318.0, "HIGH_GROUND"),
      site("slot-10", 665.0, 214.0, "NONE"),
      site("slot-11", 505.0, 126.0, "RUNE_ALTAR"),
      site("slot-12", 689.0, 118.0, "NONE"),
      site("slot-13", 817.0, 158.0, "NONE"),
      site("slot-14", 897.0, 206.0, "NONE"),
    ],
  },
  MOON_GARDENS: {
    id: "MOON_GARDENS",
    summary: "A crescent around the moon pool, ending on the island.",
    controlPoints: pts([[0, 330], [140, 130], [450, 60], [780, 110], [940, 300], [800, 500], [470, 550], [220, 470], [300, 330], [560, 250], [750, 320]]),
    sites: [
      site("slot-1", 137.0, 214.0, "NONE"),
      site("slot-2", 401.0, 158.0, "HIGH_GROUND"),
      site("slot-3", 521.0, 110.0, "NONE"),
      site("slot-4", 673.0, 142.0, "NONE"),
      site("slot-5", 889.0, 286.0, "NONE"),
      site("slot-6", 857.0, 382.0, "RUNE_ALTAR"),
      site("slot-7", 777.0, 446.0, "NONE"),
      site("slot-8", 665.0, 494.0, "NONE"),
      site("slot-9", 353.0, 486.0, "NONE"),
      site("slot-10", 169.0, 390.0, "NONE"),
      site("slot-11", 305.0, 406.0, "NONE"),
      site("slot-12", 417.0, 382.0, "HIGH_GROUND"),
      site("slot-13", 521.0, 334.0, "NONE"),
      site("slot-14", 585.0, 190.0, "RUNE_ALTAR"),
    ],
  },
  DEFILED_CATHEDRAL: {
    id: "DEFILED_CATHEDRAL",
    summary: "Traces the cross-shaped floor of the cathedral.",
    controlPoints: pts([[0, 330], [150, 330], [150, 180], [370, 180], [370, 50], [630, 50], [630, 180], [860, 180], [860, 440], [630, 440], [630, 560], [1000, 560]]),
    sites: [
      site("slot-1", 241.0, 350.0, "NONE"),
      site("slot-2", 185.0, 238.0, "NONE"),
      site("slot-3", 97.0, 158.0, "NONE"),
      site("slot-4", 217.0, 134.0, "NONE"),
      site("slot-5", 329.0, 142.0, "NONE"),
      site("slot-6", 409.0, 254.0, "NONE"),
      site("slot-7", 281.0, 46.0, "HIGH_GROUND"),
      site("slot-8", 561.0, 126.0, "RUNE_ALTAR"),
      site("slot-9", 689.0, 222.0, "NONE"),
      site("slot-10", 801.0, 254.0, "HIGH_GROUND"),
      site("slot-11", 929.0, 230.0, "NONE"),
      site("slot-12", 625.0, 366.0, "NONE"),
      site("slot-13", 569.0, 446.0, "NONE"),
      site("slot-14", 705.0, 526.0, "RUNE_ALTAR"),
    ],
  },
  LEVIATHAN_COAST: {
    id: "LEVIATHAN_COAST",
    summary: "Along the shore and out along two piers.",
    controlPoints: pts([[0, 90], [260, 90], [260, 330], [100, 520], [440, 520], [600, 300], [600, 90], [880, 90], [880, 330], [720, 520], [1000, 520]]),
    sites: [
      site("slot-1", 385.0, 198.0, "NONE"),
      site("slot-2", 193.0, 206.0, "NONE"),
      site("slot-3", 337.0, 398.0, "HIGH_GROUND"),
      site("slot-4", 241.0, 430.0, "NONE"),
      site("slot-5", 153.0, 390.0, "NONE"),
      site("slot-6", 81.0, 462.0, "NONE"),
      site("slot-7", 177.0, 502.0, "RUNE_ALTAR"),
      site("slot-8", 369.0, 494.0, "NONE"),
      site("slot-9", 657.0, 206.0, "NONE"),
      site("slot-10", 737.0, 158.0, "NONE"),
      site("slot-11", 825.0, 206.0, "RUNE_ALTAR"),
      site("slot-12", 737.0, 358.0, "HIGH_GROUND"),
      site("slot-13", 689.0, 438.0, "NONE"),
      site("slot-14", 689.0, 550.0, "NONE"),
    ],
  },
};

export const REFERENCE_PATH_LENGTH = getPathLength(ENEMY_PATH);

function categoryFor(distance: number): SlotDistanceCategory {
  return distance < 52 ? "CLOSE" : distance < 70 ? "MEDIUM" : "FAR";
}

function buildLayout(src: LayoutSource): MapLayout {
  const path = src.id === "ANCIENT_FOREST" ? ENEMY_PATH : buildCatmullRomSpline(src.controlPoints, 14);
  const length = getPathLength(path);
  return {
    id: src.id,
    summary: src.summary,
    controlPoints: src.controlPoints,
    path,
    length,
    speedScale: length / REFERENCE_PATH_LENGTH,
    sites: src.sites.map((s) => {
      const position = { x: s.x, y: s.y };
      return { id: s.id, position, trait: s.trait, distanceCategory: categoryFor(distanceToPolyline(position, path)) };
    }),
  };
}

export const MAP_LAYOUTS: Readonly<Record<string, MapLayout>> = Object.fromEntries(
  Object.entries(SOURCES).map(([id, src]) => [id, buildLayout(src)]),
);

/** The layout a biome is played on (unknown ids fall back to the original map). */
export function getMapLayout(biomeId: string): MapLayout {
  return MAP_LAYOUTS[biomeId] ?? MAP_LAYOUTS.ANCIENT_FOREST!;
}

export function getSite(layout: MapLayout, siteId: string): BuildSite | undefined {
  return layout.sites.find((s) => s.id === siteId);
}

// ---------------------------------------------------------------------------
// The map currently being played. Enemy movement reads this; GameEngine sets
// it whenever the run moves onto a different phase's map (the Home screen's
// scene sets it for the map it shows). Defaults to the original map, so
// anything that never sets it behaves exactly as before.
// ---------------------------------------------------------------------------
let activeLayout: MapLayout = MAP_LAYOUTS.ANCIENT_FOREST!;

export function setActiveMapLayout(layout: MapLayout): void {
  activeLayout = layout;
}
export function getActiveMapLayout(): MapLayout {
  return activeLayout;
}

/** True when a road end sits on (or right at) the edge of the playable world. */
export function isOnMapEdge(p: Vector2): boolean {
  return p.x <= 20 || p.x >= WORLD_SIZE.width - 20 || p.y <= 20 || p.y >= WORLD_SIZE.height - 20;
}

/**
 * Where the castle stands for a road: a road that runs off the map's edge
 * keeps the castle set back `inset` units from the edge; a road that ends
 * inland ends AT the castle gate, so no stretch of road pokes out past the
 * walls. (MapRenderer.getFortressAnchor is this with the renderer's inset.)
 */
export function fortressAnchorFor(path: readonly Vector2[], inset = 130): { position: Vector2; facingDir: Vector2 } {
  const end = path[path.length - 1]!;
  const prev = path[path.length - 2]!;
  const len = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
  const dir = { x: (end.x - prev.x) / len, y: (end.y - prev.y) / len };
  const d = isOnMapEdge(end) ? inset : 0;
  return { position: { x: end.x - dir.x * d, y: end.y - dir.y * d }, facingDir: dir };
}

/** The castle's drawn footprint (its sprite is tall: it rises well above its base point). */
export function isInsideCastleFootprint(point: Vector2, castle: Vector2): boolean {
  const dx = point.x - castle.x;
  const dy = point.y - castle.y;
  return Math.abs(dx) < 105 && dy > -175 && dy < 60;
}
