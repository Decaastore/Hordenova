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
  gem: "#c88aff",
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

  // -------------------------------------------------------------------
  // 10-biome expansion — each archetype gets its own color identity tied
  // to its biome's material/atmosphere, never a recolor of an existing
  // entry (see EntityRenderer/biomeCreatures for the bespoke geometry).
  // -------------------------------------------------------------------
  FORGECRAWLER: { body: "#4a3a2c", dark: "#201810", accent: "#ff9a3a" }, // dull mineral hide, forge-ember accent
  DEEPDELVER: { body: "#3a3230", dark: "#181412", accent: "#ffcf6a" }, // grimy miner leather, lantern-gold accent
  MAGMAJAW: { body: "#524238", dark: "#241c16", accent: "#ff7a3a" }, // stone plating, hot-jaw ember accent
  BONE_STALKER: { body: "#c8bfa8", dark: "#5a5648", accent: "#8fa878" }, // bleached bone, sickly graveyard moss
  RIBCRAWLER: { body: "#b0a68e", dark: "#4a453a", accent: "#9ab08a" }, // bone shell, faint moss glow
  GRAVEWING: { body: "#8a8272", dark: "#3a362e", accent: "#c9d6a8" }, // dry membrane, pale bone-light accent
  CLOUDFANG: { body: "#8fa8c4", dark: "#3a4a5e", accent: "#eaf6ff" }, // pale sky-fur, cloud-white accent
  SKY_MANTA: { body: "#5a7ca0", dark: "#28394c", accent: "#bfe4ff" }, // deep sky-blue glide membrane
  STORM_TALON: { body: "#4a5468", dark: "#20242e", accent: "#ffe98a" }, // storm-grey feather, electric-yellow accent
  SUNSCARAB: { body: "#a8862c", dark: "#4a3a10", accent: "#ffe27a" }, // aged gold carapace
  TEMPLE_GUARDIAN: { body: "#8a7a5a", dark: "#3a3222", accent: "#ffd88a" }, // sun-baked stone and bronze
  SOLAR_SERPENT: { body: "#d8cfa8", dark: "#6a6248", accent: "#fff2b0" }, // pale scale, subtle inner glow
  SHARDCRAWLER: { body: "#5a6a7a", dark: "#242e38", accent: "#8fe6ff" }, // dark rock, crystal-cyan accent
  CRYSTAL_MAW: { body: "#4a5868", dark: "#1e2630", accent: "#a4e8ff" }, // heavier crystal-armored rock
  PRISM_WRAITH: { body: "#7a86a8", dark: "#343c52", accent: "#e0c8ff" }, // translucent mineral-fragment violet
  ABYSS_CRAWLER: { body: "#2e2a38", dark: "#131018", accent: "#7a6aff" }, // near-black chitin, void-purple accent
  CHAINBOUND: { body: "#3a3438", dark: "#181518", accent: "#9a8a70" }, // rusted-chain iron and dull bronze
  VOID_BAT: { body: "#26202e", dark: "#0e0b12", accent: "#a68aff" }, // deep cave-dark, void accent
  ASH_HOUND: { body: "#4a4340", dark: "#201c1a", accent: "#c4a888" }, // charred hide, dull ember-ash accent
  PETRIFIED_STALKER: { body: "#6a6258", dark: "#2c2822", accent: "#d8c8a0" }, // stone-grey hide, pale ash accent
  CINDERWING: { body: "#3a3430", dark: "#181614", accent: "#c49868" }, // ash-grey wing, faint cinder accent
  MOONFANG: { body: "#3a3d4a", dark: "#181a20", accent: "#c9d8ff" }, // dark silver-blue fur, moonlight eyes
  BLOOM_HORROR: { body: "#2e3a2a", dark: "#141a10", accent: "#d88aff" }, // deep foliage, eerie violet bloom
  LUNAMOTH: { body: "#4a4a68", dark: "#20202e", accent: "#dce6ff" }, // dusky wing, luminous pale accent
  GRAVE_KNIGHT: { body: "#3a3838", dark: "#181717", accent: "#7aa8a0" }, // tarnished ancient armor, ghost-teal accent
  GARGOYLE_BEAST: { body: "#5a5a5e", dark: "#262628", accent: "#8fb8ac" }, // weathered stone-flesh, moss-teal accent
  BELL_WRAITH: { body: "#6a6a78", dark: "#2c2c34", accent: "#d8d8f0" }, // pale mist grey, bell-metal shimmer
  TIDE_RIPPER: { body: "#2c4a48", dark: "#12201e", accent: "#7affe0" }, // slick amphibious hide, tide-glow accent
  DEEPMAW: { body: "#22383e", dark: "#0e1a1e", accent: "#5adfff" }, // abyssal-blue hide, bioluminescent accent
  BONEFIN: { body: "#4a5a5a", dark: "#202a2a", accent: "#c8f0e8" }, // pale scale-and-bone, sea-foam accent
};

/**
 * FASE 2 (creature art pass) — per-archetype visual scale, purely cosmetic
 * (CanvasRenderer's own `archetypeScale` multiplier, never touching
 * baseHp/baseSpeed/hitbox/targeting in enemyStats.ts or CombatSystem.ts).
 * Reinforces the "Common < Elite < Mini-Boss < Boss" hierarchy the user
 * asked for by also separating heavy/tanky archetypes from small/fast ones
 * WITHIN the Common tier, so silhouette bulk already hints at role before
 * a player ever reads a stat. SWARMLING (0.65) and IRONCLAD (1.15) are the
 * two pre-existing entries this table already had; every other key here is
 * new (10-biome expansion roster). Anything absent defaults to 1 exactly
 * like before.
 */
export const ARCHETYPE_VISUAL_SCALE: Partial<Record<EnemyType, number>> = {
  SWARMLING: 0.65,
  IRONCLAD: 1.15,
  // Cidade Subterrânea dos Anões.
  FORGECRAWLER: 0.8,
  DEEPDELVER: 0.95,
  MAGMAJAW: 1.25,
  // Cemitério dos Colossos.
  BONE_STALKER: 0.85,
  RIBCRAWLER: 0.9,
  GRAVEWING: 0.75,
  // Ilhas Flutuantes.
  CLOUDFANG: 0.8,
  SKY_MANTA: 1.05,
  STORM_TALON: 0.8,
  // Templo Solar Perdido.
  SUNSCARAB: 0.95,
  TEMPLE_GUARDIAN: 1.3,
  SOLAR_SERPENT: 1.0,
  // Mar de Cristal.
  SHARDCRAWLER: 0.8,
  CRYSTAL_MAW: 1.2,
  PRISM_WRAITH: 0.75,
  // Fortaleza Abissal.
  ABYSS_CRAWLER: 0.85,
  CHAINBOUND: 1.15,
  VOID_BAT: 0.65,
  // Vale das Cinzas Mortas.
  ASH_HOUND: 0.85,
  PETRIFIED_STALKER: 1.0,
  CINDERWING: 0.7,
  // Jardins da Lua.
  MOONFANG: 0.85,
  BLOOM_HORROR: 1.15,
  LUNAMOTH: 0.75,
  // Catedral Profanada.
  GRAVE_KNIGHT: 1.15,
  GARGOYLE_BEAST: 1.05,
  BELL_WRAITH: 0.85,
  // Península dos Leviatãs.
  TIDE_RIPPER: 0.9,
  DEEPMAW: 1.25,
  BONEFIN: 0.7,
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
  /** SHIELD DURANTE O MODO ENFURECIDO (config/enrageShield.ts) — a distinct icy-violet ward color, never reused elsewhere, so a shielded Boss/Mini-Boss reads unmistakably differently from the enrage aura's own red or the slow ring's plain blue. */
  enrageShield: "#8ec9ff",
} as const;

/**
 * The single consistent light source every hand-drawn shape should shade
 * against: top-left, matching the "iluminação consistente vindo de
 * cima/esquerda" requirement. Highlights go on the side facing this vector;
 * contact shadows are cast toward its opposite.
 */
export const LIGHT_DIRECTION = { x: -0.55, y: -0.83 } as const;
