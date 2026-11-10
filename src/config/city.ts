/**
 * O CASTELO VIRA CIDADE — behind the castle walls a city grows as the
 * player pushes deeper into the Season. Each building rises the first time
 * the Season's best wave reaches its mark, and every standing building pays
 * a small share of each cleared wave's gold (the city's own idle income).
 *
 * When the horde gets through to the castle, a building catches fire and
 * pays nothing until the city rebuilds it: a few waves cleared without any
 * creature reaching the castle. Same rule for everyone, nothing to buy.
 *
 * Season-scoped like the rest of the run: the city is derived from
 * seasonBestWave, so a new Season starts with an empty plain again.
 */

export type CityBuildingId = "HOUSES" | "FARM" | "MARKET" | "SMITHY" | "TAVERN" | "CHAPEL" | "MAGE_TOWER" | "TREASURY";

export interface CityBuildingDefinition {
  id: CityBuildingId;
  /** Season best wave that raises this building. */
  unlockWave: number;
  /** Share of each cleared wave's kill gold this building adds while standing (0.02 = +2%). */
  goldShare: number;
}

/** In build order — also the order the renderer places them around the castle. */
export const CITY_BUILDINGS: readonly CityBuildingDefinition[] = [
  { id: "HOUSES", unlockWave: 10, goldShare: 0.01 },
  { id: "FARM", unlockWave: 20, goldShare: 0.01 },
  { id: "MARKET", unlockWave: 35, goldShare: 0.02 },
  { id: "SMITHY", unlockWave: 50, goldShare: 0.01 },
  { id: "TAVERN", unlockWave: 70, goldShare: 0.02 },
  { id: "CHAPEL", unlockWave: 95, goldShare: 0.01 },
  { id: "MAGE_TOWER", unlockWave: 125, goldShare: 0.02 },
  { id: "TREASURY", unlockWave: 160, goldShare: 0.02 },
];

/** Clean waves (no creature reached the castle) a burning building needs before it's rebuilt. */
export const CITY_REBUILD_WAVES = 3;
/** Buildings set alight by one wave in which creatures reached the castle; a main boss reaching it sets one more. */
export const CITY_FIRES_PER_LEAKED_WAVE = 1;
export const CITY_FIRES_PER_BOSS_BREACH = 1;

export interface CityState {
  /** Burning buildings -> clean waves still needed to rebuild. */
  burning: Partial<Record<CityBuildingId, number>>;
  /** Fires started so far — feeds the deterministic choice of which building burns next. */
  firesStarted: number;
}

export function createCityState(): CityState {
  return { burning: {}, firesStarted: 0 };
}

export function builtBuildings(seasonBestWave: number): CityBuildingDefinition[] {
  return CITY_BUILDINGS.filter((b) => seasonBestWave >= b.unlockWave);
}

export function nextBuilding(seasonBestWave: number): CityBuildingDefinition | null {
  return CITY_BUILDINGS.find((b) => seasonBestWave < b.unlockWave) ?? null;
}

/** Total share of a wave's kill gold the standing (built, not burning) buildings pay. */
export function cityGoldShare(seasonBestWave: number, state: CityState): number {
  return builtBuildings(seasonBestWave).reduce((s, b) => (state.burning[b.id] ? s : s + b.goldShare), 0);
}

/**
 * Sets `count` standing buildings on fire. Which one is a fixed rotation
 * over the standing buildings (no luck involved), so the same sequence of
 * events always burns the same buildings. Returns the ids set alight.
 */
export function igniteBuildings(seasonBestWave: number, state: CityState, count: number): CityBuildingId[] {
  const lit: CityBuildingId[] = [];
  for (let i = 0; i < count; i++) {
    const standing = builtBuildings(seasonBestWave).filter((b) => !state.burning[b.id]);
    if (standing.length === 0) break;
    const pick = standing[state.firesStarted % standing.length]!;
    state.burning[pick.id] = CITY_REBUILD_WAVES;
    state.firesStarted += 1;
    lit.push(pick.id);
  }
  return lit;
}

/** A wave was cleared without any creature reaching the castle: every fire burns down one step. Returns the ids rebuilt. */
export function advanceRebuild(state: CityState): CityBuildingId[] {
  const rebuilt: CityBuildingId[] = [];
  for (const [id, left] of Object.entries(state.burning) as [CityBuildingId, number][]) {
    if (left <= 1) {
      delete state.burning[id];
      rebuilt.push(id);
    } else state.burning[id] = left - 1;
  }
  return rebuilt;
}

export function sanitizeCityState(raw: unknown): CityState {
  const fresh = createCityState();
  if (!raw || typeof raw !== "object") return fresh;
  const r = raw as { burning?: Record<string, unknown>; firesStarted?: unknown };
  if (typeof r.firesStarted === "number" && Number.isFinite(r.firesStarted) && r.firesStarted >= 0) fresh.firesStarted = Math.floor(r.firesStarted);
  for (const b of CITY_BUILDINGS) {
    const v = r.burning?.[b.id];
    if (typeof v === "number" && v > 0) fresh.burning[b.id] = Math.min(CITY_REBUILD_WAVES, Math.ceil(v));
  }
  return fresh;
}
