import { TOWER_DEFINITIONS, type TowerType } from "./towerStats";

/**
 * Master Implementation Pass spec sections 3-6 — TOWER MASTERY: the sink
 * that exists past MAX_TOWER_LEVEL (30). Level 30 stays the last
 * VISUAL evolution and the last step of the existing level-driven special
 * unlocks (multiShot/giantSlayer/wildfire/deepFreeze/arcaneSurge/etc, all
 * in towerStats.ts, all untouched) — Mastery is a SEPARATE, uncapped track
 * layered on top, exactly mirroring how config/specializations.ts already
 * layers an independent, optional gold-sink track next to level.
 *
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — MASTERY NÃO COMPRA MAIS
 * PODER: a versão anterior deste arquivo aplicava um multiplicador
 * uniforme de damage/attackSpeed/range em `entities/Tower.ts`'s
 * getTowerStats, crescendo linearmente com masteryLevel. Isso criava
 * exatamente o padrão "Gems -> Mastery -> +X% DPS" que o design da Season
 * competitiva proíbe (Gems nunca devem comprar poder de combate permanente
 * — ver gemSinks.ts). Esse multiplicador foi REMOVIDO por completo:
 * getTowerStats agora ignora masteryLevel inteiramente (ver o teste de
 * regressão permanente em entities/Tower.test.ts que trava isso).
 *
 * NOVA FUNÇÃO DE MASTERY — o mesmo `masteryLevel`/mesma curva de custo em
 * Gems foram mantidos (estrutura mínima necessária, spec explícita: "não
 * inventar um sistema novo e desconectado"), mas o que ele concede mudou de
 * "poder" para "prestígio/estratégia":
 *   1. RESPEC TOKEN — a cada MASTERY_RESPEC_TOKEN_INTERVAL níveis (5) o
 *      jogador ganha exatamente 1 token, calculado como uma função pura de
 *      masteryLevel (getMasteryRespecTokensEarned), nunca um contador
 *      incrementado à parte — por isso é IDEMPOTENTE: recarregar/reiniciar
 *      nunca reconcede um token, o valor é sempre recomputado a partir do
 *      nível atual menos os já gastos (ver getAvailableRespecTokens e
 *      SaveData.towerRespecTokensSpent).
 *   2. COSMÉTICO PERMANENTE — uma faixa visual (anel/aura/runas, ver
 *      MASTERY_COSMETIC_TIERS) calculada DIRETAMENTE de masteryLevel, nunca
 *      de stats de combate — puramente decorativo, lido apenas pelo
 *      renderer (EntityRenderer/CanvasRenderer), nunca por CombatSystem.
 *
 * SAFETY: cost curve is convex (spec section 5: "não permitir comprar
 * milhares instantaneamente") but uses the exact same overflow-safety
 * pattern as enemyStats.ts's HP scaling (compounding capped at a very high
 * level index, linear tail beyond it) — genuinely uncapped, never
 * Infinity/NaN, at any mastery level a save could ever reach. Calibrated
 * via engine/ProgressionSimulation.test.ts's real-engine bot simulation,
 * not guessed (spec section 5's own instruction). This cost curve itself is
 * UNCHANGED by the competitive correction above — only what the level buys
 * changed, not what it costs.
 *
 * CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE) — CURRENCY CHANGED, CURVE
 * RE-CALIBRATED: Mastery moved from Gold to Gems (see gemSinks.ts), and
 * MASTERY_BASE_COST_MULTIPLIER was rescaled down from its old Gold-shaped
 * value (240) to a Gems-appropriate one — Gems and Gold are wildly
 * different orders of magnitude in this economy (a Specialization unlock
 * is a flat 25 Gems; Profile Prestige starts at 3 Gems), and Gem Shards
 * only trickle in from boss/mini-boss kills (5/2 shards, 10 shards = 1 Gem
 * — see GameEngine's addGemShards call sites). Reusing the old Gold-scaled
 * multiplier verbatim (as a naive "just swap the currency" change would)
 * made even Mastery's FIRST level cost ~10,000 Gems — realistically
 * unreachable, which engine/ProgressionSimulation.test.ts's real 48-simulated-
 * hour bot run caught directly (avgMasteryLevel stayed exactly 0). This
 * value was re-tuned against that same test until Mastery became a
 * genuinely reachable-but-meaningful Gems sink again — first level costs
 * on the order of a Specialization unlock, growing from there.
 */

/** Every N mastery levels grants exactly 1 Specialization Respec Token (5 -> 1, 10 -> 2, 15 -> 3, ...). */
export const MASTERY_RESPEC_TOKEN_INTERVAL = 5;

/**
 * Pure function of `masteryLevel` — NEVER a stored/incremented counter, so
 * it can never double-grant on a reload/restart. The engine tracks only how
 * many of these have been SPENT (SaveData.towerRespecTokensSpent, same
 * per-TowerType persistence shape as towerMasteryLevels) and subtracts that
 * from this to get what's currently available (getAvailableRespecTokens).
 */
export function getMasteryRespecTokensEarned(masteryLevel: number): number {
  return Math.floor(Math.max(0, masteryLevel) / MASTERY_RESPEC_TOKEN_INTERVAL);
}

/** Tokens earned so far minus tokens already spent — never negative. */
export function getAvailableRespecTokens(masteryLevel: number, tokensSpent: number): number {
  return Math.max(0, getMasteryRespecTokensEarned(masteryLevel) - Math.max(0, tokensSpent));
}

export interface MasteryCosmeticTier {
  /** Stable id — used as a rendering key, never shown raw to the player. */
  id: string;
  /** i18n key suffix — full key is `towerInfo.masteryCosmetic.${nameKey}`. */
  nameKey: string;
  /** Mastery level this tier unlocks at (inclusive). */
  level: number;
}

/**
 * Cosmetic tiers unlocked purely by masteryLevel — ring/aura/runes reward
 * bands, spec section on "Mastery Cosmético". Deliberately never read by
 * CombatSystem; only EntityRenderer/TowerInfoPanel ever call these.
 */
export const MASTERY_COSMETIC_TIERS: readonly MasteryCosmeticTier[] = [
  { id: "ember_ring", nameKey: "emberRing", level: 5 },
  { id: "veteran_aura", nameKey: "veteranAura", level: 15 },
  { id: "runic_sigils", nameKey: "runicSigils", level: 30 },
  { id: "ascendant_halo", nameKey: "ascendantHalo", level: 60 },
  { id: "mythic_crown", nameKey: "mythicCrown", level: 120 },
];

/** Highest cosmetic tier reached at `masteryLevel`, or null if below the first tier's threshold. */
export function getMasteryCosmeticTier(masteryLevel: number): MasteryCosmeticTier | null {
  let current: MasteryCosmeticTier | null = null;
  for (const tier of MASTERY_COSMETIC_TIERS) {
    if (masteryLevel >= tier.level) current = tier;
  }
  return current;
}

/** The next tier still ahead of `masteryLevel` (for "next reward" UI), or null once every tier is unlocked. */
export function getNextMasteryCosmeticTier(masteryLevel: number): MasteryCosmeticTier | null {
  return MASTERY_COSMETIC_TIERS.find((tier) => masteryLevel < tier.level) ?? null;
}

const MASTERY_BASE_COST_MULTIPLIER = 0.5;
const MASTERY_COST_GROWTH_FACTOR = 1.05;
/** Numerical safety (same technique as enemyStats.ts HP\_COMPOUND_WAVE_INDEX_CAP): compounding growth stops accelerating beyond this mastery level, but cost keeps climbing forever via the linear tail below — never Infinity/NaN at any mastery level, "SEM CAP REAL" on progression while staying finite. */
const MASTERY_COST_COMPOUND_LEVEL_CAP = 2000;
/** Cost growth rate applied per level once past the compounding cap — purely linear, so it can never overflow no matter how many levels a save accumulates. */
const MASTERY_COST_LINEAR_TAIL_GROWTH = 0.5;

/**
 * Gems cost to go from `currentMasteryLevel` to `currentMasteryLevel + 1`.
 * No max level — always returns a real (finite) number. `currentMasteryLevel`
 * is expected to be >= 0.
 */
export function getMasteryUpgradeCost(type: TowerType, currentMasteryLevel: number): number {
  const def = TOWER_DEFINITIONS[type];
  const targetLevel = currentMasteryLevel + 1;
  const cappedLevel = Math.min(targetLevel, MASTERY_COST_COMPOUND_LEVEL_CAP);
  const compound = Math.pow(MASTERY_COST_GROWTH_FACTOR, cappedLevel);
  const tailLevels = Math.max(0, targetLevel - MASTERY_COST_COMPOUND_LEVEL_CAP);
  const linearTail = 1 + tailLevels * MASTERY_COST_LINEAR_TAIL_GROWTH;
  return Math.round(def.upgradeCostBase * MASTERY_BASE_COST_MULTIPLIER * compound * linearTail);
}
