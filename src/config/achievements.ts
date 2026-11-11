import { ENEMY_TYPES, type EnemyType } from "./enemyStats";

/**
 * BESTIÁRIO E CONQUISTAS — long-term goals that never reset with the Season.
 *
 * Bestiary: every creature you defeat counts towards its page. At 10, 100
 * and 1,000 defeats it earns a bronze, silver and gold star.
 *
 * Achievements: real milestones of your account. Each one unlocks a title
 * you can wear; the title shows next to your name on the Ranking. Purely
 * prestige — no achievement grants power.
 */
export const BESTIARY_STARS = [10, 100, 1000] as const;

export type BestiaryKills = Partial<Record<EnemyType, number>>;

/** 0 to 3 stars for a creature's defeat count. */
export function bestiaryStars(kills: number): number {
  return BESTIARY_STARS.filter((n) => kills >= n).length;
}

export interface AchievementStats {
  totalKills: number;
  bossesDefeated: number;
  miniBossesDefeated: number;
  riftsCleared: number;
  bestWave: number;
  /** Highest rarity ever found, 0 (Common) to 5 (Mythic); -1 for none. */
  bestRarityFound: number;
  /** Creatures with the gold star (1,000 defeats). */
  goldStarCreatures: number;
  /** Creatures defeated at least once. */
  creaturesMet: number;
}

export type AchievementId =
  | "KILLS_100"
  | "KILLS_10K"
  | "KILLS_100K"
  | "WAVE_50"
  | "WAVE_150"
  | "WAVE_300"
  | "BOSSES_10"
  | "MINIBOSSES_50"
  | "RIFTS_10"
  | "FIND_EPIC"
  | "FIND_LEGENDARY"
  | "MET_ALL"
  | "GOLD_STARS_10";

export interface AchievementDefinition {
  id: AchievementId;
  /** Current value and target, for the progress bar. */
  progress: (s: AchievementStats) => [number, number];
}

const at = (value: number, target: number): [number, number] => [Math.min(value, target), target];

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: "KILLS_100", progress: (s) => at(s.totalKills, 100) },
  { id: "KILLS_10K", progress: (s) => at(s.totalKills, 10_000) },
  { id: "KILLS_100K", progress: (s) => at(s.totalKills, 100_000) },
  { id: "WAVE_50", progress: (s) => at(s.bestWave, 50) },
  { id: "WAVE_150", progress: (s) => at(s.bestWave, 150) },
  { id: "WAVE_300", progress: (s) => at(s.bestWave, 300) },
  { id: "BOSSES_10", progress: (s) => at(s.bossesDefeated, 10) },
  { id: "MINIBOSSES_50", progress: (s) => at(s.miniBossesDefeated, 50) },
  { id: "RIFTS_10", progress: (s) => at(s.riftsCleared, 10) },
  { id: "FIND_EPIC", progress: (s) => at(Math.max(0, s.bestRarityFound >= 3 ? 1 : 0), 1) },
  { id: "FIND_LEGENDARY", progress: (s) => at(Math.max(0, s.bestRarityFound >= 4 ? 1 : 0), 1) },
  { id: "MET_ALL", progress: (s) => at(s.creaturesMet, ENEMY_TYPES.length) },
  { id: "GOLD_STARS_10", progress: (s) => at(s.goldStarCreatures, 10) },
];

const IDS = new Set<string>(ACHIEVEMENTS.map((a) => a.id));

export function isAchievementId(v: unknown): v is AchievementId {
  return typeof v === "string" && IDS.has(v);
}

/** Achievements whose target is reached by these stats. */
export function reachedAchievements(stats: AchievementStats): AchievementId[] {
  return ACHIEVEMENTS.filter((a) => {
    const [cur, target] = a.progress(stats);
    return cur >= target;
  }).map((a) => a.id);
}

export function bestiaryStats(kills: BestiaryKills): { total: number; met: number; goldStars: number } {
  let total = 0;
  let met = 0;
  let goldStars = 0;
  for (const type of ENEMY_TYPES) {
    const n = kills[type] ?? 0;
    total += n;
    if (n > 0) met += 1;
    if (bestiaryStars(n) === 3) goldStars += 1;
  }
  return { total, met, goldStars };
}

export function sanitizeBestiaryKills(raw: unknown): BestiaryKills {
  const out: BestiaryKills = {};
  if (!raw || typeof raw !== "object") return out;
  for (const type of ENEMY_TYPES) {
    const v = (raw as Record<string, unknown>)[type];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[type] = Math.floor(v);
  }
  return out;
}
