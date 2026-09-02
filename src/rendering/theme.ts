import type { TowerType } from "@/config/towerStats";
import type { EnemyType } from "@/config/enemyStats";

/**
 * Global UI/identity palette — HUD chrome, panels, and the two universal
 * accent colors (gold, danger/success readouts) that stay constant no
 * matter which biome a level uses. Terrain colors (ground, road, rock,
 * vegetation, water, fog...) are NOT here anymore — those are per-biome
 * now (see ./biomes) so a new stage can look completely different without
 * touching this file. `mapBackgroundFallback` is only the CSS/letterbox
 * color shown for an instant before the canvas paints; it intentionally
 * stays a static dark tone rather than reading the active biome, since it
 * must render before any biome data is even relevant.
 */
export const PALETTE = {
  mapBackgroundFallback: "#211c13",

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
  // Structure reads as weathered wood/iron first, magic second: the old
  // all-green Ironwood blended straight into an all-green forest. Now
  // only the rune energy (accent/glow) carries saturated green — the body
  // is bark and iron, so it stands out against any biome's terrain.
  IRONWOOD: { primary: "#5a4326", secondary: "#291d10", accent: "#9dff6a", glow: "rgba(157,255,106,0.55)" },
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
  // Dark, oily chitin instead of a pastel body — the "danger" now reads
  // through a glowing toxic-green accent (eyes/joints/venom) popping
  // against a near-black shell, not through the shell color itself.
  CRAWLER: { body: "#2f3d1c", dark: "#141a0c", accent: "#c6ff4d" },
  RUNNER: { body: "#f5d23a", dark: "#a8790f", accent: "#fff2a0" },
  BRUTE: { body: "#c9432f", dark: "#7a2418", accent: "#f5a06a" },
  SHIELDBEARER: { body: "#4a78c4", dark: "#1f3f7a", accent: "#b8d4f5" },
  // Four Content Progression archetypes — reuse the closest existing
  // silhouette (see EntityRenderer.drawEnemy's switch) but with their own
  // distinct color identity, so they read as different threats at a
  // glance even without bespoke geometry yet.
  SWARMLING: { body: "#3a4a2a", dark: "#1a220f", accent: "#d4ff8a" }, // pale, washed-out — reads as individually weak
  REGENERATOR: { body: "#2a4a2e", dark: "#12220f", accent: "#5aff8a" }, // healing green glow
  IRONCLAD: { body: "#5a5a62", dark: "#26262c", accent: "#ffb84a" }, // dull steel with a warm rivet glow
  DISABLER: { body: "#3a2a4a", dark: "#180f22", accent: "#c88aff" }, // interference violet
};

/**
 * Visual Design System — status colors used ONLY for state readouts (HP,
 * effects, readiness), never reused as a decorative body/material color.
 * Keeping them exclusive is what lets a player read "wounded" or "ready to
 * fire" at a glance without confusing it with a tower/enemy's own identity
 * color (spec: "cores de status exclusivas").
 */
export const STATUS_COLORS = {
  hpHealthy: "#6fe06f",
  hpWounded: "#f5d23a",
  hpCritical: "#ff4f3a",
  hpTrack: "rgba(20,14,8,0.65)",
  readyPulse: "#fff6d8",
  slow: "#7fd8ff",
  burn: "#ff8a3a",
  critFlash: "#ffe9a0",
  hitFlash: "#ffffff",
} as const;

/**
 * The single consistent light source every hand-drawn shape should shade
 * against: top-left, matching the "iluminação consistente vindo de
 * cima/esquerda" requirement. Highlights go on the side facing this vector;
 * contact shadows are cast toward its opposite.
 */
export const LIGHT_DIRECTION = { x: -0.55, y: -0.83 } as const;
