import type { RewardBundle } from "@/config/rewardBundle";
import { appendLedgerEvent } from "./EconomyLedger";
import type { SaveData } from "./SaveSystem";

/** The save fields a bundle changes (pages edit the save directly; no engine runs there). Free Gems and Shards go to the ledger. */
export function grantBundle(cur: SaveData, b: RewardBundle, source: string): Partial<SaveData> {
  const gems = b.freeGems ?? 0;
  const shards = b.shards ?? 0;
  if (gems > 0) appendLedgerEvent({ eventType: "GEMS_EARNED", fromOwner: null, toOwner: cur.playerId, source, amount: gems, currency: "FREE" });
  if (shards > 0) appendLedgerEvent({ eventType: "GEM_SHARDS_EARNED", fromOwner: null, toOwner: cur.playerId, source, amount: shards });
  const e = cur.expeditions;
  const out: Partial<SaveData> = {
    gold: cur.gold + (b.gold ?? 0),
    freeGems: cur.freeGems + gems,
    gemShards: cur.gemShards + shards,
    expeditions: {
      ...e,
      splinters: e.splinters + (b.splinters ?? 0),
      essences: { ...e.essences, RARE: e.essences.RARE + (b.rare ?? 0), EPIC: e.essences.EPIC + (b.epic ?? 0) },
    },
  };
  if (b.castleSkinId && !cur.unlockedCastleSkinIds.includes(b.castleSkinId)) out.unlockedCastleSkinIds = [...cur.unlockedCastleSkinIds, b.castleSkinId];
  return out;
}
