/**
 * Audio spec section 1/14 — the asset registry AudioManager plays from.
 * Nothing outside `src/audio/` references a `.wav` path directly; gameplay
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
  | "wave_start"
  | "wave_complete"
  | "defeat"
  | "victory"
  | "tower_upgrade"
  | "level_unlock";

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
  url: `/audio/sfx/${file}.wav`,
  cooldownMs: 60,
  maxSimultaneous: 4,
  baseVolume: 0.8,
  pitchVariance: 0.06,
  ...overrides,
});

export const SFX_ASSETS: Record<SfxId, SfxAssetConfig> = {
  // Tower identities — spec section 3/4.
  ironwood_attack: asset("ironwood_attack", { priority: "LOW", cooldownMs: 80 }),
  ironwood_impact: asset("ironwood_impact", { priority: "LOW", cooldownMs: 80 }),
  inferno_attack: asset("inferno_attack", { priority: "LOW", cooldownMs: 90 }),
  // Doubles as the "burn ignition" cue (spec: don't play a full sound per
  // burn tick) — a much longer cooldown than the other impacts, since burn
  // re-applies on every Inferno volley but should read as one ongoing fire
  // effect, not a repeated ping.
  inferno_impact: asset("inferno_impact", { priority: "LOW", cooldownMs: 350, maxSimultaneous: 2 }),
  frostborn_attack: asset("frostborn_attack", { priority: "LOW", cooldownMs: 80 }),
  frostborn_impact: asset("frostborn_impact", { priority: "LOW", cooldownMs: 80 }),
  frostborn_freeze: asset("frostborn_freeze", { priority: "MEDIUM", cooldownMs: 250, maxSimultaneous: 2, baseVolume: 0.9 }),
  stormcaller_attack: asset("stormcaller_attack", { priority: "LOW", cooldownMs: 80 }),
  stormcaller_impact: asset("stormcaller_impact", { priority: "LOW", cooldownMs: 80 }),
  // Chain lightning explicitly must not turn into a wall of noise.
  stormcaller_chain: asset("stormcaller_chain", { priority: "MEDIUM", cooldownMs: 300, maxSimultaneous: 1, baseVolume: 0.85 }),

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

  wave_start: asset("wave_start", { priority: "MEDIUM", cooldownMs: 500, maxSimultaneous: 1, pitchVariance: 0 }),
  wave_complete: asset("wave_complete", { priority: "MEDIUM", cooldownMs: 500, maxSimultaneous: 1, pitchVariance: 0 }),

  defeat: asset("defeat", { priority: "HIGH", cooldownMs: 0, maxSimultaneous: 1, baseVolume: 1, pitchVariance: 0 }),
  victory: asset("victory", { priority: "HIGH", cooldownMs: 0, maxSimultaneous: 1, baseVolume: 1, pitchVariance: 0 }),

  tower_upgrade: asset("tower_upgrade", { priority: "MEDIUM", cooldownMs: 100, maxSimultaneous: 2, pitchVariance: 0 }),
  level_unlock: asset("level_unlock", { priority: "MEDIUM", cooldownMs: 100, maxSimultaneous: 1, baseVolume: 0.95, pitchVariance: 0 }),
};
