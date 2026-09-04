import type { TowerType } from "@/config/towerStats";
import type { EnemyAudioTier, GameAudioEvent } from "@/engine/AudioEvents";
import { audioManager } from "./AudioManager";
import type { SfxId } from "./sfxCatalog";

/**
 * Audio spec sections 1/3/4/9 — the ONLY place that turns a semantic
 * GameAudioEvent into an actual AudioManager.play() call. This is the
 * "CombatSystem -> evento real -> AudioManager -> SFX" indirection: engine
 * code never imports this file or AudioManager, it only produces
 * GameAudioEvent values (see engine/GameEngine.ts's audioEvents queue).
 */
const TOWER_ATTACK_SFX: Record<TowerType, SfxId> = {
  IRONWOOD: "ironwood_attack",
  INFERNO: "inferno_attack",
  FROSTBORN: "frostborn_attack",
  STORMCALLER: "stormcaller_attack",
};

const TOWER_IMPACT_SFX: Record<TowerType, SfxId> = {
  IRONWOOD: "ironwood_impact",
  INFERNO: "inferno_impact",
  FROSTBORN: "frostborn_impact",
  STORMCALLER: "stormcaller_impact",
};

/** A boss/mini-boss/elite hit or death reads heavier than a regular enemy's — pitch down, volume up — without needing a separate asset file per tier (spec section 5's "pequenas variações"). */
const TIER_WEIGHT: Record<EnemyAudioTier, { pitch: number; volume: number }> = {
  regular: { pitch: 1, volume: 1 },
  elite: { pitch: 0.92, volume: 1.08 },
  mini_boss: { pitch: 0.85, volume: 1.15 },
  boss: { pitch: 0.8, volume: 1.2 },
};

export function playGameAudioEvent(event: GameAudioEvent): void {
  switch (event.type) {
    case "tower_attack":
      audioManager.play(TOWER_ATTACK_SFX[event.towerType]);
      return;
    case "enemy_hit": {
      const weight = TIER_WEIGHT[event.tier];
      audioManager.play(TOWER_IMPACT_SFX[event.towerType], weight);
      return;
    }
    case "enemy_death": {
      const weight = TIER_WEIGHT[event.tier];
      if (event.flavor === "fire") {
        audioManager.play("inferno_impact", { pitch: weight.pitch * 0.85, volume: weight.volume });
      } else if (event.flavor === "ice") {
        audioManager.play("frostborn_freeze", { pitch: weight.pitch, volume: weight.volume * 0.9 });
      } else {
        audioManager.play("enemy_death", weight);
      }
      return;
    }
    case "frostborn_freeze":
      audioManager.play("frostborn_freeze");
      return;
    case "stormcaller_chain":
      audioManager.play("stormcaller_chain");
      return;
    case "boss_intro":
      audioManager.play("boss_intro");
      return;
    case "boss_enrage":
      audioManager.play("boss_enrage");
      return;
    case "boss_death":
      audioManager.play("boss_death");
      return;
    case "castle_damage":
      audioManager.play("castle_damage");
      return;
    case "tower_siege_hit":
      audioManager.play("tower_siege_hit");
      return;
    case "wave_start":
      audioManager.play("wave_start");
      return;
    case "wave_complete":
      audioManager.play("wave_complete");
      return;
    case "defeat":
      audioManager.play("defeat");
      return;
    case "victory":
      audioManager.play("victory");
      return;
    case "tower_upgrade":
      audioManager.play("tower_upgrade");
      return;
    case "level_unlock":
      audioManager.play("level_unlock");
      return;
  }
}
