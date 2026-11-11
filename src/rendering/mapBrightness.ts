/**
 * BRILHO DO MAPA — a per-device display preference for how dark the battlefield
 * looks. "DARK" is the full grim look (cold grade, deep night, heavy mist);
 * "NORMAL" softens it; "BRIGHT" drops the grade and lifts the night so the
 * map reads clearly. Purely cosmetic — it never touches gameplay — and kept
 * in its own localStorage key like the music settings.
 */
export type MapBrightness = "DARK" | "NORMAL" | "BRIGHT";

export const MAP_BRIGHTNESS_LEVELS: readonly MapBrightness[] = ["DARK", "NORMAL", "BRIGHT"];

const STORAGE_KEY = "hordenova.map.brightness.v1";
const DEFAULT: MapBrightness = "NORMAL";

export interface BrightnessFactors {
  /** Strength of the cold color grade and vignette, 0..1. */
  grade: number;
  /** Multiplier on how much the night darkens the scene. */
  night: number;
  /** Multiplier on the ground mist. */
  mist: number;
}

const FACTORS: Record<MapBrightness, BrightnessFactors> = {
  DARK: { grade: 1, night: 1, mist: 1 },
  NORMAL: { grade: 0.35, night: 0.68, mist: 0.5 },
  BRIGHT: { grade: 0, night: 0.45, mist: 0.3 },
};

let current: MapBrightness | null = null;

function isLevel(v: unknown): v is MapBrightness {
  return typeof v === "string" && (MAP_BRIGHTNESS_LEVELS as readonly string[]).includes(v);
}

export function getMapBrightness(): MapBrightness {
  if (current) return current;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    current = isLevel(raw) ? raw : DEFAULT;
  } catch {
    current = DEFAULT;
  }
  return current;
}

export function setMapBrightness(level: MapBrightness): void {
  current = level;
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    /* best-effort: still applies for this session */
  }
}

/** Moves to the next level (Sombrio → Normal → Claro → Sombrio) and returns it. */
export function cycleMapBrightness(): MapBrightness {
  const i = MAP_BRIGHTNESS_LEVELS.indexOf(getMapBrightness());
  const next = MAP_BRIGHTNESS_LEVELS[(i + 1) % MAP_BRIGHTNESS_LEVELS.length]!;
  setMapBrightness(next);
  return next;
}

export function brightnessFactors(level: MapBrightness = getMapBrightness()): BrightnessFactors {
  return FACTORS[level];
}
