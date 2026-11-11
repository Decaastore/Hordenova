import type { EnemyType } from "./enemyStats";

/**
 * Which kind of creature voice an enemy dies with. Five families cover the
 * whole roster by anatomy: furred/fanged beasts snarl, crawling things
 * chitter and crunch, big armoured bodies groan and clatter, the undead
 * wail and fall apart, flying things screech and drop. Purely audio.
 */
export type EnemyVoiceFamily = "beast" | "insect" | "brute" | "undead" | "winged";

export const ENEMY_VOICE_FAMILY: Record<EnemyType, EnemyVoiceFamily> = {
  CRAWLER: "insect",
  RUNNER: "beast",
  BRUTE: "brute",
  SHIELDBEARER: "brute",
  SWARMLING: "insect",
  REGENERATOR: "insect",
  IRONCLAD: "brute",
  DISABLER: "undead",
  FORGECRAWLER: "insect",
  DEEPDELVER: "brute",
  MAGMAJAW: "beast",
  BONE_STALKER: "undead",
  RIBCRAWLER: "undead",
  GRAVEWING: "winged",
  CLOUDFANG: "beast",
  SKY_MANTA: "winged",
  STORM_TALON: "winged",
  SUNSCARAB: "insect",
  TEMPLE_GUARDIAN: "brute",
  SOLAR_SERPENT: "beast",
  SHARDCRAWLER: "insect",
  CRYSTAL_MAW: "beast",
  PRISM_WRAITH: "undead",
  ABYSS_CRAWLER: "insect",
  CHAINBOUND: "brute",
  VOID_BAT: "winged",
  ASH_HOUND: "beast",
  PETRIFIED_STALKER: "brute",
  CINDERWING: "winged",
  MOONFANG: "beast",
  BLOOM_HORROR: "insect",
  LUNAMOTH: "winged",
  GRAVE_KNIGHT: "undead",
  GARGOYLE_BEAST: "brute",
  BELL_WRAITH: "undead",
  TIDE_RIPPER: "beast",
  DEEPMAW: "beast",
  BONEFIN: "undead",
};
