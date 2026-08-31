/**
 * Blessing system — architecture placeholder only.
 * NOT wired into the engine in this phase. A future phase will add a
 * BLESSING run phase (triggered every 5 waves per spec) that pauses the
 * run, offers `BLESSING_CHOICES_PER_OFFER` entries drawn from the registry
 * below, and applies the chosen modifier's effect to the run.
 */

export type BlessingCategory = "OFFENSE" | "DEFENSE" | "ECONOMY" | "UTILITY";

export interface BlessingDefinition {
  id: string;
  name: string;
  category: BlessingCategory;
  description: string;
}

export const BLESSING_OFFER_INTERVAL_WAVES = 5;
export const BLESSING_CHOICES_PER_OFFER = 3;

/** Empty for now — populate when the Blessing phase is implemented. */
export const BLESSING_REGISTRY: readonly BlessingDefinition[] = [];
