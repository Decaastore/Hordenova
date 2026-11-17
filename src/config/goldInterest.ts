/**
 * JUROS — gold kept in the bank grows a little at the end of every wave the
 * player clears, so saving up for a big purchase is a real choice next to
 * spending now. It can only ever be earned by playing: each payment is
 * capped at a share of the gold that same wave's kills paid, so a large
 * idle balance never turns into free income on its own.
 */

/** Share of the banked gold paid as interest at the end of each wave. */
export const INTEREST_RATE = 0.02;
/** A wave's interest never exceeds this share of the gold its kills paid. */
export const INTEREST_CAP_OF_WAVE_GOLD = 0.5;

export function interestForWave(bankedGold: number, waveKillGold: number): number {
  if (bankedGold <= 0 || waveKillGold <= 0) return 0;
  return Math.max(0, Math.floor(Math.min(bankedGold * INTEREST_RATE, waveKillGold * INTEREST_CAP_OF_WAVE_GOLD)));
}
