import { getPhaseForWave, isMiniBossWaveInPhase } from "./phaseConfig";

/**
 * Boss/mini-boss data table. Content Progression spec sections 6/7/8:
 * multiple bosses now exist (one per phase/biome), and mini-bosses have a
 * real roster of archetypes instead of one reskinned constant — but
 * nothing about HOW a boss fights lives outside this file's data plus
 * BossManager.ts's small, archetype-agnostic ability dispatch. Adding a
 * 7th biome's boss later is one more entry here, never an engine change.
 *
 * Every MAIN boss automatically gets a second, more dangerous phase for
 * free (see BossManager's Enrage — triggers below 30% HP for any boss
 * flagged `isMainBoss`, regardless of its `ability`): that's the "múltiplas
 * fases" requirement satisfied architecturally without per-boss code.
 */

export type BossAbilityId = "SUMMON" | "SHIELD" | "REGEN" | "DISABLE" | "BERSERKER" | "NONE";

export interface BossDefinition {
  id: string;
  /** i18n key: bosses.<i18nKey>.name / .description */
  i18nKey: string;
  isMainBoss: boolean;
  /** Multiplier applied to a same-wave Brute's scaled HP — the boss's HP baseline. */
  hpMultiplierVsBrute: number;
  speed: number;
  goldReward: number;
  ability: BossAbilityId;
  abilityIntervalMs: number;
  /** REGEN archetype only: fraction of max HP healed per second. 0 for everyone else. */
  regenPercentPerSecond: number;
  /** Extra flat damage-reduction baseline on top of the archetype default — a "resists physical" flavor knob. */
  resistance: number;
  /** config/dropTables.ts DropTable.id this boss rolls on death, or null for a boss with no item drops yet (Item System spec section 25 — "não é necessário implementar dezenas agora"). */
  dropTableId: string | null;
}

function boss(overrides: Partial<BossDefinition> & Pick<BossDefinition, "id" | "i18nKey" | "isMainBoss">): BossDefinition {
  return {
    hpMultiplierVsBrute: 4,
    speed: 34,
    goldReward: 60,
    ability: "NONE",
    abilityIntervalMs: 6000,
    regenPercentPerSecond: 0,
    resistance: 0,
    dropTableId: null,
    ...overrides,
  };
}

/**
 * One main boss per phase (config/phaseConfig.ts PHASES). Ancient Forest's
 * Hollow Warden is the refined, fully-tuned first boss (approved in an
 * earlier pass — kept as-is, just gained a small physical-resistance
 * flavor on top). The other five are real, fightable definitions with
 * their own signature ability — not "the same boss with more HP" — but
 * intentionally lighter than a full 6-boss content build: no unique visual
 * asset yet (they render via the same boss-scale/aura treatment as any
 * other boss, see EntityRenderer.drawBossAura), which is exactly the
 * "architecture over art, for now" instruction.
 */
export const MAIN_BOSSES: Record<string, BossDefinition> = {
  "hollow-warden": boss({
    id: "hollow-warden",
    i18nKey: "HOLLOW_WARDEN",
    isMainBoss: true,
    hpMultiplierVsBrute: 18,
    speed: 26,
    goldReward: 220,
    ability: "SUMMON",
    abilityIntervalMs: 8000,
    resistance: 0.1,
    dropTableId: "hollow-warden",
  }),
  "molten-colossus": boss({
    id: "molten-colossus",
    i18nKey: "MOLTEN_COLOSSUS",
    isMainBoss: true,
    hpMultiplierVsBrute: 19,
    speed: 24,
    goldReward: 320,
    ability: "SUMMON",
    abilityIntervalMs: 7500,
    resistance: 0.15,
  }),
  "glacial-sovereign": boss({
    id: "glacial-sovereign",
    i18nKey: "GLACIAL_SOVEREIGN",
    isMainBoss: true,
    hpMultiplierVsBrute: 20,
    speed: 27,
    goldReward: 420,
    ability: "SHIELD",
    abilityIntervalMs: 9000,
  }),
  "sand-devourer": boss({
    id: "sand-devourer",
    i18nKey: "SAND_DEVOURER",
    isMainBoss: true,
    hpMultiplierVsBrute: 21,
    speed: 30,
    goldReward: 520,
    ability: "DISABLE",
    abilityIntervalMs: 7000,
  }),
  "grave-tyrant": boss({
    id: "grave-tyrant",
    i18nKey: "GRAVE_TYRANT",
    isMainBoss: true,
    hpMultiplierVsBrute: 22,
    speed: 28,
    goldReward: 650,
    ability: "BERSERKER",
    abilityIntervalMs: 6500,
  }),
  "abyssal-maw": boss({
    id: "abyssal-maw",
    i18nKey: "ABYSSAL_MAW",
    isMainBoss: true,
    hpMultiplierVsBrute: 24,
    speed: 30,
    goldReward: 800,
    ability: "SUMMON",
    abilityIntervalMs: 6000,
    resistance: 0.2,
  }),

  // -------------------------------------------------------------------
  // 10-biome expansion (waves 131-330) — one main boss per new phase,
  // each the "elder/ascended" form of that biome's own mini-boss creature
  // (see MINI_BOSSES below and rendering/biomeCreatures for the single
  // shared bespoke body each pair renders through). Continues the exact
  // same hpMultiplierVsBrute/goldReward growth trend the 6 boss above
  // already establish — no new mechanic, no core formula touched.
  // -------------------------------------------------------------------
  "iron-burrower-sovereign": boss({
    id: "iron-burrower-sovereign",
    i18nKey: "IRON_BURROWER_SOVEREIGN",
    isMainBoss: true,
    hpMultiplierVsBrute: 25.5,
    speed: 25,
    goldReward: 950,
    ability: "SHIELD",
    abilityIntervalMs: 8000,
    resistance: 0.15,
  }),
  "ancestral-colossus": boss({
    id: "ancestral-colossus",
    i18nKey: "ANCESTRAL_COLOSSUS",
    isMainBoss: true,
    hpMultiplierVsBrute: 27,
    speed: 30,
    goldReward: 1100,
    ability: "BERSERKER",
    abilityIntervalMs: 6000,
    resistance: 0.1,
  }),
  "aether-drake-elder": boss({
    id: "aether-drake-elder",
    i18nKey: "AETHER_DRAKE_ELDER",
    isMainBoss: true,
    hpMultiplierVsBrute: 28.5,
    speed: 34,
    goldReward: 1280,
    ability: "SUMMON",
    abilityIntervalMs: 7000,
    resistance: 0.1,
  }),
  "raithar-ascendant": boss({
    id: "raithar-ascendant",
    i18nKey: "RAITHAR_ASCENDANT",
    isMainBoss: true,
    hpMultiplierVsBrute: 30,
    speed: 26,
    goldReward: 1480,
    ability: "REGEN",
    regenPercentPerSecond: 0.015,
    resistance: 0.15,
  }),
  "crystal-behemoth-prime": boss({
    id: "crystal-behemoth-prime",
    i18nKey: "CRYSTAL_BEHEMOTH_PRIME",
    isMainBoss: true,
    hpMultiplierVsBrute: 31.5,
    speed: 27,
    goldReward: 1700,
    ability: "DISABLE",
    abilityIntervalMs: 6500,
    resistance: 0.15,
  }),
  "abyssal-warden-eternal": boss({
    id: "abyssal-warden-eternal",
    i18nKey: "ABYSSAL_WARDEN_ETERNAL",
    isMainBoss: true,
    hpMultiplierVsBrute: 33,
    speed: 24,
    goldReward: 1950,
    ability: "NONE",
    resistance: 0.25,
  }),
  "ashen-colossus-forsaken": boss({
    id: "ashen-colossus-forsaken",
    i18nKey: "ASHEN_COLOSSUS_FORSAKEN",
    isMainBoss: true,
    hpMultiplierVsBrute: 34.5,
    speed: 27,
    goldReward: 2230,
    ability: "DISABLE",
    abilityIntervalMs: 6000,
    resistance: 0.15,
  }),
  "moonroot-matriarch-elder": boss({
    id: "moonroot-matriarch-elder",
    i18nKey: "MOONROOT_MATRIARCH_ELDER",
    isMainBoss: true,
    hpMultiplierVsBrute: 36,
    speed: 26,
    goldReward: 2550,
    ability: "SUMMON",
    abilityIntervalMs: 5500,
    resistance: 0.1,
  }),
  "cathedral-abomination-apex": boss({
    id: "cathedral-abomination-apex",
    i18nKey: "CATHEDRAL_ABOMINATION_APEX",
    isMainBoss: true,
    hpMultiplierVsBrute: 37.5,
    speed: 28,
    goldReward: 2900,
    ability: "BERSERKER",
    abilityIntervalMs: 6000,
    resistance: 0.2,
  }),
  "leviathan-elder": boss({
    id: "leviathan-elder",
    i18nKey: "LEVIATHAN_ELDER",
    isMainBoss: true,
    hpMultiplierVsBrute: 39,
    speed: 30,
    goldReward: 3300,
    ability: "REGEN",
    regenPercentPerSecond: 0.018,
    resistance: 0.15,
  }),
};

export const DEFAULT_MAIN_BOSS_ID = "hollow-warden";

/**
 * Six mini-boss archetypes — spec section 6. Each forces a different
 * response: Shield needs burst-through-the-window, Summoner needs AoE for
 * the adds, Regenerator needs sustained/burst DPS, Disabler needs redundant
 * coverage (losing one tower to a jam shouldn't matter), Tank is a pure
 * DPS check, Berserker punishes a slow kill. Mini-bosses spawn inline with
 * a regular wave (no cinematic interruption — see GameEngine), so they
 * stay simpler than main bosses: no Enrage phase-2, no cinematic ceremony.
 */
export const MINI_BOSSES: Record<string, BossDefinition> = {
  "ashfen-warlord": boss({
    id: "ashfen-warlord",
    i18nKey: "ASHFEN_WARLORD",
    isMainBoss: false,
    hpMultiplierVsBrute: 4,
    speed: 34,
    goldReward: 60,
    ability: "SHIELD",
    abilityIntervalMs: 6000,
    resistance: 0.15,
  }),
  "briar-summoner": boss({
    id: "briar-summoner",
    i18nKey: "BRIAR_SUMMONER",
    isMainBoss: false,
    hpMultiplierVsBrute: 3.5,
    speed: 36,
    goldReward: 65,
    ability: "SUMMON",
    abilityIntervalMs: 5500,
    resistance: 0.15,
  }),
  "mossback-regenerator": boss({
    id: "mossback-regenerator",
    i18nKey: "MOSSBACK_REGENERATOR",
    isMainBoss: false,
    hpMultiplierVsBrute: 5,
    speed: 30,
    goldReward: 70,
    ability: "REGEN",
    regenPercentPerSecond: 0.02,
    resistance: 0.15,
  }),
  "gloom-jammer": boss({
    id: "gloom-jammer",
    i18nKey: "GLOOM_JAMMER",
    isMainBoss: false,
    hpMultiplierVsBrute: 3.5,
    speed: 38,
    goldReward: 65,
    ability: "DISABLE",
    abilityIntervalMs: 5000,
    resistance: 0.15,
  }),
  "stonebound-sentinel": boss({
    id: "stonebound-sentinel",
    i18nKey: "STONEBOUND_SENTINEL",
    isMainBoss: false,
    hpMultiplierVsBrute: 6,
    speed: 22,
    goldReward: 75,
    ability: "NONE",
    resistance: 0.15,
  }),
  "ferocious-berserker": boss({
    id: "ferocious-berserker",
    i18nKey: "FEROCIOUS_BERSERKER",
    isMainBoss: false,
    hpMultiplierVsBrute: 4,
    speed: 40,
    goldReward: 70,
    ability: "BERSERKER",
    abilityIntervalMs: 6000,
    resistance: 0.15,
  }),

  // -------------------------------------------------------------------
  // 10-biome expansion — one mini-boss per new phase, pinned to its own
  // phase via PhaseDefinition.miniBossId (see getMiniBossIdForWave) so it
  // always belongs to its own biome instead of the global roster rotation.
  // -------------------------------------------------------------------
  "iron-burrower": boss({
    id: "iron-burrower",
    i18nKey: "IRON_BURROWER",
    isMainBoss: false,
    hpMultiplierVsBrute: 6.5,
    speed: 28,
    goldReward: 80,
    ability: "SHIELD",
    abilityIntervalMs: 6500,
    resistance: 0.15,
  }),
  "colossus-spawn": boss({
    id: "colossus-spawn",
    i18nKey: "COLOSSUS_SPAWN",
    isMainBoss: false,
    hpMultiplierVsBrute: 7,
    speed: 38,
    goldReward: 85,
    ability: "BERSERKER",
    abilityIntervalMs: 6000,
    resistance: 0.15,
  }),
  "aether-drake": boss({
    id: "aether-drake",
    i18nKey: "AETHER_DRAKE",
    isMainBoss: false,
    hpMultiplierVsBrute: 7.5,
    speed: 42,
    goldReward: 90,
    ability: "SUMMON",
    abilityIntervalMs: 5500,
    resistance: 0.15,
  }),
  raithar: boss({
    id: "raithar",
    i18nKey: "RAITHAR",
    isMainBoss: false,
    hpMultiplierVsBrute: 8,
    speed: 30,
    goldReward: 95,
    ability: "REGEN",
    regenPercentPerSecond: 0.02,
    resistance: 0.15,
  }),
  "crystal-behemoth": boss({
    id: "crystal-behemoth",
    i18nKey: "CRYSTAL_BEHEMOTH",
    isMainBoss: false,
    hpMultiplierVsBrute: 8.5,
    speed: 26,
    goldReward: 100,
    ability: "DISABLE",
    abilityIntervalMs: 5000,
    resistance: 0.15,
  }),
  "abyssal-warden": boss({
    id: "abyssal-warden",
    i18nKey: "ABYSSAL_WARDEN",
    isMainBoss: false,
    hpMultiplierVsBrute: 9,
    speed: 24,
    goldReward: 105,
    ability: "NONE",
    resistance: 0.15,
  }),
  "ashen-colossus": boss({
    id: "ashen-colossus",
    i18nKey: "ASHEN_COLOSSUS",
    isMainBoss: false,
    hpMultiplierVsBrute: 9.5,
    speed: 30,
    goldReward: 110,
    ability: "DISABLE",
    abilityIntervalMs: 5200,
    resistance: 0.15,
  }),
  "moonroot-matriarch": boss({
    id: "moonroot-matriarch",
    i18nKey: "MOONROOT_MATRIARCH",
    isMainBoss: false,
    hpMultiplierVsBrute: 10,
    speed: 28,
    goldReward: 115,
    ability: "SUMMON",
    abilityIntervalMs: 5000,
    resistance: 0.15,
  }),
  "cathedral-abomination": boss({
    id: "cathedral-abomination",
    i18nKey: "CATHEDRAL_ABOMINATION",
    isMainBoss: false,
    hpMultiplierVsBrute: 10.5,
    speed: 32,
    goldReward: 120,
    ability: "BERSERKER",
    abilityIntervalMs: 5800,
    resistance: 0.15,
  }),
  "leviathan-spawn": boss({
    id: "leviathan-spawn",
    i18nKey: "LEVIATHAN_SPAWN",
    isMainBoss: false,
    hpMultiplierVsBrute: 11,
    speed: 28,
    goldReward: 125,
    ability: "REGEN",
    regenPercentPerSecond: 0.022,
    resistance: 0.15,
  }),
};

/** Deterministic rotation — no RNG, matches this codebase's existing seeded/deterministic wave-composition style. */
const MINI_BOSS_ROSTER: readonly string[] = [
  "ashfen-warlord",
  "briar-summoner",
  "mossback-regenerator",
  "gloom-jammer",
  "stonebound-sentinel",
  "ferocious-berserker",
];

/**
 * 10-biome expansion: a phase can pin its own mini-boss (PhaseDefinition
 * .miniBossId) so the biome's own creature shows up instead of whichever
 * unrelated archetype the global rotation lands on. Every hand-authored
 * phase before this expansion, and the endgame rotation, leave miniBossId
 * unset — they keep the exact original global-rotation result.
 */
export function getMiniBossIdForWave(waveNumber: number): string {
  const pinned = getPhaseForWave(waveNumber).miniBossId;
  if (pinned) return pinned;
  return MINI_BOSS_ROSTER[waveNumber % MINI_BOSS_ROSTER.length]!;
}

export function getMainBossForWave(waveNumber: number): BossDefinition {
  const phase = getPhaseForWave(waveNumber);
  return MAIN_BOSSES[phase.mainBossId] ?? MAIN_BOSSES[DEFAULT_MAIN_BOSS_ID]!;
}

export function getMiniBossForWave(waveNumber: number): BossDefinition {
  const id = getMiniBossIdForWave(waveNumber);
  return MINI_BOSSES[id]!;
}

/** Looks up any boss (main or mini) by its BossState.bossId — used at kill time to resolve which DropTable to roll, without the caller needing to know which roster it came from. */
export function getBossDefinitionById(bossId: string): BossDefinition | null {
  return MAIN_BOSSES[bossId] ?? MINI_BOSSES[bossId] ?? null;
}

/** Re-exported under the established name so GameEngine's existing `import { isMiniBossWave } from "@/config/bossConfig"` doesn't need to change. */
export const isMiniBossWave = isMiniBossWaveInPhase;

/** Kept for any external reference to "the current default main boss" (e.g. a future encyclopedia entry point). */
export const MAIN_BOSS = MAIN_BOSSES[DEFAULT_MAIN_BOSS_ID]!;
