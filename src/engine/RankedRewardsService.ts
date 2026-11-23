import { lastPrizePlace, rankedPrizeParts, type RankedBoard } from "@/config/rankedRewards";
import { applyRewardParts } from "./RewardGrant";
import { loadSave, updateSave, type SaveData } from "./SaveSystem";

/**
 * Grants a ranking prize (config/rankedRewards.ts) for a FINAL placement on
 * the online ranking — the only source of a real placement. Each
 * board+period pays once (SaveData.rankedPrizesGranted), so a repeated call
 * (reconnect, refresh) never pays twice. A place outside the prizes records
 * the period as settled and grants nothing.
 */
export function grantRankedPlacement(board: RankedBoard, periodKey: string, place: number): { granted: boolean; save: SaveData } {
  const save = loadSave();
  const key = `${board}:${periodKey}`;
  if (save.rankedPrizesGranted.includes(key)) return { granted: false, save };
  const parts = place >= 1 && place <= lastPrizePlace(board) ? rankedPrizeParts(board, place) : null;
  const patch = parts ? applyRewardParts(save, parts, { type: "RANKED", refId: `${key}:#${place}` }) : {};
  return { granted: !!parts, save: updateSave({ ...patch, rankedPrizesGranted: [...save.rankedPrizesGranted, key].slice(-200), rankedTrophies: parts ? [...save.rankedTrophies, { board, period: periodKey, place, atMs: Date.now() }].slice(-200) : save.rankedTrophies }) };
}
