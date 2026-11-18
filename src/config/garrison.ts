/**
 * GUARNIÇÃO — the castle's own soldiers. Archers on the four towers and the
 * walls who shoot ONLY at Bosses and Mini-Bosses that come near the gate;
 * the ordinary horde is never their business (that is the towers' job).
 *
 * Bought with Gold, level by level, per castle: the Season castle's
 * garrison starts over with each Season (like its towers); the Eternal
 * castle keeps its garrison for good. A Hunt borrows the Season castle's.
 *
 * Damage is a share of the boss's max life per second, so it stays the same
 * size of help from wave 10 to wave 1,000: at the top level the garrison
 * takes about GARRISON_DPS_PCT_PER_LEVEL x 10 % of a boss's life every
 * second it spends near the gate. A Boss blow on the castle knocks the
 * soldiers off the walls for GARRISON_STUN_MS.
 */
export const GARRISON_MAX_LEVEL = 10;
/** % of the target's max HP per second, per garrison level. */
export const GARRISON_DPS_PCT_PER_LEVEL = 0.15;
/** Seconds between volleys. */
export const GARRISON_VOLLEY_MS = 900;
/** How far along the road from the gate the archers reach. */
export const GARRISON_ROAD_RANGE = 230;
/** How long a Boss blow on the castle keeps the soldiers down. */
export const GARRISON_STUN_MS = 3500;
/** Inside a Hunt the garrison hits this much as hard (hunts stay hard). */
export const GARRISON_HUNT_FACTOR = 0.5;

/** Gold for the NEXT level after `level`, or null at the top. */
export function garrisonUpgradeCost(level: number): number | null {
  if (level >= GARRISON_MAX_LEVEL || level < 0) return null;
  return Math.round(250 * Math.pow(level + 1, 1.8) / 10) * 10;
}

/** How many soldiers stand on the walls at `level` (the picture: 2 at level 1, then one more per level, 12 at the top). */
export function garrisonSoldiers(level: number): number {
  return level <= 0 ? 0 : Math.min(12, level + 1);
}

/** Damage of one volley against a target with `maxHp`. */
export function garrisonVolleyDamage(level: number, maxHp: number, hunt = false): number {
  if (level <= 0) return 0;
  const pctPerSecond = (GARRISON_DPS_PCT_PER_LEVEL * Math.min(level, GARRISON_MAX_LEVEL)) / 100;
  return maxHp * pctPerSecond * (GARRISON_VOLLEY_MS / 1000) * (hunt ? GARRISON_HUNT_FACTOR : 1);
}

export function sanitizeGarrisonLevel(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.min(GARRISON_MAX_LEVEL, Math.floor(raw)) : 0;
}
