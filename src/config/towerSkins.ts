import type { TowerType } from "./towerStats";

/**
 * TOWER SKIN SYSTEM v2 — "FASE ADICIONAL: TOWER SKIN SYSTEM + PREMIUM GEM
 * SKINS". The original architecture (still true below) shipped exactly one
 * real skin per tower type, and that skin was ONLY a 4-color palette swap
 * plus a dead `ornament` flag EntityRenderer.ts never actually read — so
 * every "skin" in the game read as a recolor, not a different tower. This
 * pass keeps every structural guarantee (a skin NEVER appears in
 * TowerLevelStats/TowerSpecial and is never read by CombatSystem.ts — see
 * towerSkins.test.ts) while giving a skin real visual authority over five
 * independent axes read by rendering/EntityRenderer.ts's draw{Type}
 * functions and drawProjectile: `material` (a shading/overlay treatment
 * applied to the body), `coreShape` (the tower's focal "power source" —
 * ballista knot / furnace mouth / frozen core / rune orb — swapped for a
 * skin-specific shape), `weaponDetail` (one extra structural element added
 * at the weapon/silhouette), `particleStyle` (idle ambient particle
 * color+behavior), and `projectileStyle` (the fired shot + its impact).
 * `coreShape`/`weaponDetail`/`projectileStyle` are free-form string keys —
 * each tower type has its own vocabulary of them (an "eye" makes sense for
 * Ironwood's abyssal skin, not for Frostborn's), matched by a `switch` in
 * that tower's own draw function; an unrecognized key safely falls back to
 * the tower's default look instead of throwing, so this stays additive and
 * never breaks if a skin ships before its renderer branch does.
 *
 * `paletteOverride` mirrors rendering/theme.ts's TowerTheme shape exactly
 * (primary/secondary/accent/glow) so applying a skin is still just "merge
 * these fields over the base theme before drawing."
 *
 * Every skin keeps the tower's exact TOWER_PRESENTATION_SCALE footprint —
 * a skin only ever adds detail/color/particles/projectile identity, never a
 * bigger silhouette (Regra Absoluta Nº 1 from the tower redesign pass
 * applies equally to skins).
 */

export interface TowerSkinPaletteOverride {
  primary?: string;
  secondary?: string;
  accent?: string;
  glow?: string;
}

/**
 * A shading/overlay treatment applied to the body in EntityRenderer's
 * `applySkinMaterialFinish` helper — the same handful of finishes are
 * reused across towers (a "corrupted" Ironwood and a "corrupted" Inferno
 * both get dark cracks + a sickly inner glow, in each tower's own palette)
 * so a modest, hand-tuned set of finishes covers 20 skins without each one
 * needing bespoke shading code.
 */
export type SkinMaterialFinish =
  | "organic"
  | "corrupted"
  | "radiant"
  | "mechanical"
  | "bone"
  | "armored"
  | "molten"
  | "industrial"
  | "celestial"
  | "toxic"
  | "natural"
  | "voidtouched"
  | "prismatic"
  | "glacial"
  | "tempest";

/** Idle ambient-particle personality — consumed by EntityRenderer's per-tower drawFloatingMotes call, which already accepts color/count/spread/period, so a behavior here maps to a tuned preset of those rather than a wholly new particle system. */
export type SkinParticleBehavior =
  | "spores"
  | "embers"
  | "void-wisps"
  | "light-motes"
  | "circuit-pulses"
  | "spirit-wisps"
  | "sparks"
  | "steam"
  | "solar-flares"
  | "toxic-bubbles"
  | "drifting-leaves"
  | "prism-sparkles"
  | "starlight"
  | "frost-shards"
  | "wind-swirl";

export interface SkinParticleStyle {
  color: string;
  behavior: SkinParticleBehavior;
}

/**
 * HORDENOVA Season/Progression v1.0 — commercial tier, one of three fixed
 * price points (see TOWER_SKIN_TIER_PRICES). Purely a pricing classification
 * — never read by combat code, never affects catalog/ownership/equip logic.
 */
export type TowerSkinTier = "ENTRY" | "INTERMEDIATE" | "PREMIUM" | "PRESTIGE";

/**
 * The three approved commercial price points, in Gems, plus PRESTIGE (0 —
 * never sold, see PRESTIGE_TOWER_SKINS below). Every COMMERCIAL skin's
 * `gemCost` must equal its tier's price here — see towerSkins.test.ts, which
 * only ever iterates TOWER_SKINS, never PRESTIGE_TOWER_SKINS.
 */
export const TOWER_SKIN_TIER_PRICES: Record<TowerSkinTier, number> = {
  ENTRY: 120,
  INTERMEDIATE: 350,
  PREMIUM: 800,
  PRESTIGE: 0,
};

export interface TowerSkinDefinition {
  id: string;
  towerType: TowerType;
  /** i18n key: towerSkins.<id>.name / .description / .attribute.name / .attribute.description */
  i18nKey: string;
  paletteOverride: TowerSkinPaletteOverride;
  /** Minimum tower level the tower must reach (in any Season) before this skin becomes PURCHASABLE — purely a cosmetic-eligibility gate, never a stat requirement. Reaching this level does not itself grant the skin; see `gemCost`. */
  unlockLevel: number;
  /** Commercial tier — its price (`gemCost`) is always TOWER_SKIN_TIER_PRICES[tier]. */
  tier: TowerSkinTier;
  /**
   * CORREÇÃO DE REQUISITOS (PRÓXIMA GRANDE FASE) — a skin must be ACQUIRED
   * with Gems, never handed out for free on reaching `unlockLevel`, and
   * never buyable with Gold. Paid once, owned permanently thereafter (see
   * SaveData.ownedTowerSkinIds) — a tower's level resetting at a new Season
   * never revokes an already-purchased skin. See GameEngine.purchaseTowerSkin.
   */
  gemCost: number;

  /** Body shading/overlay treatment — see SkinMaterialFinish's own doc comment. */
  material: SkinMaterialFinish;
  /** This tower type's focal "power source" shape, swapped for the skin's own — e.g. Ironwood's wood-knot becomes a void-eye, a halo, a gear-core, a spirit-skull, or a forge-core. Read by that tower's own draw function; an unrecognized value draws the default shape. */
  coreShape: string;
  /** One extra structural element added at the weapon/silhouette (tendrils, a halo ring, gear teeth, hunting trophies, armor plates, horns, obsidian plating, pressure gauges, a solar corona, vents, moss growth, dark icicles, a crystal array, an aurora crown, ice armor plating, void rods, heavy lightning rods, halo rods, rune rods, wind rods...). Read by that tower's own draw function; an unrecognized value draws nothing extra (falls back to the base silhouette). */
  weaponDetail: string;
  /** Idle ambient particles — see SkinParticleStyle. */
  particleStyle: SkinParticleStyle;
  /** The fired projectile's shape/trail/impact identity — read by EntityRenderer.drawProjectile via the tower's equipped skin (threaded through ProjectileInstance.skinId, set at fire time by CombatSystem). An unrecognized value draws the tower type's default projectile. */
  projectileStyle: string;
  /**
   * Shown in the shop as "Cosmetic Attribute — <name>". This is NOT a
   * second mechanic: it is the shop-facing NAME for this skin's own
   * `projectileStyle` (its attack visual signature) — one skin, one visual
   * identity, described once in flavor text and drawn once by the
   * renderer. Never read by CombatSystem/getTowerStats/getTowerSpecialAtLevel
   * — see towerSkins.test.ts's "cosmetic attribute never touches gameplay"
   * guarantee.
   */
  cosmeticAttribute: { i18nKey: string };
}

export const TOWER_SKINS: readonly TowerSkinDefinition[] = [
  // ---------------------------------------------------------------------
  // IRONWOOD — Precision Siege / Ballista. Every skin keeps the ballista
  // arms + drawstring + hooded operator readable; only material, core,
  // one weapon accent, particles, and the arrow's own identity change.
  // ---------------------------------------------------------------------
  {
    // REFORMULATED (was a black-stone/void palette swap with a dead
    // "abyss" ornament flag). Same id — a player who already owns this
    // keeps owning it — now genuinely rebuilt: the wood-knot core becomes
    // a corrupted void-eye, shadow tendrils wrap the ballista arms, and
    // the arrow itself carries a trailing void signature.
    id: "IRONWOOD_WARDEN_OF_THE_ABYSS",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_WARDEN_OF_THE_ABYSS",
    paletteOverride: { primary: "#201820", secondary: "#0a070a", accent: "#8a3fff", glow: "rgba(138,63,255,0.6)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "corrupted",
    coreShape: "void-eye",
    weaponDetail: "tendrils",
    particleStyle: { color: "#8a3fff", behavior: "void-wisps" },
    projectileStyle: "void-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_WARDEN_OF_THE_ABYSS" },
  },
  {
    id: "IRONWOOD_CELESTIAL_WARDEN",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_CELESTIAL_WARDEN",
    paletteOverride: { primary: "#e8dcc0", secondary: "#a89468", accent: "#fff2c9", glow: "rgba(255,230,150,0.7)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "radiant",
    coreShape: "halo",
    weaponDetail: "halo-ring",
    particleStyle: { color: "#fff2c9", behavior: "light-motes" },
    projectileStyle: "radiant-arrow",
    cosmeticAttribute: { i18nKey: "IRONWOOD_CELESTIAL_WARDEN" },
  },
  {
    id: "IRONWOOD_ARCANE_ENGINE",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_ARCANE_ENGINE",
    paletteOverride: { primary: "#4a5560", secondary: "#1c2228", accent: "#6adfff", glow: "rgba(106,223,255,0.6)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "mechanical",
    coreShape: "gear-core",
    weaponDetail: "gear-array",
    particleStyle: { color: "#6adfff", behavior: "circuit-pulses" },
    projectileStyle: "energy-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_ARCANE_ENGINE" },
  },
  {
    id: "IRONWOOD_ANCIENT_HUNTER",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_ANCIENT_HUNTER",
    paletteOverride: { primary: "#6a5a3a", secondary: "#2a2216", accent: "#8fffb0", glow: "rgba(143,255,176,0.55)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "bone",
    coreShape: "spirit-skull",
    weaponDetail: "trophies",
    particleStyle: { color: "#8fffb0", behavior: "spirit-wisps" },
    projectileStyle: "spirit-arrow",
    cosmeticAttribute: { i18nKey: "IRONWOOD_ANCIENT_HUNTER" },
  },
  {
    id: "IRONWOOD_IRONCLAD_JUGGERNAUT",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_IRONCLAD_JUGGERNAUT",
    paletteOverride: { primary: "#2c2f33", secondary: "#121315", accent: "#ff8a3a", glow: "rgba(255,138,58,0.55)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "armored",
    coreShape: "forge-core",
    weaponDetail: "plates",
    particleStyle: { color: "#ff8a3a", behavior: "sparks" },
    projectileStyle: "heavy-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_IRONCLAD_JUGGERNAUT" },
  },

  // ---------------------------------------------------------------------
  // INFERNO — Active Furnace / Fire Artillery. Every skin keeps the
  // furnace body + rear chimney + forward-facing mouth readable.
  // ---------------------------------------------------------------------
  {
    // REFORMULATED (was a charred-red palette swap). Now a genuinely
    // demonic furnace: horn-vents instead of a plain chimney cap, a
    // fanged demon-maw instead of the plain furnace opening, and a
    // black-smoke-trailed hellfire shot.
    id: "INFERNO_ASHEN_TYRANT",
    towerType: "INFERNO",
    i18nKey: "INFERNO_ASHEN_TYRANT",
    paletteOverride: { primary: "#2a1014", secondary: "#0e0508", accent: "#ff2e2e", glow: "rgba(255,46,46,0.65)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "corrupted",
    coreShape: "demon-maw",
    weaponDetail: "horns",
    particleStyle: { color: "#ff2e2e", behavior: "embers" },
    projectileStyle: "hellfire-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_ASHEN_TYRANT" },
  },
  {
    id: "INFERNO_VOLCANIC_COLOSSUS",
    towerType: "INFERNO",
    i18nKey: "INFERNO_VOLCANIC_COLOSSUS",
    paletteOverride: { primary: "#4a3428", secondary: "#1c1410", accent: "#ff8a3a", glow: "rgba(255,138,58,0.6)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "molten",
    coreShape: "lava-core",
    weaponDetail: "obsidian-plates",
    particleStyle: { color: "#ff8a3a", behavior: "embers" },
    projectileStyle: "magma-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_VOLCANIC_COLOSSUS" },
  },
  {
    id: "INFERNO_INDUSTRIAL_FORGE",
    towerType: "INFERNO",
    i18nKey: "INFERNO_INDUSTRIAL_FORGE",
    paletteOverride: { primary: "#565a5e", secondary: "#232628", accent: "#eaf2ff", glow: "rgba(234,242,255,0.55)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "industrial",
    coreShape: "pressure-core",
    weaponDetail: "gauges",
    particleStyle: { color: "#eaf2ff", behavior: "steam" },
    projectileStyle: "pressure-bolt",
    cosmeticAttribute: { i18nKey: "INFERNO_INDUSTRIAL_FORGE" },
  },
  {
    id: "INFERNO_SOLAR_ASCENDANT",
    towerType: "INFERNO",
    i18nKey: "INFERNO_SOLAR_ASCENDANT",
    paletteOverride: { primary: "#e8d090", secondary: "#a8843c", accent: "#fff6d0", glow: "rgba(255,246,208,0.7)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "celestial",
    coreShape: "solar-core",
    weaponDetail: "corona",
    particleStyle: { color: "#fff6d0", behavior: "solar-flares" },
    projectileStyle: "solar-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_SOLAR_ASCENDANT" },
  },
  {
    id: "INFERNO_PLAGUE_FURNACE",
    towerType: "INFERNO",
    i18nKey: "INFERNO_PLAGUE_FURNACE",
    paletteOverride: { primary: "#3a4a28", secondary: "#182210", accent: "#aaff4a", glow: "rgba(170,255,74,0.6)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "toxic",
    coreShape: "toxic-orb",
    weaponDetail: "vents",
    particleStyle: { color: "#aaff4a", behavior: "toxic-bubbles" },
    projectileStyle: "toxic-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_PLAGUE_FURNACE" },
  },

  // ---------------------------------------------------------------------
  // FROSTBORN — Ancient Crystal / Ice Conduit. Every skin keeps the stone
  // obelisk + frozen core + crystal-shard language readable.
  // ---------------------------------------------------------------------
  {
    // REFORMULATED — the original's mossy-green/pale-crystal palette was
    // already a good, unusual idea (an overgrown ruin, not just "blue
    // ice"); it just never got anything beyond a color swap. Now built out
    // into a real "living ruin" identity: jade crystal instead of cyan ice,
    // moss growth climbing the spire, drifting leaves instead of snow, and
    // a jade-colored bolt.
    id: "FROSTBORN_ANCIENT_GUARDIAN",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_ANCIENT_GUARDIAN",
    paletteOverride: { primary: "#4a5c3a", secondary: "#202c16", accent: "#c8f0a0", glow: "rgba(200,240,160,0.55)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "natural",
    coreShape: "jade-crystal",
    weaponDetail: "moss-growth",
    particleStyle: { color: "#c8f0a0", behavior: "drifting-leaves" },
    projectileStyle: "jade-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_ANCIENT_GUARDIAN" },
  },
  {
    id: "FROSTBORN_VOID_FROST",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_VOID_FROST",
    paletteOverride: { primary: "#241c30", secondary: "#0c0814", accent: "#7a4aff", glow: "rgba(122,74,255,0.6)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "voidtouched",
    coreShape: "void-shard",
    weaponDetail: "dark-icicles",
    particleStyle: { color: "#7a4aff", behavior: "void-wisps" },
    projectileStyle: "black-frost-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_VOID_FROST" },
  },
  {
    id: "FROSTBORN_ARCANE_CRYSTAL",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_ARCANE_CRYSTAL",
    paletteOverride: { primary: "#4a3c5a", secondary: "#201830", accent: "#ff9ae0", glow: "rgba(255,154,224,0.55)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "prismatic",
    coreShape: "prism-cluster",
    weaponDetail: "crystal-array",
    particleStyle: { color: "#ff9ae0", behavior: "prism-sparkles" },
    projectileStyle: "prism-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_ARCANE_CRYSTAL" },
  },
  {
    id: "FROSTBORN_CELESTIAL_ICE",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_CELESTIAL_ICE",
    paletteOverride: { primary: "#d8ecf8", secondary: "#a8c8d8", accent: "#eaf6ff", glow: "rgba(234,246,255,0.7)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "celestial",
    coreShape: "starlight-core",
    weaponDetail: "aurora-crown",
    particleStyle: { color: "#eaf6ff", behavior: "starlight" },
    projectileStyle: "starfrost-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_CELESTIAL_ICE" },
  },
  {
    id: "FROSTBORN_GLACIAL_WARLORD",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_GLACIAL_WARLORD",
    paletteOverride: { primary: "#1c3a4a", secondary: "#0c1c26", accent: "#4ecfff", glow: "rgba(78,207,255,0.6)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "glacial",
    coreShape: "glacial-core",
    weaponDetail: "ice-armor",
    particleStyle: { color: "#4ecfff", behavior: "frost-shards" },
    projectileStyle: "glacial-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_GLACIAL_WARLORD" },
  },

  // ---------------------------------------------------------------------
  // STORMCALLER — Arcane Lightning Conduit. Every skin keeps the rune
  // pillar + orb + idle-crackling-arcs language readable.
  // ---------------------------------------------------------------------
  {
    // REFORMULATED (was already void-purple, but only a palette swap).
    // Now a real Void Storm identity: the orb becomes a churning void-orb,
    // paired void-rods replace the plain lightning rods, and discharges
    // fire a jagged void-arc instead of the default white bolt.
    id: "STORMCALLER_VOID",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_VOID",
    paletteOverride: { primary: "#1a1622", secondary: "#08060c", accent: "#5a1fff", glow: "rgba(90,31,255,0.65)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "voidtouched",
    coreShape: "void-orb",
    weaponDetail: "void-rods",
    particleStyle: { color: "#5a1fff", behavior: "void-wisps" },
    projectileStyle: "void-arc",
    cosmeticAttribute: { i18nKey: "STORMCALLER_VOID" },
  },
  {
    id: "STORMCALLER_THUNDER",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_THUNDER",
    paletteOverride: { primary: "#1c3450", secondary: "#0c1826", accent: "#4ac8ff", glow: "rgba(74,200,255,0.7)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "tempest",
    coreShape: "thunder-orb",
    weaponDetail: "lightning-rods-heavy",
    particleStyle: { color: "#4ac8ff", behavior: "sparks" },
    projectileStyle: "thunder-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_THUNDER" },
  },
  {
    id: "STORMCALLER_CELESTIAL",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_CELESTIAL",
    paletteOverride: { primary: "#4a3c1a", secondary: "#241c0a", accent: "#ffe9a0", glow: "rgba(255,233,160,0.7)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "celestial",
    coreShape: "divine-orb",
    weaponDetail: "halo-rods",
    particleStyle: { color: "#ffe9a0", behavior: "light-motes" },
    projectileStyle: "divine-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_CELESTIAL" },
  },
  {
    id: "STORMCALLER_ARCANE",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_ARCANE",
    paletteOverride: { primary: "#3a2c50", secondary: "#180f26", accent: "#d89aff", glow: "rgba(216,154,255,0.6)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "prismatic",
    coreShape: "rune-array",
    weaponDetail: "rune-rods",
    particleStyle: { color: "#d89aff", behavior: "prism-sparkles" },
    projectileStyle: "arcane-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_ARCANE" },
  },
  {
    id: "STORMCALLER_TEMPEST",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_TEMPEST",
    paletteOverride: { primary: "#1c4a3c", secondary: "#0c221c", accent: "#6affd0", glow: "rgba(106,255,208,0.6)" },
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "tempest",
    coreShape: "cyclone-orb",
    weaponDetail: "wind-rods",
    particleStyle: { color: "#6affd0", behavior: "wind-swirl" },
    projectileStyle: "cyclone-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_TEMPEST" },
  },
];

/**
 * FASE 6 — Prestige P50 reward (config/prestige.ts's PRESTIGE_MILESTONE_REWARDS,
 * "prestigeTowerSkin"). Deliberately NOT in TOWER_SKINS: it is never sold
 * (gemCost 0, unlockLevel unreachable so canPurchaseSkin/the commercial shop
 * flow can never surface or sell it) and is instead granted directly into
 * ownedTowerSkinIds by GameEngine.grantEarnedPrestigeMilestoneRewards the
 * moment prestigeLevel reaches 50 — reusing the exact ownership architecture
 * every other skin uses, just skipping the Gems-purchase step entirely. One
 * per tower type, all granted together (Prestige is account-wide, not
 * per-tower), so a P50 player can equip it on whichever tower they like.
 */
export const PRESTIGE_TOWER_SKINS: readonly TowerSkinDefinition[] = [
  {
    id: "IRONWOOD_PRESTIGE_ASCENDANT",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_PRESTIGE_ASCENDANT",
    paletteOverride: { primary: "#2a2410", secondary: "#100d04", accent: "#ffd257", glow: "rgba(255,210,87,0.6)" },
    unlockLevel: Number.POSITIVE_INFINITY,
    tier: "PRESTIGE",
    gemCost: 0,
    material: "radiant",
    coreShape: "halo",
    weaponDetail: "halo-ring",
    particleStyle: { color: "#ffd257", behavior: "light-motes" },
    projectileStyle: "radiant-arrow",
    cosmeticAttribute: { i18nKey: "IRONWOOD_PRESTIGE_ASCENDANT" },
  },
  {
    id: "INFERNO_PRESTIGE_ASCENDANT",
    towerType: "INFERNO",
    i18nKey: "INFERNO_PRESTIGE_ASCENDANT",
    paletteOverride: { primary: "#2a2410", secondary: "#100d04", accent: "#ffd257", glow: "rgba(255,210,87,0.6)" },
    unlockLevel: Number.POSITIVE_INFINITY,
    tier: "PRESTIGE",
    gemCost: 0,
    material: "celestial",
    coreShape: "solar-core",
    weaponDetail: "corona",
    particleStyle: { color: "#ffd257", behavior: "solar-flares" },
    projectileStyle: "solar-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_PRESTIGE_ASCENDANT" },
  },
  {
    id: "FROSTBORN_PRESTIGE_ASCENDANT",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_PRESTIGE_ASCENDANT",
    paletteOverride: { primary: "#2a2410", secondary: "#100d04", accent: "#ffd257", glow: "rgba(255,210,87,0.6)" },
    unlockLevel: Number.POSITIVE_INFINITY,
    tier: "PRESTIGE",
    gemCost: 0,
    material: "celestial",
    coreShape: "starlight-core",
    weaponDetail: "aurora-crown",
    particleStyle: { color: "#ffd257", behavior: "starlight" },
    projectileStyle: "starfrost-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_PRESTIGE_ASCENDANT" },
  },
  {
    id: "STORMCALLER_PRESTIGE_ASCENDANT",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_PRESTIGE_ASCENDANT",
    paletteOverride: { primary: "#2a2410", secondary: "#100d04", accent: "#ffd257", glow: "rgba(255,210,87,0.6)" },
    unlockLevel: Number.POSITIVE_INFINITY,
    tier: "PRESTIGE",
    gemCost: 0,
    material: "celestial",
    coreShape: "divine-orb",
    weaponDetail: "halo-rods",
    particleStyle: { color: "#ffd257", behavior: "light-motes" },
    projectileStyle: "divine-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_PRESTIGE_ASCENDANT" },
  },
];

const SKINS_BY_ID = new Map([...TOWER_SKINS, ...PRESTIGE_TOWER_SKINS].map((s) => [s.id, s]));

export function getTowerSkinDefinition(id: string): TowerSkinDefinition | null {
  return SKINS_BY_ID.get(id) ?? null;
}

export function getSkinsForTower(type: TowerType): readonly TowerSkinDefinition[] {
  return TOWER_SKINS.filter((s) => s.towerType === type);
}

/** Prestige-exclusive skins for this tower type — never purchasable, only ever granted (see PRESTIGE_TOWER_SKINS's own doc comment). */
export function getPrestigeSkinsForTower(type: TowerType): readonly TowerSkinDefinition[] {
  return PRESTIGE_TOWER_SKINS.filter((s) => s.towerType === type);
}
