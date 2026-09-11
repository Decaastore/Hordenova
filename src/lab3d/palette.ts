import { TOWER_THEME, ENEMY_THEME } from "@/rendering/theme";
import { ANCIENT_FOREST } from "@/rendering/biomes/ancientForest";

/**
 * TESTE VISUAL 3D — read-only bridge from the REAL HORDENOVA identity
 * (tower colors, biome palette) to Three.js-friendly hex numbers. This is
 * the only file in `src/lab3d/` that imports from the production game, and
 * it only imports color CONSTANTS — never a type, function, or value that
 * could pull in game logic, balance, or persisted state. The whole point
 * of the 3D prototype is to prove the SAME identity (Ironwood is warm
 * bark+rune-green, Ancient Forest is damp olive/moss, never a flat
 * saturated green) can carry into a real 3D scene, not to invent a new one.
 */

/** "#rrggbb" or "rgba(...)" CSS -> 0xRRGGBB, ignoring alpha (Three.js materials take opacity separately). */
function cssToHex(css: string): number {
  if (css.startsWith("#")) return parseInt(css.slice(1), 16);
  const m = css.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return 0xffffff;
  const [, r, g, b] = m;
  return (Number(r) << 16) | (Number(g) << 8) | Number(b);
}

export const FOREST = {
  groundBase: cssToHex(ANCIENT_FOREST.palette.groundBase),
  groundShadowed: cssToHex(ANCIENT_FOREST.palette.groundShadowed),
  groundAccentA: cssToHex(ANCIENT_FOREST.palette.groundAccentA),
  groundAccentB: cssToHex(ANCIENT_FOREST.palette.groundAccentB),
  roadFill: cssToHex(ANCIENT_FOREST.palette.roadFill),
  roadFillLight: cssToHex(ANCIENT_FOREST.palette.roadFillLight),
  roadEdge: cssToHex(ANCIENT_FOREST.palette.roadEdge),
  vegetationPrimary: cssToHex(ANCIENT_FOREST.palette.vegetationPrimary),
  vegetationSecondary: cssToHex(ANCIENT_FOREST.palette.vegetationSecondary),
  vegetationDark: cssToHex(ANCIENT_FOREST.palette.vegetationDark),
  vegetationHighlight: cssToHex(ANCIENT_FOREST.palette.vegetationHighlight),
  rock: cssToHex(ANCIENT_FOREST.palette.rock),
  rockDark: cssToHex(ANCIENT_FOREST.palette.rockDark),
  waterDeep: cssToHex(ANCIENT_FOREST.palette.waterDeep),
  waterLight: cssToHex(ANCIENT_FOREST.palette.waterLight),
  accentGlow: cssToHex(ANCIENT_FOREST.palette.accentGlow),
  accentWarm: cssToHex(ANCIENT_FOREST.palette.accentWarm),
  skyTop: cssToHex(ANCIENT_FOREST.palette.skyTop),
  skyBottom: cssToHex(ANCIENT_FOREST.palette.skyBottom),
  fog: cssToHex(ANCIENT_FOREST.palette.groundShadowed),
} as const;

export const TOWERS_3D = {
  IRONWOOD: {
    primary: cssToHex(TOWER_THEME.IRONWOOD.primary),
    secondary: cssToHex(TOWER_THEME.IRONWOOD.secondary),
    accent: cssToHex(TOWER_THEME.IRONWOOD.accent),
    glow: cssToHex(TOWER_THEME.IRONWOOD.glow),
  },
  INFERNO: {
    primary: cssToHex(TOWER_THEME.INFERNO.primary),
    secondary: cssToHex(TOWER_THEME.INFERNO.secondary),
    accent: cssToHex(TOWER_THEME.INFERNO.accent),
    glow: cssToHex(TOWER_THEME.INFERNO.glow),
  },
  FROSTBORN: {
    primary: cssToHex(TOWER_THEME.FROSTBORN.primary),
    secondary: cssToHex(TOWER_THEME.FROSTBORN.secondary),
    accent: cssToHex(TOWER_THEME.FROSTBORN.accent),
    glow: cssToHex(TOWER_THEME.FROSTBORN.glow),
  },
  STORMCALLER: {
    primary: cssToHex(TOWER_THEME.STORMCALLER.primary),
    secondary: cssToHex(TOWER_THEME.STORMCALLER.secondary),
    accent: cssToHex(TOWER_THEME.STORMCALLER.accent),
    glow: cssToHex(TOWER_THEME.STORMCALLER.glow),
  },
} as const;

export const CREATURES_3D = {
  RUNNER: { body: cssToHex(ENEMY_THEME.RUNNER.body), dark: cssToHex(ENEMY_THEME.RUNNER.dark), accent: cssToHex(ENEMY_THEME.RUNNER.accent) },
  BRUTE: { body: cssToHex(ENEMY_THEME.BRUTE.body), dark: cssToHex(ENEMY_THEME.BRUTE.dark), accent: cssToHex(ENEMY_THEME.BRUTE.accent) },
  SHIELDBEARER: {
    body: cssToHex(ENEMY_THEME.SHIELDBEARER.body),
    dark: cssToHex(ENEMY_THEME.SHIELDBEARER.dark),
    accent: cssToHex(ENEMY_THEME.SHIELDBEARER.accent),
  },
  DISABLER: { body: cssToHex(ENEMY_THEME.DISABLER.body), dark: cssToHex(ENEMY_THEME.DISABLER.dark), accent: cssToHex(ENEMY_THEME.DISABLER.accent) },
} as const;

export const GOLD = 0xffd257;
