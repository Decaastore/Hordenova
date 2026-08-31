import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { GameEngine } from "@/engine/GameEngine";
import { GameLoop } from "@/engine/GameLoop";

/**
 * Owns one GameEngine + GameLoop for the lifetime of the component tree
 * that calls this. The engine tick loop runs independently of React's
 * render cycle (GameLoop drives it via requestAnimationFrame); this hook
 * only re-renders the calling component when HUD-relevant state changes,
 * via GameEngine's cached snapshot (see GameEngine.getHudSnapshot).
 */
export function useGameEngine() {
  const engineRef = useRef<GameEngine>();
  if (!engineRef.current) {
    engineRef.current = new GameEngine();
  }
  const engine = engineRef.current;

  const subscribe = useCallback(
    (onStoreChange: () => void) => engine.subscribe(onStoreChange),
    [engine],
  );
  const getSnapshot = useCallback(() => engine.getHudSnapshot(), [engine]);

  const hud = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    const loop = new GameLoop((dtMs) => engine.update(dtMs));
    loop.start();
    return () => loop.stop();
  }, [engine]);

  return { engine, hud };
}
