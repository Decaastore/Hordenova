import type { TowerType } from "@/config/towerStats";
import type { EnemyType } from "@/config/enemyStats";

/**
 * Single shared color/identity palette for the whole visual layer — map,
 * entities, HUD and menu all pull from here so the game reads as one
 * consistent dark-fantasy world instead of "game canvas + web dashboard"
 * (Phase 2 spec section 12). Purely presentational: nothing here is a
 * gameplay number, so it lives outside config/ (which stays balance-only).
 */
export const PALETTE = {
  skyTop: "#120e1c",
  skyBottom: "#080610",
  forestFar: "#1c1628",
  forestNear: "#100c1a",
  groundShadow: "rgba(5,3,10,0.55)",

  roadFill: "#4a405e",
  roadFillDark: "#352c46",
  roadEdge: "#241c33",
  roadRut: "rgba(20,14,28,0.35)",

  slotClearing: "#2e4022",
  slotStone: "#4a4557",
  slotRuin: "#5a4d42",
  slotMagic: "#3a2f5c",

  crystal: "#8ad9ff",
  crystalWarm: "#c99bff",
  fog: "rgba(150,140,200,0.05)",
  vignette: "rgba(3,2,6,0.65)",

  uiPanelBg: "rgba(13,10,20,0.93)",
  uiPanelBorder: "#463a5e",
  uiAccent: "#c9a8ff",
  uiAccentBright: "#e9d9ff",
  uiText: "#f1ecff",
  uiTextDim: "#a99bc7",
  gold: "#e8c15a",
  danger: "#e2574a",
  success: "#7be07b",
} as const;

interface TowerTheme {
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
}

export const TOWER_THEME: Record<TowerType, TowerTheme> = {
  IRONWOOD: { primary: "#6f9c4f", secondary: "#3c5e2c", accent: "#c8f0a0", glow: "rgba(140,220,110,0.55)" },
  INFERNO: { primary: "#e2572b", secondary: "#7a2a12", accent: "#ffcf7a", glow: "rgba(255,130,50,0.6)" },
  FROSTBORN: { primary: "#4fb3d9", secondary: "#1f4f66", accent: "#d5f4ff", glow: "rgba(140,220,255,0.55)" },
  STORMCALLER: { primary: "#a05bd9", secondary: "#4a2166", accent: "#ecd6ff", glow: "rgba(200,150,255,0.6)" },
};

interface EnemyTheme {
  body: string;
  dark: string;
  accent: string;
}

export const ENEMY_THEME: Record<EnemyType, EnemyTheme> = {
  CRAWLER: { body: "#5f8f4a", dark: "#33502a", accent: "#9fd97a" },
  RUNNER: { body: "#d9c246", dark: "#7a6a20", accent: "#f5e896" },
  BRUTE: { body: "#8a3a3a", dark: "#4a1c1c", accent: "#d97a7a" },
  SHIELDBEARER: { body: "#5a6a8a", dark: "#2c3650", accent: "#a8bce0" },
};
