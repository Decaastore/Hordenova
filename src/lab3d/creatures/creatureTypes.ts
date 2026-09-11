import type * as THREE from "three";

/** TESTE VISUAL 3D — handle a creature exposes to the demo controller: the group it moves/rotates imperatively every frame, plus a hit-reaction trigger. Visual only. */
export interface CreatureHandle {
  root: THREE.Group;
  pulseHit: () => void;
}
