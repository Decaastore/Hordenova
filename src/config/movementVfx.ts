import type { EnemyType } from "./enemyStats";

/**
 * AUDITORIA E CORREÇÃO GERAL spec sections 33-38 — "os inimigos precisam
 * parecer mais vivos enquanto caminham." Deliberately NOT one category per
 * archetype (spec section 34's own warning: "não colocar tudo em todos os
 * inimigos") — only archetypes whose existing identity (role/theme.ts
 * accent color, established in earlier phases) actually maps onto one of
 * these categories get a movement VFX; the rest keep their plain silhouette,
 * which is itself a legible signal ("this one's just a basic threat").
 *
 * Categories intentionally cover only what this roster's 8 archetypes
 * actually call for (heavy/fast/organic/dark) rather than every category
 * the spec lists as merely possible (fire/ice/magic belong to TOWER
 * identity in this game — Inferno/Frostborn/Stormcaller — not to any enemy
 * archetype, so inventing an enemy-side fire/ice/magic trail would blur an
 * identity line the rest of the codebase deliberately keeps clean).
 */
export type MovementVfxCategory = "DUST" | "TRAIL" | "WISP" | "SHADOW";

const MOVEMENT_VFX_BY_TYPE: Partial<Record<EnemyType, MovementVfxCategory>> = {
  // Heavy: BRUTE/SHIELDBEARER/IRONCLAD read as slow, weighty threats —
  // small ground-impact dust puffs sell that weight without new art.
  BRUTE: "DUST",
  SHIELDBEARER: "DUST",
  IRONCLAD: "DUST",
  // Fast: RUNNER/SWARMLING are built to slip past slow-firing towers — a
  // subtle motion streak reinforces "built to outrun your defense" at a glance.
  RUNNER: "TRAIL",
  SWARMLING: "TRAIL",
  // Organic: REGENERATOR's whole identity is steadily healing — a faint
  // green wisp ties its movement to that same regenerating-life read.
  REGENERATOR: "WISP",
  // Interference: DISABLER's whole identity is jamming towers, not combat
  // stats — a dark, faintly unsettling particle trail matches "the build
  // itself is the target" without implying it's an elemental/magic unit.
  DISABLER: "SHADOW",
  // CRAWLER stays plain on purpose — the baseline "no particular weakness,
  // no particular flair" enemy every other archetype is compared against.
};

export function getMovementVfxCategory(type: EnemyType): MovementVfxCategory | null {
  return MOVEMENT_VFX_BY_TYPE[type] ?? null;
}
