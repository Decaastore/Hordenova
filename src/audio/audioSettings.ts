import { loadSave, updateSave } from "@/engine/SaveSystem";
import { audioManager } from "./AudioManager";

/**
 * Audio spec section 13 — thin persistence adapter. AudioManager itself
 * stays free of any SaveSystem/localStorage knowledge (it's a pure
 * playback engine); this is the one place that connects "the volume the
 * player picked" to "what gets restored next session", mirroring how
 * GameEngine is the only thing that reads/writes SaveData for progress.
 */
export const SFX_VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

export function initAudioSettingsFromSave(): void {
  const save = loadSave();
  audioManager.setVolume(save.sfxVolume);
  audioManager.setMuted(save.sfxMuted);
}

export function setSfxVolume(volume: number): void {
  audioManager.setVolume(volume);
  updateSave({ sfxVolume: volume });
}

export function toggleSfxMuted(): boolean {
  const next = !audioManager.isMuted();
  audioManager.setMuted(next);
  updateSave({ sfxMuted: next });
  return next;
}

export function getSfxVolume(): number {
  return audioManager.getVolume();
}

export function isSfxMuted(): boolean {
  return audioManager.isMuted();
}
