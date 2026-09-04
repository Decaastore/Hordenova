/**
 * AUDITORIA E CORREÇÃO GERAL spec sections 23-28 — the real, still-live
 * cause of "a boss got permanently stuck": Frostborn's Deep Freeze can land
 * on the SAME percent (a full 1.0 freeze) repeatedly on a single stationary
 * target — entities/Enemy.ts's `applySlow` already refuses a WEAKER
 * reapplication from extending a stronger effect (see its own doc comment,
 * a prior fix), but a SAME-OR-STRONGER reapplication (which a 100% freeze
 * hitting an already-100%-frozen target always is) legitimately REPLACES
 * the timer with a fresh full duration. Once frozen, a target can't move
 * out of range to break the cycle, so at a high enough freeze chance the
 * effect kept refreshing forever — a genuine, reproducible bug, not
 * something to solve by removing Frostborn or its control identity.
 *
 * The fix (spec sections 24-25): tiered CC RESISTANCE (Normal enemies get
 * full CC, unchanged; Elite/Mini-Boss/Boss get a flat baseline reduction)
 * PLUS diminishing returns (each CC that lands on the SAME target within a
 * short window is weaker than the last, capping at full temporary immunity
 * after the 4th) that decays back to baseline after a few seconds without
 * any further CC — so a boss can be frozen, even frozen HARD, but is
 * mathematically guaranteed to eventually resume moving no matter how often
 * Frostborn keeps rolling its freeze chance. Only entities/Enemy.ts's
 * applySlow reads this — every caller (CombatSystem.ts's Frostborn special,
 * its Focus Fire ultimate) gets the fix automatically, with zero call-site
 * changes needed.
 */

export type CcResistanceTier = "NORMAL" | "ELITE" | "MINI_BOSS" | "BOSS";

/** Flat baseline multiplier applied to incoming CC duration, before diminishing returns — spec section 24's "resistência adequada" per tier. NORMAL is untouched (1 = no reduction, no DR tracking at all). */
const BASE_RESISTANCE_MULTIPLIER: Record<CcResistanceTier, number> = {
  NORMAL: 1,
  ELITE: 0.7,
  MINI_BOSS: 0.5,
  BOSS: 0.35,
};

/**
 * Diminishing-returns multiplier by consecutive-stack index (0 = the first
 * CC application in a clean window). Reaching the last entry means full
 * temporary immunity — spec section 25's "depois: resistência temporária".
 * Shared by every elevated tier; only the BASE multiplier above varies.
 */
const DR_STACK_MULTIPLIERS: readonly number[] = [1, 0.5, 0.25, 0];
export const CC_DR_MAX_STACKS = DR_STACK_MULTIPLIERS.length - 1;

/** How long (ms) a target must go without a NEW stack-increasing CC hit before one stack of resistance decays — spec section 25's "após determinado tempo sem CC, resistência pode reduzir." */
export const CC_DR_DECAY_MS = 5000;

export function getCcResistanceTier(isBoss: boolean, isMainBoss: boolean, isElite: boolean): CcResistanceTier {
  if (isBoss) return isMainBoss ? "BOSS" : "MINI_BOSS";
  if (isElite) return "ELITE";
  return "NORMAL";
}

/** The effective duration multiplier for a CC landing on a target currently at `stacks` (0-indexed) prior stacks. NORMAL tier is always 1 regardless of stacks (it never accumulates any). */
export function getCcDurationMultiplier(tier: CcResistanceTier, stacks: number): number {
  if (tier === "NORMAL") return 1;
  const clampedStacks = Math.min(Math.max(stacks, 0), CC_DR_MAX_STACKS);
  return BASE_RESISTANCE_MULTIPLIER[tier] * DR_STACK_MULTIPLIERS[clampedStacks]!;
}
