import { useEffect } from "react";
import type { GameEngine } from "@/engine/GameEngine";
import { playGameAudioEvent } from "@/audio/GameAudioBridge";
import { GameAmbience } from "@/audio/ambience";

/**
 * Audio spec section 16 — drains GameEngine's audioEvents queue every time
 * the engine notifies (the same pub-sub useGameEngine already uses for HUD
 * reactivity — no separate rAF/audio loop is created). Draining is cheap
 * on the vast majority of calls: `drainAudioEvents()` returns an empty
 * array whenever nothing audio-worthy happened that tick, so this is a
 * no-op loop body almost every time, never an unconditional per-frame
 * sound.
 */
export function useGameAudio(engine: GameEngine): void {
  useEffect(() => {
    return engine.subscribe(() => {
      for (const event of engine.drainAudioEvents()) playGameAudioEvent(event);
    });
  }, [engine]);

  // The place's own sound under the fight (wind, lava, cave, sea, rain and thunder) — see audio/ambience.ts.
  useEffect(() => {
    const ambience = new GameAmbience();
    ambience.start();
    const tick = () => ambience.tick(engine.getRenderSnapshot().biomeId, performance.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => {
      window.clearInterval(id);
      ambience.stop();
    };
  }, [engine]);
}
