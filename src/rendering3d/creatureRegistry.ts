import type { EnemyType } from "@/config/enemyStats";
import { BruteCreature } from "@/lab3d/creatures/BruteCreature";
import type { CreatureHandle } from "@/lab3d/creatures/creatureTypes";

export interface Enemy3DCreatureProps {
  onReady?: (handle: CreatureHandle) => void;
  /** 1 = normal walk rate; lower while the real enemy is slowed. Purely cosmetic. */
  speedMultiplier?: number;
}

export interface Enemy3DDefinition {
  Component: (props: Enemy3DCreatureProps) => React.JSX.Element;
  /** The creature's own unscaled vertical extent (local Three.js units), used to derive the on-screen model scale from `worldHeight`. */
  localHeight: number;
  /** Desired on-screen height, in the same WORLD_SIZE units the 2D game uses — calibrated to sit close to the 2D sprite's own visual footprint so it doesn't dwarf towers/other enemies or collide with the HP bar above it. */
  worldHeight: number;
  /** Contact-shadow radius as a fraction of `localHeight` — scales together with the model so it never goes out of proportion. */
  shadowRadiusRatio: number;
}

/**
 * INIMIGOS 3D — the single place that maps a real EnemyType to its 3D
 * model. `Enemy3DLayer` reads this registry generically: any type with an
 * entry here gets the 3D treatment, any type without one keeps using the
 * existing 2D sprite untouched. Enabling a new type is adding one line
 * here, never a copy-pasted per-type rendering component.
 *
 * Only BRUTE is enabled for now — per the phased rollout, each additional
 * type (RUNNER, SHIELDBEARER via WardenCreature, DISABLER via
 * WraithCreature) is added only after its own visual pass is validated
 * live, not all at once.
 */
export const ENEMY_3D_REGISTRY: Partial<Record<EnemyType, Enemy3DDefinition>> = {
  // VISUAL POLISH (fase 260 feedback) — BRUTE's 3D pilot is switched OFF:
  // in the real game's lighting its dark materials render as a near-solid
  // black blob (the reported "coisa preta" on enemies), clashing with every
  // other creature's 2D art. Leaving the type out of this registry makes
  // Enemy3DLayer skip it and BRUTE falls back to its normal 2D sprite — the
  // exact fallback contract this registry was designed around. The entry
  // below is kept (commented) so re-enabling after a lighting pass is one line.
  // BRUTE: { Component: BruteCreature, localHeight: 1.65, worldHeight: 26, shadowRadiusRatio: 0.3 },
};

/** Kept referenced so the pilot's import (and its tree-shaken module) stays wired for an easy re-enable. */
export const DISABLED_3D_PILOTS = { BRUTE: BruteCreature } as const;
