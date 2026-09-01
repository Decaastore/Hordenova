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
    wave: "WAVE",
    baseHp: "BASE HP",
    gold: "GOLD",
    state: "STATE",
    phase: {
      PRE_RUN: "PRE-RUN",
      RUNNING: "RUNNING",
      WAVE_TRANSITION: "WAVE CLEARED",
      DEFEAT: "FORTRESS FALLEN",
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
} as const;

/** Same shape as `en`, but with every leaf widened to `string` — a locale only needs to match structure, not English's exact wording. */
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type TranslationSchema = Widen<typeof en>;
