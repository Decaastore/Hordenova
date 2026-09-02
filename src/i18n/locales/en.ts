/**
 * English — the default locale and the source of truth for the
 * translation shape. Every other locale (see ./ptBR.ts) is type-checked
 * against `typeof en`, so a missing key anywhere fails the build instead
 * of silently falling back at runtime.
 */
export const en = {
  language: {
    selectorLabel: "Language",
    en: "English",
    ptBR: "Português (Brasil)",
  },
  menu: {
    subtitle: "BUILD. UPGRADE. SURVIVE.",
    play: "ENTER THE HORDE",
    bestWave: "BEST WAVE",
  },
  hud: {
    wave: "PHASE",
    baseHp: "BASE HP",
    gold: "GOLD",
    state: "STATE",
    phase: {
      PRE_RUN: "PRE-RUN",
      OFFLINE_RETURN: "WELCOME BACK",
      RUNNING: "RUNNING",
      WAVE_TRANSITION: "WAVE CLEARED",
      BOSS_INTRO: "BOSS APPROACHING",
      BOSS_BATTLE: "BOSS BATTLE",
      VICTORY: "VICTORY",
      PROGRESSION_STOPPED: "PROGRESSION STOPPED",
    },
  },
  towers: {
    IRONWOOD: {
      name: "Ironwood",
      role: "Single Target / Critical",
      description: "High single-target damage with a chance to land critical hits.",
    },
    INFERNO: {
      name: "Inferno",
      role: "Area Damage / Burn",
      description: "Short-to-medium range splash damage that burns everything it hits.",
    },
    FROSTBORN: {
      name: "Frostborn",
      role: "Slow / Crowd Control",
      description: "Moderate damage; every hit slows the target down.",
    },
    STORMCALLER: {
      name: "Stormcaller",
      role: "Long Range / Chain Damage",
      description: "Long range lightning that arcs to nearby enemies; attacks slowly.",
    },
  },
  towerInfo: {
    level: "Level {level} / {max}",
    damage: "Damage",
    attackSpeed: "Attack Speed",
    range: "Range",
    special: "Special",
    maxLevel: "MAX LEVEL",
    upgrade: "UPGRADE",
  },
  defeat: {
    title: "FORTRESS FALLEN",
    waveReached: "Wave Reached",
    enemiesDefeated: "Enemies Defeated",
    bestWave: "Best Wave",
    tryAgain: "TRY AGAIN",
    mainMenu: "MAIN MENU",
  },
  boss: {
    introLine: "{name} approaches",
    getReady: "Prepare your defenses",
  },
  progressionStopped: {
    title: "PROGRESSION STOPPED",
    phaseFailed: "PHASE {phase} — FAILED",
    whyDidILose: "WHY DID I LOSE?",
    howCanIImprove: "HOW CAN I IMPROVE?",
    statDamage: "Damage",
    recommendationLine: "{tower} Lv.{from} → {to} (+{percent}% {stat})",
    recommendationBuildNew: "Build a {tower} — none in your current build",
    reasons: {
      fastEnemiesLeaked: "Fast enemies (Runners) reached the base before your towers could finish them off.",
      highResistance: "A large share of your hits landed on heavily armored enemies and dealt reduced damage.",
      bossSurvived: "The boss survived with health remaining when your base fell.",
      overwhelmedByNumbers: "Too many enemies reached the base at once — your defense couldn't cover the volume.",
      tankyEnemiesLeaked: "High-HP enemies (Brutes/Shieldbearers) broke through your defense.",
      lowDps: "Your overall damage output is too low for this phase's enemies.",
    },
    continueBuilding: "UPGRADE TOWERS",
    retry: "RETRY",
    boostComingSoon: "BOOST — COMING SOON",
    mainMenu: "MAIN MENU",
  },
  offlineReturn: {
    title: "WELCOME BACK",
    subtitle: "While you were away...",
    phasesCleared: "+{count} Phases",
    miniBossesCleared: "+{count} Mini-Bosses",
    bossesCleared: "+{count} Bosses",
    resourcesEarned: "+{count} Gold",
    currentProgression: "CURRENT PROGRESSION",
    phaseLabel: "Phase {phase}",
    continueButton: "CONTINUE",
  },
} as const;

/** Same shape as `en`, but with every leaf widened to `string` — a locale only needs to match structure, not English's exact wording. */
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type TranslationSchema = Widen<typeof en>;
