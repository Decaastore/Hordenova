import type { EnemyType } from "./enemyStats";

/**
 * CREATURE VFX & IMPACT PASS — the single source of truth mapping every
 * creature (regular archetype by EnemyType, boss/mini-boss by bossId) onto
 * a small VFX identity: which MATERIAL FAMILY its impact/death/footstep
 * particles should read as, and which WEIGHT CLASS drives footstep/hit/
 * death intensity. Deliberately data-only — every consumer (EntityRenderer's
 * footstep draw, VfxManager's material-aware hit/death spawners) branches on
 * these two small enums instead of hand-special-casing 50 creatures, so the
 * "different creatures react differently" requirement is satisfied by
 * curated data, not fifty near-duplicate code paths (spec section 3: "PROIBIDO
 * criar um único sistema visual genérico e aplicar a mesma partícula em
 * todos").
 *
 * Families reuse the SAME real material each creature was already built
 * from (see biomeCreatures/helpers.ts's MaterialKind, used by every
 * biomeCreatures draw function via materialFill) — this table was derived by
 * reading which MaterialKind(s) each draw function actually paints with, so
 * "crystal creature gets crystal VFX" is literally true of its own body, not
 * a guess. Where a creature mixes materials (e.g. hide+metal), the family
 * picked is whichever reads as its dominant, most narratively-defining
 * material (an armored/metal-plated creature still reads "ARMORED" even if
 * its base body is HIDE).
 */
export type CreatureVfxFamily = "ORGANIC" | "CRYSTAL" | "AQUATIC" | "ARMORED" | "PLANT" | "CHARRED";

/** Drives footstep presence/intensity (spec section 9) and hit/death particle scale. MINIBOSS/BOSS are assigned by drawEnemy from enemy.boss, never from this table directly (a boss/mini-boss pair share one profile keyed by bossId; which of the two applies is the isMain check at the call site). */
export type CreatureWeightClass = "LIGHT" | "MEDIUM" | "HEAVY" | "MINIBOSS" | "BOSS";

export interface CreatureVfxProfile {
  family: CreatureVfxFamily;
  weight: CreatureWeightClass;
  /** True for every airborne archetype — footsteps never apply (no ground contact), a flight-appropriate disturbance reads instead where relevant. */
  flying?: boolean;
}

const DEFAULT_PROFILE: CreatureVfxProfile = { family: "ORGANIC", weight: "MEDIUM" };

/** Regular (non-boss) archetypes — both the original 8 (waves 1-130) and the 10-biome expansion's 30. */
const REGULAR_PROFILES: Partial<Record<EnemyType, CreatureVfxProfile>> = {
  // Original 8 — CRAWLER/RUNNER stay the lean organic baseline; BRUTE/
  // SHIELDBEARER/IRONCLAD are the armored heavies movementVfx.ts already
  // flags as "DUST" category; REGENERATOR/DISABLER stay light organic (their
  // own WISP/SHADOW trail already carries their identity).
  CRAWLER: { family: "ORGANIC", weight: "MEDIUM" },
  RUNNER: { family: "ORGANIC", weight: "LIGHT" },
  BRUTE: { family: "ARMORED", weight: "HEAVY" },
  SHIELDBEARER: { family: "ARMORED", weight: "HEAVY" },
  SWARMLING: { family: "ORGANIC", weight: "LIGHT" },
  REGENERATOR: { family: "ORGANIC", weight: "MEDIUM" },
  IRONCLAD: { family: "ARMORED", weight: "HEAVY" },
  DISABLER: { family: "ORGANIC", weight: "MEDIUM" },

  // Dwarven Undercity — forged/stone constructs read ARMORED even where the
  // base body is chitin/hide, since their defining material is worked metal/stone.
  FORGECRAWLER: { family: "ARMORED", weight: "MEDIUM" },
  DEEPDELVER: { family: "ARMORED", weight: "MEDIUM" },
  MAGMAJAW: { family: "ARMORED", weight: "HEAVY" },

  // Colossus Graveyard — bone creatures.
  BONE_STALKER: { family: "ORGANIC", weight: "MEDIUM" },
  RIBCRAWLER: { family: "ORGANIC", weight: "LIGHT" },
  GRAVEWING: { family: "ORGANIC", weight: "MEDIUM", flying: true },

  // Floating Isles — every creature here flies.
  CLOUDFANG: { family: "ORGANIC", weight: "MEDIUM", flying: true },
  SKY_MANTA: { family: "ORGANIC", weight: "MEDIUM", flying: true },
  STORM_TALON: { family: "ORGANIC", weight: "MEDIUM", flying: true },

  // Lost Sun Temple.
  SUNSCARAB: { family: "ARMORED", weight: "LIGHT" },
  TEMPLE_GUARDIAN: { family: "ARMORED", weight: "HEAVY" },
  SOLAR_SERPENT: { family: "ORGANIC", weight: "MEDIUM" },

  // Crystal Sea.
  SHARDCRAWLER: { family: "CRYSTAL", weight: "MEDIUM" },
  CRYSTAL_MAW: { family: "CRYSTAL", weight: "HEAVY" },
  PRISM_WRAITH: { family: "CRYSTAL", weight: "LIGHT", flying: true },

  // Abyssal Fortress.
  ABYSS_CRAWLER: { family: "ORGANIC", weight: "MEDIUM" },
  CHAINBOUND: { family: "ARMORED", weight: "HEAVY" },
  VOID_BAT: { family: "ORGANIC", weight: "LIGHT", flying: true },

  // Ashen Valley — ash/ember-touched.
  ASH_HOUND: { family: "CHARRED", weight: "MEDIUM" },
  PETRIFIED_STALKER: { family: "ARMORED", weight: "HEAVY" },
  CINDERWING: { family: "CHARRED", weight: "LIGHT", flying: true },

  // Moon Gardens.
  MOONFANG: { family: "ORGANIC", weight: "MEDIUM" },
  BLOOM_HORROR: { family: "PLANT", weight: "HEAVY" },
  LUNAMOTH: { family: "ORGANIC", weight: "LIGHT", flying: true },

  // Defiled Cathedral.
  GRAVE_KNIGHT: { family: "ARMORED", weight: "MEDIUM" },
  GARGOYLE_BEAST: { family: "ARMORED", weight: "HEAVY" },
  BELL_WRAITH: { family: "ARMORED", weight: "LIGHT", flying: true },

  // Leviathan Coast — every creature here is aquatic.
  TIDE_RIPPER: { family: "AQUATIC", weight: "MEDIUM" },
  DEEPMAW: { family: "AQUATIC", weight: "HEAVY" },
  BONEFIN: { family: "AQUATIC", weight: "LIGHT" },
};

export function getCreatureVfxProfile(type: EnemyType): CreatureVfxProfile {
  return REGULAR_PROFILES[type] ?? DEFAULT_PROFILE;
}

/**
 * Boss/mini-boss family, keyed by EITHER id of a mini/main pair (see each
 * biomeCreatures/*.ts's registerBossCreature call — both ids of a pair
 * always share the same family here, weight is decided at the call site
 * from `enemy.boss.isMainBoss`, never stored here). Covers the 10-biome
 * expansion's 10 named pairs, the original 6 hand-authored main bosses, and
 * the 6-entry legacy MINI_BOSS_ROSTER (bossConfig.ts) that rotates across
 * those same 6 early phases and the endgame lap rotation.
 */
const BOSS_FAMILY: Record<string, CreatureVfxFamily> = {
  "iron-burrower": "ARMORED",
  "iron-burrower-sovereign": "ARMORED",
  "colossus-spawn": "ARMORED",
  "ancestral-colossus": "ARMORED",
  "aether-drake": "ORGANIC",
  "aether-drake-elder": "ORGANIC",
  raithar: "ARMORED",
  "raithar-ascendant": "ARMORED",
  "crystal-behemoth": "CRYSTAL",
  "crystal-behemoth-prime": "CRYSTAL",
  "abyssal-warden": "ARMORED",
  "abyssal-warden-eternal": "ARMORED",
  "ashen-colossus": "CHARRED",
  "ashen-colossus-forsaken": "CHARRED",
  "moonroot-matriarch": "PLANT",
  "moonroot-matriarch-elder": "PLANT",
  "cathedral-abomination": "ARMORED",
  "cathedral-abomination-apex": "ARMORED",
  "leviathan-spawn": "AQUATIC",
  "leviathan-elder": "AQUATIC",

  // Original 6 hand-authored main bosses (waves 30/50/70/90/110/130).
  "hollow-warden": "ARMORED",
  "molten-colossus": "CHARRED",
  "glacial-sovereign": "CRYSTAL",
  "sand-devourer": "ARMORED",
  "grave-tyrant": "ORGANIC",
  "abyssal-maw": "ORGANIC",

  // Legacy rotating mini-boss roster (shared across the original 6 phases + endgame rotation).
  "ashfen-warlord": "CHARRED",
  "briar-summoner": "PLANT",
  "mossback-regenerator": "PLANT",
  "gloom-jammer": "ORGANIC",
  "stonebound-sentinel": "ARMORED",
  "ferocious-berserker": "ORGANIC",
};

/** aether-drake(-elder) is the only boss pair that actually flies — every other boss/mini-boss walks the circuit. */
const FLYING_BOSS_IDS: ReadonlySet<string> = new Set(["aether-drake", "aether-drake-elder"]);

export function getBossVfxProfile(bossId: string, isMainBoss: boolean): CreatureVfxProfile {
  return {
    family: BOSS_FAMILY[bossId] ?? "ARMORED",
    weight: isMainBoss ? "BOSS" : "MINIBOSS",
    flying: FLYING_BOSS_IDS.has(bossId),
  };
}
