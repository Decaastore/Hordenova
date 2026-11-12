/**
 * REGRA DA SEASON — every Season brings one rule that changes how it plays,
 * the same for everyone, so each Season feels different. Each rule pairs an
 * upside with a downside so the slow pace stays the same. The rule applies
 * to the Season castle only — never to the Eternal castle or the Duel.
 */
export type SeasonRuleId = "SWIFT_HORDE" | "STONE_WALLS" | "GOLD_RUSH" | "SHARP_EYES" | "LONG_REACH" | "BRUTAL_HORDE";

export interface SeasonRule {
  id: SeasonRuleId;
  enemySpeedPct: number;
  enemyHpPct: number;
  killGoldPct: number;
  castleHpPct: number;
  rangePct: number;
  critPct: number;
  attackSpeedPct: number;
}

const R = (id: SeasonRuleId, p: Partial<Omit<SeasonRule, "id">>): SeasonRule => ({
  id,
  enemySpeedPct: 0,
  enemyHpPct: 0,
  killGoldPct: 0,
  castleHpPct: 0,
  rangePct: 0,
  critPct: 0,
  attackSpeedPct: 0,
  ...p,
});

export const SEASON_RULES: readonly SeasonRule[] = [
  R("SWIFT_HORDE", { enemySpeedPct: 10, killGoldPct: 10 }),
  R("STONE_WALLS", { castleHpPct: 25, rangePct: -4 }),
  R("GOLD_RUSH", { killGoldPct: 15, enemyHpPct: 8 }),
  R("SHARP_EYES", { critPct: 5, enemyHpPct: 5 }),
  R("LONG_REACH", { rangePct: 6, attackSpeedPct: -4 }),
  R("BRUTAL_HORDE", { enemyHpPct: 10, killGoldPct: 10 }),
];

/** The rule of a Season — rotates through the list, the same for every player. */
export function getSeasonRule(seasonNumber: number): SeasonRule {
  return SEASON_RULES[(Math.max(1, Math.floor(seasonNumber)) - 1) % SEASON_RULES.length]!;
}
