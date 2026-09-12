import type * as THREE from "three";

/** TESTE VISUAL 3D — handle a creature exposes to the demo controller: the group it moves/rotates imperatively every frame, plus a hit-reaction trigger. Visual only. */
export interface CreatureHandle {
  root: THREE.Group;
  pulseHit: () => void;
  /** Optional: retunes the creature's own walk-cycle rate imperatively (no React re-render needed), so callers driving many instances every frame (INIMIGOS 3D's Enemy3DLayer) can keep the gait tracking a real, continuously-changing speed (e.g. while slowed) without re-rendering. Creatures that don't support this simply omit it. */
  setSpeedMultiplier?: (multiplier: number) => void;
}
