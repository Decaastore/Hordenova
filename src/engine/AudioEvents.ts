import type { TowerType } from "@/config/towerStats";

/**
 * Audio spec sections 1/2 — pure data describing something that REALLY
 * happened this tick. Zero imports from `src/audio/` or the DOM: this
 * file lives in `engine/` specifically so GameEngine can emit these
 * without gaining any Audio/Canvas coupling (the same separation
 * RenderSnapshot/HudSnapshot already keep from the rendering layer).
 * `audio/GameAudioBridge.ts` is the only place that turns these into an
 * actual AudioManager.play() call.
 */
export type EnemyAudioTier = "regular" | "elite" | "mini_boss" | "boss";

export type GameAudioEvent =
  | { type: "tower_attack"; towerType: TowerType }
  /** towerType picks the impact's identity (spec section 4 — "os impactos precisam respeitar o tipo de ataque"); tier adjusts weight (a boss/mini-boss/elite hit reads heavier than a regular one). */
  | { type: "enemy_hit"; towerType: TowerType; tier: EnemyAudioTier }
  /** `flavor` reflects the enemy's REAL status at the moment of death (still burning / still frozen) — spec section 3's "morte por fogo" / "morte congelada" — never a guess at which tower landed the killing blow. */
  | { type: "enemy_death"; tier: EnemyAudioTier; flavor?: "fire" | "ice" }
  | { type: "frostborn_freeze" }
  | { type: "stormcaller_chain" }
  | { type: "boss_intro" }
  | { type: "boss_enrage" }
  | { type: "boss_death" }
  | { type: "castle_damage"; count: number }
  | { type: "wave_start" }
  | { type: "wave_complete" }
  | { type: "defeat" }
  | { type: "victory" }
  | { type: "tower_upgrade" }
  | { type: "level_unlock" };
