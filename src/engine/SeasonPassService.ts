import { loadSave, updateSave, type SaveData } from "./SaveSystem";
import { appendLedgerEvent } from "./EconomyLedger";
import { seasonClock } from "./SeasonClock";
import { freeRewardForLevel, freshPassState, PASS_LEVELS, PASS_XP_PER_LEVEL, passLevelFromXp, type SeasonPassState } from "@/config/seasonPass";

/**
 * SEASON PASS — read and claimed from the Season page, straight on the save
 * (same pattern as StoreService/MarketplaceService). XP itself is earned in
 * game (GameEngine.addPassXp).
 */

export function currentPassState(save: SaveData = loadSave()): SeasonPassState {
  const season = seasonClock.getCurrentSeasonWindow().seasonNumber;
  return save.seasonPass && save.seasonPass.seasonNumber === season ? save.seasonPass : freshPassState(season);
}

export interface PassView {
  level: number;
  xp: number;
  /** XP into the current level, and the size of a level. */
  xpIntoLevel: number;
  xpPerLevel: number;
  claimedFree: ReadonlySet<number>;
  /** Free levels reached but not yet claimed. */
  claimable: number[];
}

export function getPassView(save: SaveData = loadSave()): PassView {
  const state = currentPassState(save);
  const level = passLevelFromXp(state.xp);
  const claimed = new Set(state.claimedFree);
  const claimable: number[] = [];
  for (let l = 1; l <= level; l++) if (!claimed.has(l)) claimable.push(l);
  return {
    level,
    xp: state.xp,
    xpIntoLevel: level >= PASS_LEVELS ? PASS_XP_PER_LEVEL : state.xp % PASS_XP_PER_LEVEL,
    xpPerLevel: PASS_XP_PER_LEVEL,
    claimedFree: claimed,
    claimable,
  };
}

/** Claims one reached free-track level. Returns the new save, or null if it isn't claimable. */
export function claimFreePassLevel(level: number): SaveData | null {
  const save = loadSave();
  const state = currentPassState(save);
  if (level < 1 || level > passLevelFromXp(state.xp) || state.claimedFree.includes(level)) return null;
  const reward = freeRewardForLevel(level);
  if (reward.gemShards > 0) appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: save.playerId, source: `season_pass:${level}`, amount: reward.gemShards });
  if (reward.freeGems > 0) appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: save.playerId, source: `season_pass:${level}`, amount: reward.freeGems, currency: "FREE" });
  return updateSave({
    gemShards: save.gemShards + reward.gemShards,
    freeGems: save.freeGems + reward.freeGems,
    seasonPass: { ...state, claimedFree: [...state.claimedFree, level] },
  });
}

/** Claims every reached free level at once. */
export function claimAllFreePassLevels(): SaveData {
  let save = loadSave();
  for (const level of getPassView(save).claimable) save = claimFreePassLevel(level) ?? save;
  return save;
}
