/**
 * ÁRVORE DE TALENTOS DO CASTELO — every 10 waves of your Season record give
 * one talent point to spend across three branches: War (your towers hit
 * harder), Gold (more income) and Wall (the castle holds longer). Each
 * branch is a path: a talent opens once the one before it has at least one
 * point. There are more ranks than a full Season gives points, so every
 * Season is a choice of style. Points come back for free whenever you
 * reset, and the whole tree resets with the Season (it follows the Season
 * record). Same rules for everyone.
 *
 * Every effect is small and per rank; numbers here are the whole truth and
 * the panel shows them as they are.
 */
export type TalentBranch = "WAR" | "GOLD" | "WALL";

export type TalentId =
  | "W_BLADES"
  | "W_HASTE"
  | "W_HUNTER"
  | "W_CRIT"
  | "W_CARNAGE"
  | "G_LOOT"
  | "G_TITHE"
  | "G_ELITE"
  | "G_RIFT"
  | "G_KING"
  | "M_STONE"
  | "M_REPAIR"
  | "M_MOAT"
  | "M_WATCH"
  | "M_LASTSTAND";

export type TalentStat =
  | "damagePct"
  | "attackSpeedPct"
  | "bossDamagePct"
  | "critChancePct"
  | "killGoldPct"
  | "cityShareP"
  | "eliteShardP"
  | "riftRewardPct"
  | "castleDamageReductionPct"
  | "castleRepairPct"
  | "enemySlowPct"
  | "rangePct"
  | "lastStandDamagePct";

export interface TalentDefinition {
  id: TalentId;
  branch: TalentBranch;
  /** Position in its branch, 0 = first. A talent needs the previous one in its branch to have a point. */
  tier: number;
  maxRank: number;
  stat: TalentStat;
  /** Effect per rank (percent, or percentage points for the "P" stats). */
  perRank: number;
}

export const TALENTS: readonly TalentDefinition[] = [
  { id: "W_BLADES", branch: "WAR", tier: 0, maxRank: 3, stat: "damagePct", perRank: 2 },
  { id: "W_HASTE", branch: "WAR", tier: 1, maxRank: 3, stat: "attackSpeedPct", perRank: 2 },
  { id: "W_HUNTER", branch: "WAR", tier: 2, maxRank: 3, stat: "bossDamagePct", perRank: 5 },
  { id: "W_CRIT", branch: "WAR", tier: 3, maxRank: 2, stat: "critChancePct", perRank: 2 },
  { id: "W_CARNAGE", branch: "WAR", tier: 4, maxRank: 1, stat: "damagePct", perRank: 6 },
  { id: "G_LOOT", branch: "GOLD", tier: 0, maxRank: 3, stat: "killGoldPct", perRank: 2 },
  { id: "G_TITHE", branch: "GOLD", tier: 1, maxRank: 2, stat: "cityShareP", perRank: 1 },
  { id: "G_ELITE", branch: "GOLD", tier: 2, maxRank: 2, stat: "eliteShardP", perRank: 2 },
  { id: "G_RIFT", branch: "GOLD", tier: 3, maxRank: 2, stat: "riftRewardPct", perRank: 15 },
  { id: "G_KING", branch: "GOLD", tier: 4, maxRank: 1, stat: "killGoldPct", perRank: 5 },
  { id: "M_STONE", branch: "WALL", tier: 0, maxRank: 3, stat: "castleDamageReductionPct", perRank: 4 },
  { id: "M_REPAIR", branch: "WALL", tier: 1, maxRank: 3, stat: "castleRepairPct", perRank: 2 },
  { id: "M_MOAT", branch: "WALL", tier: 2, maxRank: 2, stat: "enemySlowPct", perRank: 3 },
  { id: "M_WATCH", branch: "WALL", tier: 3, maxRank: 2, stat: "rangePct", perRank: 3 },
  { id: "M_LASTSTAND", branch: "WALL", tier: 4, maxRank: 1, stat: "lastStandDamagePct", perRank: 15 },
];

export const TALENT_BRANCHES: readonly TalentBranch[] = ["WAR", "GOLD", "WALL"];

/** One point per this many waves of the Season record. */
export const WAVES_PER_TALENT_POINT = 10;
/** LAST STAND kicks in below this share of castle life. */
export const LAST_STAND_HP_FRACTION = 0.3;

export type TalentRanks = Partial<Record<TalentId, number>>;

const BY_ID = new Map(TALENTS.map((t) => [t.id, t]));

export function getTalent(id: TalentId): TalentDefinition {
  return BY_ID.get(id)!;
}

export function talentPointsEarned(seasonBestWave: number): number {
  return Math.max(0, Math.floor(seasonBestWave / WAVES_PER_TALENT_POINT));
}

export function talentPointsSpent(ranks: TalentRanks): number {
  return Object.values(ranks).reduce((sum, r) => sum + (r ?? 0), 0);
}

export function talentPointsFree(ranks: TalentRanks, seasonBestWave: number): number {
  return Math.max(0, talentPointsEarned(seasonBestWave) - talentPointsSpent(ranks));
}

/** The talent before this one in its branch (null for the first). */
export function talentRequirement(id: TalentId): TalentId | null {
  const def = getTalent(id);
  return TALENTS.find((t) => t.branch === def.branch && t.tier === def.tier - 1)?.id ?? null;
}

export function canRaiseTalent(ranks: TalentRanks, id: TalentId, seasonBestWave: number): boolean {
  const def = BY_ID.get(id);
  if (!def) return false;
  if ((ranks[id] ?? 0) >= def.maxRank) return false;
  if (talentPointsFree(ranks, seasonBestWave) <= 0) return false;
  const req = talentRequirement(id);
  return req === null || (ranks[req] ?? 0) > 0;
}

export type TalentBonus = Record<TalentStat, number>;

export function talentBonus(ranks: TalentRanks): TalentBonus {
  const bonus = Object.fromEntries(TALENTS.map((t) => [t.stat, 0])) as TalentBonus;
  for (const t of TALENTS) bonus[t.stat] += (ranks[t.id] ?? 0) * t.perRank;
  return bonus;
}

/**
 * Keeps only real talents with ranks inside their limits, drops any talent
 * whose path is broken, and gives points back if the save spends more than
 * the record allows (from the end of each branch first).
 */
export function sanitizeTalentRanks(raw: unknown, seasonBestWave: number): TalentRanks {
  const ranks: TalentRanks = {};
  if (raw && typeof raw === "object") {
    for (const t of TALENTS) {
      const v = (raw as Record<string, unknown>)[t.id];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) ranks[t.id] = Math.min(t.maxRank, Math.floor(v));
    }
  }
  for (const t of [...TALENTS].sort((a, b) => a.tier - b.tier)) {
    const req = talentRequirement(t.id);
    if (req && !(ranks[req] ?? 0)) delete ranks[t.id];
  }
  const earned = talentPointsEarned(seasonBestWave);
  const byTierDesc = [...TALENTS].sort((a, b) => b.tier - a.tier);
  while (talentPointsSpent(ranks) > earned) {
    const top = byTierDesc.find((t) => (ranks[t.id] ?? 0) > 0)!;
    const next = (ranks[top.id] ?? 0) - 1;
    if (next > 0) ranks[top.id] = next;
    else delete ranks[top.id];
  }
  return ranks;
}
