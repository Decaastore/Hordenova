import type { TowerType } from "@/config/towerStats";
import type { EnemyType } from "@/config/enemyStats";

/**
 * Single shared color/identity palette for the whole visual layer — map,
 * entities, HUD and menu all pull from here so the game reads as one
 * consistent world (spec section 12). Purely presentational: nothing here
 * is a gameplay number, so it lives outside config/ (which stays
 * balance-only).
 *
 * Art direction: EPIC FANTASY / MEDIEVAL ADVENTURE — bright, colorful,
 * cinematic, premium. Rich forest greens, warm gold light, natural stone
 * and earth tones, vivid magic (violet portal, blue ice, orange fire,
 * purple lightning). Explicitly NOT dark-fantasy/horror: no near-black
 * grounds, no desaturated grey-on-grey, no heavy black vignette.
 */
export const PALETTE = {
  skyGlow: "#fbe9a8",
  canopyLight: "#8fce5a",
  canopyMid: "#5fa83c",
  canopyDark: "#3d7a28",
  groundShadow: "rgba(40,55,20,0.25)",

  roadFill: "#d9b878",
  roadFillLight: "#ecd39c",
  roadEdge: "#8a6238",
  roadRut: "rgba(120,85,45,0.32)",

  slotClearing: "#8fce5a",
  slotStone: "#c9bd9e",
  slotRuin: "#b89468",
  slotMagic: "#b980f0",

  crystal: "#5ecdf5",
  crystalWarm: "#ffb84a",
  portal: "#c060f5",
  torchFlame: "#ffa63a",
  water: "#4fa8d8",
  waterLight: "#a8e0f0",
  fog: "rgba(255,248,225,0.07)",
  vignette: "rgba(35,22,10,0.32)",

  uiPanelBg: "rgba(43,29,18,0.94)",
  uiPanelBorder: "#c9963f",
  uiAccent: "#ffcf5e",
  uiAccentBright: "#fff2c9",
  uiText: "#fdf6e8",
  uiTextDim: "#d3b98d",
  gold: "#ffd257",
  danger: "#e8503a",
  success: "#7fd857",
} as const;

interface TowerTheme {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
}

export const TOWER_THEME: Record<TowerType, TowerTheme> = {
  IRONWOOD: { primary: "#5fb83f", secondary: "#2f6b1f", accent: "#d4f79a", glow: "rgba(120,230,80,0.6)" },
  INFERNO: { primary: "#ff6a2e", secondary: "#a8340f", accent: "#ffd875", glow: "rgba(255,140,50,0.65)" },
  FROSTBORN: { primary: "#4ec4f0", secondary: "#1a6f96", accent: "#dcf9ff", glow: "rgba(120,220,255,0.6)" },
  STORMCALLER: { primary: "#a860f0", secondary: "#5a2590", accent: "#ecd4ff", glow: "rgba(190,130,255,0.65)" },
};

interface EnemyTheme {
  body: string;
  dark: string;
  accent: string;
}

export const ENEMY_THEME: Record<EnemyType, EnemyTheme> = {
  CRAWLER: { body: "#7fc450", dark: "#3f7a28", accent: "#d4f79a" },
  RUNNER: { body: "#f5d23a", dark: "#a8790f", accent: "#fff2a0" },
  BRUTE: { body: "#c9432f", dark: "#7a2418", accent: "#f5a06a" },
  SHIELDBEARER: { body: "#4a78c4", dark: "#1f3f7a", accent: "#b8d4f5" },
};
