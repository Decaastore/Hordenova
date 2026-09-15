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

/** MARKETPLACE / LEILÃO spec — precise "HH:MM:SS" (or "Dd HH:MM:SS" past 24h) auction countdown clock, matching the spec's own worked example ("02:41:18"). Never negative — an expired auction reads as "00:00:00" until settlement updates its status. */
export function formatCountdownClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}
