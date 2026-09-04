/** Compact "5d 13h" / "13h 4m" / "4m" countdown text — used by the Ascension mode-select card and HUD badge (spec section 1's mockup: "ENDS IN 5d 13h"). Never negative — a clock at/after its boundary reads as "0m". */
export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
