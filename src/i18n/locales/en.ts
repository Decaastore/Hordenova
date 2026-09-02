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
      role: "Single Target / Critical / Boss Damage",
      description: "High single-target burst with a crit chance. Gains extra projectiles and a bonus vs bosses as it levels — lean on it when a boss just won't die.",
    },
    INFERNO: {
      name: "Inferno",
      role: "Area Damage / Sustained Burn",
      description: "Splash damage that ignites everything it hits. Burn stacks at higher levels — built for when too many enemies pile up at once.",
    },
    FROSTBORN: {
      name: "Frostborn",
      role: "Slow / Crowd Control / Freeze",
      description: "Every hit slows its target, and higher levels add a chance to freeze it solid. The answer when fast enemies keep slipping past.",
    },
    STORMCALLER: {
      name: "Stormcaller",
      role: "Magic / Chain Damage / Armor Penetration",
      description: "Arcane lightning that arcs between enemies and, at higher levels, tears straight through armor. Keeps working when heavily armored enemies shrug off everything else.",
    },
  },
  towerInfo: {
    level: "Level {level} / {max}",
    damage: "Damage",
    attackSpeed: "Attack Speed",
    range: "Range",
    special: "Specialization",
    maxLevel: "MAX LEVEL",
    upgrade: "UPGRADE",
    goodAgainst: "Good against",
    nextLevel: "NEXT LEVEL",
    cost: "Cost",
    unlockBanner: "LEVEL {level} UNLOCK",
    specialLines: {
      IRONWOOD: {
        critChance: "Crit Chance",
        critMultiplier: "Crit Damage",
        bossDamageMultiplier: "Boss Damage",
        locked: "Unlocks at Lv.{level}",
      },
      INFERNO: {
        burnDamagePerSecond: "Burn DPS",
        aoeRadius: "AoE Radius",
        burnMaxStacks: "Burn Stacks",
      },
      FROSTBORN: {
        slowPercent: "Slow",
        freezeChance: "Freeze Chance",
      },
      STORMCALLER: {
        chainTargets: "Chain Targets",
        armorPenetration: "Armor Penetration",
      },
    },
    unlocks: {
      multiShot: { name: "MULTI-SHOT", description: "Fires a 2nd projectile at a nearby target every attack." },
      giantSlayer: { name: "GIANT SLAYER", description: "Deals bonus damage against bosses and mini-bosses." },
      tripleShot: { name: "TRIPLE SHOT", description: "Fires a 3rd projectile at a nearby target every attack." },
      wildfire: { name: "WILDFIRE", description: "Burn can now stack, dealing cumulative damage over time." },
      infernoCore: { name: "INFERNO CORE", description: "Burn can now stack a 3rd time for even more sustained damage." },
      deepFreeze: { name: "DEEP FREEZE", description: "Chance on hit to fully stop the target for a moment." },
      permafrost: { name: "PERMAFROST", description: "Deep Freeze becomes significantly more likely to trigger." },
      arcaneSurge: { name: "ARCANE SURGE", description: "Hits now ignore part of the target's armor." },
      stormBreaker: { name: "STORM BREAKER", description: "Armor penetration increases even further." },
    },
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
    defeatedLine: "{name} defeated",
    rewardLine: "+{amount} Gold",
    enraged: "ENRAGED",
  },
  progressionStopped: {
    title: "PROGRESSION STOPPED",
    phaseFailed: "PHASE {phase} — FAILED",
    whyDidILose: "WHY DID I LOSE?",
    howCanIImprove: "HOW CAN I IMPROVE?",
    statDamage: "Damage",
    recommendationLine: "{tower} Lv.{from} → {to} (+{percent}% {stat})",
    recommendationBuildNew: "No {tower} in your build yet — consider building one",
    reasons: {
      fastEnemiesLeaked: "Fast enemies (Runners) reached the base before your towers could finish them off.",
      highResistance: "A large share of your hits landed on heavily armored enemies and dealt reduced damage.",
      bossSurvived: "The boss survived with health remaining when your base fell.",
      overwhelmedByNumbers: "Too many enemies reached the base at once — your defense couldn't cover the volume.",
      tankyEnemiesLeaked: "High-HP enemies (Brutes) broke through your defense.",
      armoredEnemiesLeaked: "Armored enemies (Shieldbearers) shrugged off your damage and reached the base.",
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
