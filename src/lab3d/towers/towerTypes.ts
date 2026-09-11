import type * as THREE from "three";

/** TESTE VISUAL 3D — handle a tower exposes to the demo controller: fire its attack animation + report its world position for aiming projectiles. Visual only — no damage numbers, no real combat math. */
export interface TowerHandle {
  /** Optional windup/charge cue played just before the shot actually leaves — gives the attack a "preparação" beat instead of firing instantly. */
  anticipate?: () => void;
  trigger: () => void;
  position: THREE.Vector3;
}
