import { MAIN_BOSSES, MINI_BOSSES, type BossDefinition } from "./bossConfig";

/**
 * BESTIÁRIO DOS CHEFES — every main boss and mini-boss you defeat counts on
 * its own page, account-wide (never reset by the Season). A boss earns a
 * bronze, silver and gold star at 1, 3 and 10 defeats. The Boss album
 * (config/collections.ts) asks for a silver star on EVERY boss: a phase's
 * main boss only shows up once per pass, so getting there means fighting
 * old phases again in Hunt mode (config/hunt.ts).
 */
export const BOSS_STARS = [1, 3, 10] as const;
export const BOSS_ALBUM_STARS = 2;

export type BossKills = Record<string, number>;

export const ALL_BOSSES: readonly BossDefinition[] = [...Object.values(MAIN_BOSSES), ...Object.values(MINI_BOSSES)];

export function bossStars(kills: number): number {
  return BOSS_STARS.filter((n) => kills >= n).length;
}

export function bossMastered(kills: number): boolean {
  return bossStars(kills) >= BOSS_ALBUM_STARS;
}

export function bossBestiaryStats(kills: Readonly<BossKills>): { total: number; met: number; mastered: number } {
  let total = 0;
  let met = 0;
  let mastered = 0;
  for (const b of ALL_BOSSES) {
    const n = kills[b.id] ?? 0;
    total += n;
    if (n > 0) met += 1;
    if (bossMastered(n)) mastered += 1;
  }
  return { total, met, mastered };
}

/** Keeps only known boss ids with whole, positive counts. */
export function sanitizeBossKills(raw: unknown): BossKills {
  const out: BossKills = {};
  if (!raw || typeof raw !== "object") return out;
  for (const b of ALL_BOSSES) {
    const v = (raw as Record<string, unknown>)[b.id];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[b.id] = Math.floor(v);
  }
  return out;
}
