/**
 * Audio spec section 1/14 — the asset registry AudioManager plays from.
 * Nothing outside `src/audio/` references a sound file path directly; gameplay
 * code only ever deals in semantic events (see engine/AudioEvents.ts +
 * audio/GameAudioBridge.ts), never file names.
 *
 * `priority` feeds AudioManager's voice-limiting (spec section 6): when
 * too many sounds want to play at once, LOW is dropped first, then
 * MEDIUM, HIGH essentially never. `cooldownMs` is a per-id minimum gap
 * between plays — the actual anti-spam mechanism for high-frequency
 * events (tower attacks, hits) rather than silencing them outright.
 */
export type SfxPriority = "HIGH" | "MEDIUM" | "LOW";

export type SfxId =
  | "ironwood_attack"
  | "ironwood_impact"
  | "inferno_attack"
  | "inferno_impact"
  | "frostborn_attack"
  | "frostborn_impact"
  | "frostborn_freeze"
  | "stormcaller_attack"
  | "stormcaller_impact"
  | "stormcaller_chain"
  | "enemy_hit"
  | "enemy_death"
  | "boss_intro"
  | "boss_death"
  | "boss_enrage"
  | "castle_damage"
  | "tower_siege_hit"
  | "wave_start"
  | "wave_complete"
  | "defeat"
  | "victory"
  | "tower_upgrade"
  | "level_unlock"
  | "death_beast_1"
  | "death_beast_2"
  | "death_insect_1"
  | "death_insect_2"
  | "death_brute_1"
  | "death_brute_2"
  | "death_undead_1"
  | "death_undead_2"
  | "death_winged_1"
  | "death_winged_2"
  | "thunder_1"
  | "thunder_2"
  | "thunder_3";

export interface SfxAssetConfig {
  url: string;
  priority: SfxPriority;
  /** Minimum ms between two plays of this exact id — the throttle for repetitive sources (burn, chain lightning, rapid-fire towers). */
  cooldownMs: number;
  /** How many instances of this id may overlap at once before new requests are dropped. */
  maxSimultaneous: number;
  baseVolume: number;
  /** Random pitch (playbackRate) variance applied per play, e.g. 0.08 = ±8% — spec section 5's "pequenas variações de pitch" so repeated hits don't sound like a stuck record. */
  pitchVariance: number;
}

const asset = (
  file: SfxId,
  overrides: Partial<SfxAssetConfig> & Pick<SfxAssetConfig, "priority">,
): SfxAssetConfig => ({
  url: `/audio/sfx/${file}.mp3`,
  cooldownMs: 60,
  maxSimultaneous: 4,
  baseVolume: 0.8,
  pitchVariance: 0.06,
  ...overrides,
});

export const SFX_ASSETS: Record<SfxId, SfxAssetConfig> = {
  // Tower identities — spec section 3/4. These play hundreds of times a
  // minute, so they are short, soft designed sounds (no noise beds), spaced
  // out per id and capped at two overlapping copies; a little more pitch
  // variance keeps the stream from sounding mechanical.
  ironwood_attack: asset("ironwood_attack", { priority: "LOW", cooldownMs: 200, maxSimultaneous: 2, baseVolume: 0.7, pitchVariance: 0.08 }),
  ironwood_impact: asset("ironwood_impact", { priority: "LOW", cooldownMs: 240, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.1 }),
  inferno_attack: asset("inferno_attack", { priority: "LOW", cooldownMs: 220, maxSimultaneous: 2, baseVolume: 0.7, pitchVariance: 0.08 }),
  // Doubles as the "burn ignition" cue (spec: don't play a full sound per
  // burn tick) — a much longer cooldown than the other impacts, since burn
  // re-applies on every Inferno volley but should read as one ongoing fire
  // effect, not a repeated ping.
  inferno_impact: asset("inferno_impact", { priority: "LOW", cooldownMs: 400, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.1 }),
  frostborn_attack: asset("frostborn_attack", { priority: "LOW", cooldownMs: 200, maxSimultaneous: 2, baseVolume: 0.7, pitchVariance: 0.06 }),
  frostborn_impact: asset("frostborn_impact", { priority: "LOW", cooldownMs: 240, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.08 }),
  frostborn_freeze: asset("frostborn_freeze", { priority: "MEDIUM", cooldownMs: 350, maxSimultaneous: 2, baseVolume: 0.8 }),
  stormcaller_attack: asset("stormcaller_attack", { priority: "LOW", cooldownMs: 200, maxSimultaneous: 2, baseVolume: 0.7, pitchVariance: 0.08 }),
  stormcaller_impact: asset("stormcaller_impact", { priority: "LOW", cooldownMs: 240, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.1 }),
  // Chain lightning explicitly must not turn into a wall of noise.
  stormcaller_chain: asset("stormcaller_chain", { priority: "MEDIUM", cooldownMs: 400, maxSimultaneous: 1, baseVolume: 0.8 }),

  // Generic enemy feedback, reused (with pitch/volume params supplied by
  // the caller — see GameAudioBridge) for elite/mini-boss variants instead
  // of separate asset files.
  enemy_hit: asset("enemy_hit", { priority: "LOW", cooldownMs: 70, maxSimultaneous: 5 }),
  enemy_death: asset("enemy_death", { priority: "MEDIUM", cooldownMs: 90, maxSimultaneous: 4 }),

  // Boss presence — spec section 9.
  boss_intro: asset("boss_intro", { priority: "HIGH", cooldownMs: 0, maxSimultaneous: 1, baseVolume: 1, pitchVariance: 0 }),
  boss_death: asset("boss_death", { priority: "HIGH", cooldownMs: 0, maxSimultaneous: 1, baseVolume: 1, pitchVariance: 0.03 }),
  boss_enrage: asset("boss_enrage", { priority: "HIGH", cooldownMs: 0, maxSimultaneous: 1, baseVolume: 1, pitchVariance: 0 }),

  castle_damage: asset("castle_damage", { priority: "HIGH", cooldownMs: 400, maxSimultaneous: 1, baseVolume: 0.95 }),
  // Master Implementation Pass spec section 13 — Boss Siege Attack (a boss hitting a tower, distinct from castle_damage's "enemy reached the base").
  tower_siege_hit: asset("tower_siege_hit", { priority: "HIGH", cooldownMs: 400, maxSimultaneous: 1, baseVolume: 0.9 }),

  wave_start: asset("wave_start", { priority: "MEDIUM", cooldownMs: 500, maxSimultaneous: 1, pitchVariance: 0 }),
  wave_complete: asset("wave_complete", { priority: "MEDIUM", cooldownMs: 500, maxSimultaneous: 1, pitchVariance: 0 }),

  defeat: asset("defeat", { priority: "HIGH", cooldownMs: 0, maxSimultaneous: 1, baseVolume: 1, pitchVariance: 0 }),
  victory: asset("victory", { priority: "HIGH", cooldownMs: 0, maxSimultaneous: 1, baseVolume: 1, pitchVariance: 0 }),

  tower_upgrade: asset("tower_upgrade", { priority: "MEDIUM", cooldownMs: 100, maxSimultaneous: 2, pitchVariance: 0 }),
  level_unlock: asset("level_unlock", { priority: "MEDIUM", cooldownMs: 100, maxSimultaneous: 1, baseVolume: 0.95, pitchVariance: 0 }),

  // Creature death voices — one family per anatomy (config/enemyVoice.ts),
  // two takes each so a stream of kills alternates. A short cooldown and at
  // most two overlapping copies per take keep a swarm from turning into a wall.
  death_beast_1: asset("death_beast_1", { priority: "MEDIUM", cooldownMs: 110, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.08 }),
  death_beast_2: asset("death_beast_2", { priority: "MEDIUM", cooldownMs: 110, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.08 }),
  death_insect_1: asset("death_insect_1", { priority: "MEDIUM", cooldownMs: 90, maxSimultaneous: 2, baseVolume: 0.55, pitchVariance: 0.1 }),
  death_insect_2: asset("death_insect_2", { priority: "MEDIUM", cooldownMs: 90, maxSimultaneous: 2, baseVolume: 0.55, pitchVariance: 0.1 }),
  death_brute_1: asset("death_brute_1", { priority: "MEDIUM", cooldownMs: 160, maxSimultaneous: 2, baseVolume: 0.65, pitchVariance: 0.06 }),
  death_brute_2: asset("death_brute_2", { priority: "MEDIUM", cooldownMs: 160, maxSimultaneous: 2, baseVolume: 0.65, pitchVariance: 0.06 }),
  death_undead_1: asset("death_undead_1", { priority: "MEDIUM", cooldownMs: 140, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.08 }),
  death_undead_2: asset("death_undead_2", { priority: "MEDIUM", cooldownMs: 140, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.08 }),
  death_winged_1: asset("death_winged_1", { priority: "MEDIUM", cooldownMs: 110, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.08 }),
  death_winged_2: asset("death_winged_2", { priority: "MEDIUM", cooldownMs: 110, maxSimultaneous: 2, baseVolume: 0.6, pitchVariance: 0.08 }),

  // Thunder that follows the lightning seen on rainy maps (audio/ambience.ts).
  thunder_1: asset("thunder_1", { priority: "MEDIUM", cooldownMs: 4000, maxSimultaneous: 1, baseVolume: 0.7, pitchVariance: 0.05 }),
  thunder_2: asset("thunder_2", { priority: "MEDIUM", cooldownMs: 4000, maxSimultaneous: 1, baseVolume: 0.7, pitchVariance: 0.05 }),
  thunder_3: asset("thunder_3", { priority: "MEDIUM", cooldownMs: 4000, maxSimultaneous: 1, baseVolume: 0.7, pitchVariance: 0.05 }),
};
