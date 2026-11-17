import type { TowerType } from "./towerStats";

/**
 * ELEMENTO DA ONDA — every wave (after the first few, and except boss waves)
 * comes charged with one of the four elements. The element that beats it
 * hits harder, the same element is resisted; the other two are unchanged:
 *
 *   Fire burns Nature · Nature grounds Storm · Storm shatters Ice · Ice quenches Fire
 *
 * so Inferno shines on Nature waves, Ironwood on Storm waves, Stormcaller on
 * Ice waves and Frostborn on Fire waves. The next wave's element is shown
 * in the HUD ahead of time, so a player can prepare.
 *
 * BÊNÇÃO ELEMENTAL — every 5 waves cleared, the player may pick one element
 * to bless: that element's towers hit harder for the next 5 waves. It never
 * blocks the game: an unchosen blessing simply waits.
 */

export type WaveElement = "FIRE" | "ICE" | "STORM" | "NATURE";
export const WAVE_ELEMENTS: readonly WaveElement[] = ["FIRE", "ICE", "STORM", "NATURE"];

export const ELEMENT_OF_TOWER: Record<TowerType, WaveElement> = {
  INFERNO: "FIRE",
  FROSTBORN: "ICE",
  STORMCALLER: "STORM",
  IRONWOOD: "NATURE",
};

/** X beats BEATS[X]. */
export const BEATS: Record<WaveElement, WaveElement> = { FIRE: "NATURE", NATURE: "STORM", STORM: "ICE", ICE: "FIRE" };

/** The tower element that beats a wave of `el`. */
export function counterOf(el: WaveElement): WaveElement {
  return WAVE_ELEMENTS.find((x) => BEATS[x] === el)!;
}

/** Damage of the element that beats the wave, and of the wave's own element. */
export const ELEMENT_STRONG_MULT = 1.3;
export const ELEMENT_RESIST_MULT = 0.75;

/** No element on the first waves (time to learn the basics). */
export const ELEMENT_FIRST_WAVE = 6;

/** The element a wave carries, or null (early waves and boss waves — a boss fights on its own terms). Deterministic per wave. */
export function waveElementFor(wave: number, isBossWave = false): WaveElement | null {
  if (wave < ELEMENT_FIRST_WAVE || isBossWave) return null;
  // murmur3 finalizer — a full avalanche, so neighbouring waves really differ
  // (a bare multiplicative hash left its low bits in long runs of one element)
  let h = (wave + 0x9e3779b9) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return WAVE_ELEMENTS[h >>> 30]!;
}

/** Damage multiplier for each tower type against a wave of `el` (1 everywhere when there is none). */
export function elementMultipliers(el: WaveElement | null): Record<TowerType, number> {
  const out: Record<TowerType, number> = { IRONWOOD: 1, INFERNO: 1, FROSTBORN: 1, STORMCALLER: 1 };
  if (!el) return out;
  for (const t of Object.keys(out) as TowerType[]) {
    const e = ELEMENT_OF_TOWER[t];
    if (BEATS[e] === el) out[t] = ELEMENT_STRONG_MULT;
    else if (e === el) out[t] = ELEMENT_RESIST_MULT;
  }
  return out;
}

/** A blessing is offered every this many cleared waves, and lasts this many waves. */
export const BLESSING_EVERY = 5;
export const BLESSING_WAVES = 5;
/** Damage of the blessed element's towers while it lasts. */
export const BLESSING_MULT = 1.15;

export interface Blessing {
  element: WaveElement;
  /** The last wave it still applies to. */
  untilWave: number;
}
