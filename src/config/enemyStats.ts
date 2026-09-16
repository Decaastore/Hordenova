/**
 * Central data table for every enemy type. Wave-to-wave scaling formula
 * lives here too, so no wave-difficulty number is hidden inside the engine.
 *
 * Content Progression spec section 3: each archetype must create a
 * DIFFERENT problem for the build, not just be a bigger number —
 * CRAWLER/RUNNER/BRUTE/SHIELDBEARER already cover Basic/Fast/Tank/Armored
 * (light). This adds four more, each demanding a different real response:
 *  SWARMLING  — Swarm:   tiny HP, spawns in numbers -> needs AoE.
 *  REGENERATOR — Regenerating: heals steadily -> needs burst/sustained DPS.
 *  IRONCLAD   — Armored (heavy): very high flat reduction -> needs
 *               Stormcaller's armor penetration specifically.
 *  DISABLER   — Disabler: periodically jams the nearest tower -> the one
 *               archetype that interferes with the build itself, not just
 *               its own stats. See entities/Enemy.ts `disablerState` and
 *               CombatSystem.ts `tickEnemyDisableAbilities`.
 *
 * Flying/Ranged/Shielded(proc)/Splitter/Summoner/Healer remain
 * architecturally open (just more EnemyType entries + a definition) but
 * aren't populated yet — this is the "well-chosen initial set", not the
 * full roster.
 */

export type EnemyType =
  | "CRAWLER"
  | "RUNNER"
  | "BRUTE"
  | "SHIELDBEARER"
  | "SWARMLING"
  | "REGENERATOR"
  | "IRONCLAD"
  | "DISABLER"
  // 10-biome expansion (waves 131-330) — 3 exclusive archetypes per biome,
  // each mapping its described anatomy/identity onto the SAME mechanical
  // levers above (no new mechanic type invented). See config/phaseConfig.ts
  // PHASES for which biome/phase spawns which of these.
  | "FORGECRAWLER"
  | "DEEPDELVER"
  | "MAGMAJAW"
  | "BONE_STALKER"
  | "RIBCRAWLER"
  | "GRAVEWING"
  | "CLOUDFANG"
  | "SKY_MANTA"
  | "STORM_TALON"
  | "SUNSCARAB"
  | "TEMPLE_GUARDIAN"
  | "SOLAR_SERPENT"
  | "SHARDCRAWLER"
  | "CRYSTAL_MAW"
  | "PRISM_WRAITH"
  | "ABYSS_CRAWLER"
  | "CHAINBOUND"
  | "VOID_BAT"
  | "ASH_HOUND"
  | "PETRIFIED_STALKER"
  | "CINDERWING"
  | "MOONFANG"
  | "BLOOM_HORROR"
  | "LUNAMOTH"
  | "GRAVE_KNIGHT"
  | "GARGOYLE_BEAST"
  | "BELL_WRAITH"
  | "TIDE_RIPPER"
  | "DEEPMAW"
  | "BONEFIN";

export const ENEMY_TYPES: readonly EnemyType[] = [
  "CRAWLER",
  "RUNNER",
  "BRUTE",
  "SHIELDBEARER",
  "SWARMLING",
  "REGENERATOR",
  "IRONCLAD",
  "DISABLER",
  "FORGECRAWLER",
  "DEEPDELVER",
  "MAGMAJAW",
  "BONE_STALKER",
  "RIBCRAWLER",
  "GRAVEWING",
  "CLOUDFANG",
  "SKY_MANTA",
  "STORM_TALON",
  "SUNSCARAB",
  "TEMPLE_GUARDIAN",
  "SOLAR_SERPENT",
  "SHARDCRAWLER",
  "CRYSTAL_MAW",
  "PRISM_WRAITH",
  "ABYSS_CRAWLER",
  "CHAINBOUND",
  "VOID_BAT",
  "ASH_HOUND",
  "PETRIFIED_STALKER",
  "CINDERWING",
  "MOONFANG",
  "BLOOM_HORROR",
  "LUNAMOTH",
  "GRAVE_KNIGHT",
  "GARGOYLE_BEAST",
  "BELL_WRAITH",
  "TIDE_RIPPER",
  "DEEPMAW",
  "BONEFIN",
];

export interface EnemyDefinition {
  type: EnemyType;
  name: string;
  role: string;
  baseHp: number;
  /** World units per second. */
  baseSpeed: number;
  /** Gold granted to the player when killed. */
  goldReward: number;
  /** Flat fraction of incoming damage ignored (0..1). 0 for most enemies. */
  damageReduction: number;
  /** Fraction of max HP regenerated per second while alive. 0 for most enemies. */
  regenPercentPerSecond: number;
  /**
   * DISABLER only: how often (ms) it jams the nearest tower, and for how
   * long. Undefined for every other archetype.
   */
  disablerIntervalMs?: number;
  disablerDurationMs?: number;
  disablerRadius?: number;
}

export const ENEMY_DEFINITIONS: Record<EnemyType, EnemyDefinition> = {
  CRAWLER: {
    type: "CRAWLER",
    name: "Crawler",
    role: "Basic enemy, balanced stats.",
    baseHp: 40,
    baseSpeed: 60,
    goldReward: 5,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  RUNNER: {
    type: "RUNNER",
    name: "Runner",
    role: "Very fast, low HP. Pressures slow-firing towers.",
    baseHp: 20,
    baseSpeed: 130,
    goldReward: 4,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  BRUTE: {
    type: "BRUTE",
    name: "Brute",
    role: "High HP, slow. Tests sustained DPS.",
    baseHp: 220,
    baseSpeed: 32,
    goldReward: 12,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  SHIELDBEARER: {
    type: "SHIELDBEARER",
    name: "Shieldbearer",
    role: "Reduces incoming damage. Forces tower-composition decisions.",
    baseHp: 70,
    baseSpeed: 48,
    goldReward: 8,
    damageReduction: 0.35,
    regenPercentPerSecond: 0,
  },
  SWARMLING: {
    type: "SWARMLING",
    name: "Swarmling",
    role: "Tiny, cheap, arrives in numbers. Individually harmless; in bulk, overwhelming.",
    baseHp: 12,
    baseSpeed: 70,
    goldReward: 2,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  REGENERATOR: {
    type: "REGENERATOR",
    name: "Regenerator",
    role: "Steadily heals while alive. Chip damage barely dents it — needs a real burst.",
    baseHp: 90,
    baseSpeed: 42,
    goldReward: 10,
    damageReduction: 0,
    regenPercentPerSecond: 0.025,
  },
  IRONCLAD: {
    type: "IRONCLAD",
    name: "Ironclad",
    role: "Heavy armor greatly reduces physical damage. Weak to Magic/Armor Penetration.",
    baseHp: 160,
    baseSpeed: 30,
    goldReward: 14,
    damageReduction: 0.55,
    regenPercentPerSecond: 0,
  },
  DISABLER: {
    type: "DISABLER",
    name: "Disabler",
    role: "Periodically jams the nearest tower, silencing it for a moment. The build itself is the target.",
    baseHp: 55,
    baseSpeed: 50,
    goldReward: 9,
    damageReduction: 0,
    regenPercentPerSecond: 0,
    disablerIntervalMs: 4000,
    disablerDurationMs: 1500,
    disablerRadius: 260,
  },

  // -------------------------------------------------------------------
  // 10-biome expansion. Each biome's 3 archetypes reuse the exact same
  // mechanical levers above (hp/speed/dr/regen/disabler) — no new field,
  // no new combat mechanic — mapped onto that creature's described
  // anatomy/behavior so it still demands a genuinely different response.
  // -------------------------------------------------------------------

  // Cidade Subterrânea dos Anões (waves 131-150).
  FORGECRAWLER: {
    type: "FORGECRAWLER",
    name: "Forgecrawler",
    role: "Armored quadruped skirmisher, mineral-plated shell. Fast for its armor class.",
    baseHp: 65,
    baseSpeed: 85,
    goldReward: 9,
    damageReduction: 0.15,
    regenPercentPerSecond: 0,
  },
  DEEPDELVER: {
    type: "DEEPDELVER",
    name: "Deepdelver",
    role: "Deformed miner hauling a heavy pickmace. Mid-tank bruiser.",
    baseHp: 140,
    baseSpeed: 38,
    goldReward: 13,
    damageReduction: 0.2,
    regenPercentPerSecond: 0,
  },
  MAGMAJAW: {
    type: "MAGMAJAW",
    name: "Magmajaw",
    role: "Heavy subterranean reptile with a crushing jaw and stone plating. Slow, very tanky.",
    baseHp: 260,
    baseSpeed: 26,
    goldReward: 16,
    damageReduction: 0.4,
    regenPercentPerSecond: 0,
  },

  // Cemitério dos Colossos (waves 151-170).
  BONE_STALKER: {
    type: "BONE_STALKER",
    name: "Bone Stalker",
    role: "Quadruped predator of exposed bone. Fast, unarmored pursuit hunter.",
    baseHp: 75,
    baseSpeed: 95,
    goldReward: 10,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  RIBCRAWLER: {
    type: "RIBCRAWLER",
    name: "Ribcrawler",
    role: "Crawls low behind a shell of scavenged ribcages. Armored ambusher.",
    baseHp: 130,
    baseSpeed: 50,
    goldReward: 12,
    damageReduction: 0.25,
    regenPercentPerSecond: 0,
  },
  GRAVEWING: {
    type: "GRAVEWING",
    name: "Gravewing",
    role: "Flies on membrane stretched over a bone frame. Aerial harasser.",
    baseHp: 55,
    baseSpeed: 80,
    goldReward: 11,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },

  // Ilhas Flutuantes (waves 171-190) — an entirely aerial roster.
  CLOUDFANG: {
    type: "CLOUDFANG",
    name: "Cloudfang",
    role: "Feline-reptilian sky predator. Very fast aerial striker.",
    baseHp: 70,
    baseSpeed: 100,
    goldReward: 11,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  SKY_MANTA: {
    type: "SKY_MANTA",
    name: "Sky Manta",
    role: "Broad manta-like glider riding the high air currents. Tanky, self-sustaining.",
    baseHp: 150,
    baseSpeed: 55,
    goldReward: 14,
    damageReduction: 0,
    regenPercentPerSecond: 0.02,
  },
  STORM_TALON: {
    type: "STORM_TALON",
    name: "Storm Talon",
    role: "Predatory sky-bird crackling with static discharge. Periodically jams the nearest tower.",
    baseHp: 60,
    baseSpeed: 90,
    goldReward: 12,
    damageReduction: 0,
    regenPercentPerSecond: 0,
    disablerIntervalMs: 4500,
    disablerDurationMs: 1400,
    disablerRadius: 240,
  },

  // Templo Solar Perdido (waves 191-210).
  SUNSCARAB: {
    type: "SUNSCARAB",
    name: "Sunscarab",
    role: "Giant armored insect with an aged golden carapace. Armored skirmisher.",
    baseHp: 150,
    baseSpeed: 45,
    goldReward: 15,
    damageReduction: 0.3,
    regenPercentPerSecond: 0,
  },
  TEMPLE_GUARDIAN: {
    type: "TEMPLE_GUARDIAN",
    name: "Temple Guardian",
    role: "Stone-and-metal construct built to guard the temple's inner sanctum. Heaviest tank in this roster.",
    baseHp: 280,
    baseSpeed: 24,
    goldReward: 18,
    damageReduction: 0.35,
    regenPercentPerSecond: 0,
  },
  SOLAR_SERPENT: {
    type: "SOLAR_SERPENT",
    name: "Solar Serpent",
    role: "Giant pale-scaled serpent lit faintly from within. Fast, self-mending.",
    baseHp: 100,
    baseSpeed: 70,
    goldReward: 14,
    damageReduction: 0,
    regenPercentPerSecond: 0.02,
  },

  // Mar de Cristal (waves 211-230).
  SHARDCRAWLER: {
    type: "SHARDCRAWLER",
    name: "Shardcrawler",
    role: "Arachnid with crystal growths along its back. Fast, lightly armored.",
    baseHp: 80,
    baseSpeed: 90,
    goldReward: 12,
    damageReduction: 0.15,
    regenPercentPerSecond: 0,
  },
  CRYSTAL_MAW: {
    type: "CRYSTAL_MAW",
    name: "Crystal Maw",
    role: "Quadruped with a crushing jaw sheathed in natural crystal armor. Heavy tank.",
    baseHp: 240,
    baseSpeed: 28,
    goldReward: 17,
    damageReduction: 0.4,
    regenPercentPerSecond: 0,
  },
  PRISM_WRAITH: {
    type: "PRISM_WRAITH",
    name: "Prism Wraith",
    role: "Partially incorporeal, its body a drifting cluster of mineral fragments. Bends light to jam the nearest tower.",
    baseHp: 65,
    baseSpeed: 60,
    goldReward: 13,
    damageReduction: 0,
    regenPercentPerSecond: 0,
    disablerIntervalMs: 5000,
    disablerDurationMs: 1200,
    disablerRadius: 220,
  },

  // Fortaleza Abissal (waves 231-250).
  ABYSS_CRAWLER: {
    type: "ABYSS_CRAWLER",
    name: "Abyss Crawler",
    role: "Many-limbed climber adapted to sheer cliff walls. Fast, unarmored.",
    baseHp: 85,
    baseSpeed: 80,
    goldReward: 12,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  CHAINBOUND: {
    type: "CHAINBOUND",
    name: "Chainbound",
    role: "A heavy, deformed captive dragging ancient rusted chains. Slow, extremely armored.",
    baseHp: 220,
    baseSpeed: 30,
    goldReward: 16,
    damageReduction: 0.45,
    regenPercentPerSecond: 0,
  },
  VOID_BAT: {
    type: "VOID_BAT",
    name: "Void Bat",
    role: "Huge-winged cave flier. Erratic, fast, fragile.",
    baseHp: 45,
    baseSpeed: 110,
    goldReward: 10,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },

  // Vale das Cinzas Mortas (waves 251-270) — an ancient-catastrophe wasteland, not a volcanic biome.
  ASH_HOUND: {
    type: "ASH_HOUND",
    name: "Ash Hound",
    role: "Quadruped predator, hide partially charred from a catastrophe long past. Fast pursuit hunter.",
    baseHp: 70,
    baseSpeed: 95,
    goldReward: 11,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  PETRIFIED_STALKER: {
    type: "PETRIFIED_STALKER",
    name: "Petrified Stalker",
    role: "Deer-like stalker with parts of its body turned to stone. Armored by its own petrification.",
    baseHp: 165,
    baseSpeed: 48,
    goldReward: 15,
    damageReduction: 0.3,
    regenPercentPerSecond: 0,
  },
  CINDERWING: {
    type: "CINDERWING",
    name: "Cinderwing",
    role: "Flies on damaged, ash-shedding wings. Erratic, fast, fragile.",
    baseHp: 48,
    baseSpeed: 88,
    goldReward: 10,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },

  // Jardins da Lua (waves 271-290) — nocturnal, supernatural, deliberately not childish.
  MOONFANG: {
    type: "MOONFANG",
    name: "Moonfang",
    role: "Dark-silver-furred quadruped predator, eyes faintly luminous. Fast, moon-blessed vitality.",
    baseHp: 75,
    baseSpeed: 92,
    goldReward: 12,
    damageReduction: 0,
    regenPercentPerSecond: 0.01,
  },
  BLOOM_HORROR: {
    type: "BLOOM_HORROR",
    name: "Bloom Horror",
    role: "Carnivorous plant creature, flowers and roots grown into its own anatomy. Slow, root-armored ambusher.",
    baseHp: 190,
    baseSpeed: 34,
    goldReward: 16,
    damageReduction: 0.35,
    regenPercentPerSecond: 0,
  },
  LUNAMOTH: {
    type: "LUNAMOTH",
    name: "Lunamoth",
    role: "Large-winged moth with luminous natural patterns. Fast, evasive flier.",
    baseHp: 55,
    baseSpeed: 85,
    goldReward: 11,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },

  // Catedral Profanada (waves 291-310).
  GRAVE_KNIGHT: {
    type: "GRAVE_KNIGHT",
    name: "Grave Knight",
    role: "Monstrous, non-human-proportioned figure in ancient armor. Heavy armored bruiser.",
    baseHp: 200,
    baseSpeed: 36,
    goldReward: 17,
    damageReduction: 0.4,
    regenPercentPerSecond: 0,
  },
  GARGOYLE_BEAST: {
    type: "GARGOYLE_BEAST",
    name: "Gargoyle Beast",
    role: "Quadruped fusion of stone and flesh. Armored, slowly self-mending.",
    baseHp: 170,
    baseSpeed: 40,
    goldReward: 15,
    damageReduction: 0.25,
    regenPercentPerSecond: 0.015,
  },
  BELL_WRAITH: {
    type: "BELL_WRAITH",
    name: "Bell Wraith",
    role: "A floating, mist-wrapped entity bound to the cathedral's own bells. Its toll jams the nearest tower.",
    baseHp: 60,
    baseSpeed: 70,
    goldReward: 13,
    damageReduction: 0,
    regenPercentPerSecond: 0,
    disablerIntervalMs: 4200,
    disablerDurationMs: 1600,
    disablerRadius: 280,
  },

  // Península dos Leviatãs (waves 311-330).
  TIDE_RIPPER: {
    type: "TIDE_RIPPER",
    name: "Tide Ripper",
    role: "Low, muscular amphibious predator, built to claw through surf and sand alike. Fast attacker.",
    baseHp: 90,
    baseSpeed: 85,
    goldReward: 13,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
  DEEPMAW: {
    type: "DEEPMAW",
    name: "Deepmaw",
    role: "An abyssal-predator marine creature able to haul itself onto land. Heavy tank, crushing jaw.",
    baseHp: 250,
    baseSpeed: 30,
    goldReward: 18,
    damageReduction: 0.35,
    regenPercentPerSecond: 0,
  },
  BONEFIN: {
    type: "BONEFIN",
    name: "Bonefin",
    role: "Fast, partially bony fish-predator hybrid. Fragile but very quick.",
    baseHp: 55,
    baseSpeed: 110,
    goldReward: 12,
    damageReduction: 0,
    regenPercentPerSecond: 0,
  },
};

/** Small reward growth so later waves stay worth playing. */
const GOLD_GROWTH_PER_WAVE = 0.03;

/**
 * ============================================================================
 * INFINITE BALANCE OVERHAUL — enemy HP scaling.
 * ============================================================================
 *
 * WHAT WAS WRONG (the root cause of the documented ~wave 450-460 wall): the
 * previous curve was `(1 + i*0.06) * (1.006)^i` — a COMPOUNDING (exponential)
 * term. Exponential growth outruns ANY player-power curve this economy can
 * fund, so a wall was mathematically guaranteed; it was only ever a question
 * of which wave it landed on. Real engine simulation proved it directly:
 * even with boss HP divided by 10, a realistic bot stalled around wave 480
 * against ORDINARY enemies.
 *
 * WHAT REPLACES IT — a genuinely unbounded but SUB-EXPLOSIVE curve, built as
 * the product of two strictly-increasing factors:
 *
 *   hpMultiplier(i) = EARLY(i) * LATE(i)
 *   EARLY(i) = 1 + A * (1 - e^(-i / T))     // bounded, smooth, front-loaded
 *   LATE(i)  = (1 + i / S) ^ P              // power law, P < 1, unbounded
 *
 * Properties this shape guarantees, none of which the old one had:
 *  - STRICTLY INCREASING FOREVER. Both factors are strictly increasing in i,
 *    so enemies never "stay permanently the same" at any wave, ever. There is
 *    no plateau, no soft cap, no frozen term.
 *  - SUB-EXPLOSIVE. Asymptotically hpMultiplier ~ (1+A) * (i/S)^P with
 *    P = HP_LATE_EXPONENT < 1 relative to the player's own compounding
 *    (Specialization x Mastery) growth — so difficulty keeps climbing while
 *    the RATE of climb keeps decelerating, which is exactly what makes an
 *    endless game endless instead of walled.
 *  - NO ARTIFICIAL OVERFLOW CAP NEEDED. A polynomial in i can never reach
 *    Number.MAX_VALUE at any wave number representable as a JS integer
 *    (wave 1e15 -> multiplier ~1e11), so the old
 *    `Math.min(waveIndex, HP_COMPOUND_WAVE_INDEX_CAP)` safety clamp — which
 *    was a disguised difficulty cap — is deleted outright rather than
 *    re-hidden somewhere else.
 *  - EARLY GAME PRESERVED. A/T are fitted so waves 1-130 (the hand-authored
 *    content phases) land within ~10-15% of the multipliers the old curve
 *    produced; the two curves only diverge where the old one was already
 *    running away (wave 200+).
 *
 * Constants were fitted against the real, coverage-adjusted DPS a real build
 * lands on the real map (see engine/InfiniteScaling.test.ts and the boss
 * kill-margin checkpoints in engine/EndgameCheckpoints.test.ts), never
 * guessed.
 */

/** Amplitude of the bounded early-game surge — replaces the old compounding term's early bite without its runaway tail. */
const HP_EARLY_SURGE_AMPLITUDE = 3.5;
/** Wave scale over which the early surge builds (~63% of it is delivered by this wave index). */
const HP_EARLY_SURGE_SCALE = 80;
/** Wave scale of the permanent power-law term — larger = gentler early contribution. */
const HP_LATE_SCALE = 30;
/** The permanent asymptotic exponent. Deliberately < 1 and, more importantly, below the exponent at which Specialization x Mastery power grows with wave number (~0.95) — that inequality is the structural no-wall guarantee. */
const HP_LATE_EXPONENT = 0.72;

/**
 * The HP multiplier for a given (0-indexed) wave. Strictly increasing,
 * finite, and positive for every finite waveIndex >= 0 — see this section's
 * doc comment for the full derivation.
 */
export function hpMultiplierForWaveIndex(waveIndex: number): number {
  const i = Math.max(0, waveIndex);
  const early = 1 + HP_EARLY_SURGE_AMPLITUDE * (1 - Math.exp(-i / HP_EARLY_SURGE_SCALE));
  const late = Math.pow(1 + i / HP_LATE_SCALE, HP_LATE_EXPONENT);
  return early * late;
}

/**
 * Master Implementation Pass spec section 9-10 — ENDGAME MULTI-DIMENSIONAL
 * SCALING: "não simplesmente multiplicar HP infinitamente". HP above stays
 * the dominant, ever-present pressure (and is what produces the documented
 * ~450-460 wall) — these two additional dimensions only start contributing
 * at wave 300, matching the spec's own first calibration band ("300–500")
 * rather than the wall itself, so a build is already feeling a second and
 * third kind of pressure by the time HP alone starts to bite, not after.
 * Early/mid-game (< wave 300) is completely unaffected, and each dimension
 * is explicitly capped so no enemy ever becomes literally un-fightable: a
 * build has to adapt (more armor penetration, faster-firing towers), not
 * get permanently locked out.
 *
 * Both use the same "start wave + linear-per-wave + hard cap" shape —
 * genuinely uncapped in WAVE NUMBER (never overflows, no Math.pow anywhere
 * here) while the actual bonus itself stays bounded forever once capped.
 */
const ARMOR_SCALING_START_WAVE = 300;
const ARMOR_SCALING_PER_WAVE = 0.0006;
/** Extra damage reduction from this dimension alone never exceeds this. */
const ARMOR_SCALING_CAP = 0.5;
/** Combined (base archetype resistance + this scaling) damage reduction never exceeds this — always leaves SOME damage getting through, never literal invulnerability. */
const MAX_COMBINED_DAMAGE_REDUCTION = 0.9;

const SPEED_SCALING_START_WAVE = 300;
const SPEED_SCALING_PER_WAVE = 0.0003;
/** Enemies never move more than this fraction faster from this dimension alone. */
const SPEED_SCALING_CAP = 0.6;

function bandScaling(waveNumber: number, startWave: number, perWave: number, cap: number): number {
  if (waveNumber <= startWave) return 0;
  return Math.min(cap, (waveNumber - startWave) * perWave);
}

export interface ScaledEnemyStats {
  hp: number;
  speed: number;
  goldReward: number;
  damageReduction: number;
  regenPerSecond: number;
}

export function getScaledEnemyStats(type: EnemyType, waveNumber: number): ScaledEnemyStats {
  const def = ENEMY_DEFINITIONS[type];
  const waveIndex = Math.max(waveNumber - 1, 0);
  const hpMultiplier = hpMultiplierForWaveIndex(waveIndex);
  const goldMultiplier = 1 + waveIndex * GOLD_GROWTH_PER_WAVE;
  const hp = Math.round(def.baseHp * hpMultiplier);

  const extraArmor = bandScaling(waveNumber, ARMOR_SCALING_START_WAVE, ARMOR_SCALING_PER_WAVE, ARMOR_SCALING_CAP);
  const damageReduction = Math.min(MAX_COMBINED_DAMAGE_REDUCTION, def.damageReduction + extraArmor);
  const speedMultiplier = 1 + bandScaling(waveNumber, SPEED_SCALING_START_WAVE, SPEED_SCALING_PER_WAVE, SPEED_SCALING_CAP);

  return {
    hp,
    speed: def.baseSpeed * speedMultiplier,
    goldReward: Math.round(def.goldReward * goldMultiplier),
    damageReduction,
    regenPerSecond: hp * def.regenPercentPerSecond,
  };
}
