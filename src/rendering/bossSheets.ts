/**
 * BOSS SHEETS — every main boss and mini-boss is a rigged, animated 3D
 * monster (Quaternius "Ultimate Monsters", free for commercial use) baked
 * into a sprite sheet with the same baker as the regular creatures, recolored
 * for its biome. Files live in public/sprites/enemies/bosses/<bossId>.webp.
 *
 * Each sheet has 4 rows of 12 frames: walk side / walk front (toward the
 * camera) / walk back (away), and an ATTACK row (side view) the renderer
 * plays whenever the boss uses its ability. The live effects drawn around the
 * body (aura, rune ring, particles, footfall shockwaves, enrage fire) come
 * from `effect` + `glow` below — see EntityRenderer's drawBossBody.
 *
 * A biome's mini-boss is a smaller, lighter build of its main boss (same
 * creature family); the six original mini-bosses each have their own.
 */

export type BossEffect = "spore" | "ember" | "frost" | "sand" | "soul" | "void" | "spark" | "bone" | "wind" | "sun" | "crystal" | "ash" | "moon" | "blood" | "tide" | "stone";

export interface BossSheetEntry {
  file: string;
  frames: number;
  /** Rows in the sheet: 3 walk views + 1 attack row. */
  rows: number;
  /** Visible creature height before the renderer's boss scale, world units. */
  worldHeight: number;
  /** World units travelled per full walk cycle. */
  stride: number;
  /** Fliers float this far above their shadow. */
  hover?: number;
  /** Signature glow color of the boss's aura and effects. */
  glow: string;
  effect: BossEffect;
  /** Per row, the fraction of the cell (from the top) where the feet land — measured from the baked frames. */
  feet: readonly number[];
}

/** Measured from the baked sheets (lowest opaque pixel of each row's frames). */
const BOSS_FEET: Record<string, readonly number[]> = {
  "abyssal-maw": [0.88, 0.812, 0.839, 0.88],
  "abyssal-warden": [0.87, 0.854, 0.885, 0.87],
  "abyssal-warden-eternal": [0.87, 0.854, 0.885, 0.87],
  "aether-drake": [0.974, 0.875, 0.906, 0.974],
  "aether-drake-elder": [0.839, 0.844, 0.792, 0.854],
  "ancestral-colossus": [0.906, 0.891, 0.917, 0.911],
  "ashen-colossus": [0.891, 0.901, 0.839, 0.911],
  "ashen-colossus-forsaken": [0.891, 0.901, 0.839, 0.911],
  "ashfen-warlord": [0.896, 0.885, 0.906, 0.901],
  "briar-summoner": [0.906, 0.896, 0.917, 0.906],
  "cathedral-abomination": [0.896, 0.901, 0.823, 0.891],
  "cathedral-abomination-apex": [0.896, 0.901, 0.823, 0.891],
  "colossus-spawn": [0.906, 0.891, 0.917, 0.911],
  "crystal-behemoth": [0.906, 0.891, 0.911, 0.906],
  "crystal-behemoth-prime": [0.906, 0.891, 0.911, 0.906],
  "ferocious-berserker": [0.891, 0.88, 0.901, 0.896],
  "glacial-sovereign": [0.891, 0.88, 0.901, 0.891],
  "gloom-jammer": [0.896, 0.906, 0.818, 0.922],
  "grave-tyrant": [0.859, 0.849, 0.885, 0.865],
  "hollow-warden": [0.891, 0.88, 0.906, 0.896],
  "iron-burrower": [0.844, 0.859, 0.885, 0.849],
  "iron-burrower-sovereign": [0.844, 0.859, 0.885, 0.849],
  "leviathan-elder": [0.901, 0.891, 0.911, 0.906],
  "leviathan-spawn": [0.901, 0.891, 0.911, 0.906],
  "molten-colossus": [0.885, 0.88, 0.906, 0.891],
  "moonroot-matriarch": [0.833, 0.849, 0.839, 0.859],
  "moonroot-matriarch-elder": [0.833, 0.849, 0.839, 0.859],
  "mossback-regenerator": [0.885, 0.875, 0.896, 0.891],
  "raithar": [0.922, 0.911, 0.891, 0.833],
  "raithar-ascendant": [0.922, 0.911, 0.891, 0.833],
  "sand-devourer": [0.896, 0.885, 0.906, 0.901],
  "stonebound-sentinel": [0.974, 0.891, 0.917, 0.974],
};

const sheet = (id: string, glow: string, effect: BossEffect, main: boolean, flying = false): BossSheetEntry => ({
  file: `bosses/${id}.webp`,
  feet: BOSS_FEET[id] ?? [0.98, 0.98, 0.98, 0.98],
  frames: 12,
  rows: 4,
  worldHeight: main ? 42 : 33,
  stride: main ? 38 : 30,
  ...(flying ? { hover: main ? 9 : 7 } : {}),
  glow,
  effect,
});

export const BOSS_SHEETS: Record<string, BossSheetEntry> = {
  // Main bosses — one per biome.
  "hollow-warden": sheet("hollow-warden", "#9be86a", "spore", true),
  "molten-colossus": sheet("molten-colossus", "#ff7a2a", "ember", true),
  "glacial-sovereign": sheet("glacial-sovereign", "#9fdcff", "frost", true),
  "sand-devourer": sheet("sand-devourer", "#ffc861", "sand", true),
  "grave-tyrant": sheet("grave-tyrant", "#c79bff", "soul", true),
  "abyssal-maw": sheet("abyssal-maw", "#7f6bff", "void", true, true),
  "iron-burrower-sovereign": sheet("iron-burrower-sovereign", "#ffb35c", "spark", true),
  "ancestral-colossus": sheet("ancestral-colossus", "#f2e6c8", "bone", true),
  "aether-drake-elder": sheet("aether-drake-elder", "#9fd2ff", "wind", true, true),
  "raithar-ascendant": sheet("raithar-ascendant", "#ffe07a", "sun", true),
  "crystal-behemoth-prime": sheet("crystal-behemoth-prime", "#7ff0ff", "crystal", true),
  "abyssal-warden-eternal": sheet("abyssal-warden-eternal", "#8f9bff", "void", true),
  "ashen-colossus-forsaken": sheet("ashen-colossus-forsaken", "#ff9a5a", "ash", true, true),
  "moonroot-matriarch-elder": sheet("moonroot-matriarch-elder", "#d9d2ff", "moon", true, true),
  "cathedral-abomination-apex": sheet("cathedral-abomination-apex", "#ff6b8a", "blood", true, true),
  "leviathan-elder": sheet("leviathan-elder", "#6fffe0", "tide", true),
  // The six original mini-bosses.
  "ashfen-warlord": sheet("ashfen-warlord", "#d8cf8a", "ash", false),
  "briar-summoner": sheet("briar-summoner", "#c9a6ff", "spore", false),
  "mossback-regenerator": sheet("mossback-regenerator", "#a8f07a", "spore", false),
  "gloom-jammer": sheet("gloom-jammer", "#b48cff", "soul", false, true),
  "stonebound-sentinel": sheet("stonebound-sentinel", "#d9d6cf", "stone", false, true),
  "ferocious-berserker": sheet("ferocious-berserker", "#ff6a4a", "blood", false),
  // Expansion mini-bosses — the lighter build of their biome's main boss.
  "iron-burrower": sheet("iron-burrower", "#ffb35c", "spark", false),
  "colossus-spawn": sheet("colossus-spawn", "#f2e6c8", "bone", false),
  "aether-drake": sheet("aether-drake", "#9fd2ff", "wind", false, true),
  raithar: sheet("raithar", "#ffe07a", "sun", false),
  "crystal-behemoth": sheet("crystal-behemoth", "#7ff0ff", "crystal", false),
  "abyssal-warden": sheet("abyssal-warden", "#8f9bff", "void", false),
  "ashen-colossus": sheet("ashen-colossus", "#ff9a5a", "ash", false, true),
  "moonroot-matriarch": sheet("moonroot-matriarch", "#d9d2ff", "moon", false, true),
  "cathedral-abomination": sheet("cathedral-abomination", "#ff6b8a", "blood", false, true),
  "leviathan-spawn": sheet("leviathan-spawn", "#6fffe0", "tide", false),
};

/** How long the attack row plays after the boss uses its ability, ms. */
export const BOSS_ATTACK_ANIM_MS = 900;
