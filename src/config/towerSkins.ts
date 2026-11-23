import type { TowerType } from "./towerStats";
import { dualGemPrice, type DualGemPrice } from "./gemsEconomy";

/**
 * TOWER SKIN SYSTEM v3 — "REVISÃO PROFISSIONAL: TORRES + SKINS + GAMEPLAY
 * ATTRIBUTES + SHOP/PREVIEW". v2 gave every skin real VISUAL authority over
 * five independent axes (below) but kept skins purely cosmetic — this pass
 * is the deliberate, explicit reversal of that one constraint: a commercial
 * skin now also carries a small, bounded `gameplayEffect` (see that type's
 * own doc comment) that Tower.getTowerStats and towerStats.getTowerSpecialAtLevel
 * apply ONLY while the skin is actually equipped (`tower.equippedSkinId`) —
 * never during a shop/panel PREVIEW, which only ever renders a throwaway
 * copy of the tower object and never touches `equippedSkinId` for real (see
 * ui/TowerInfoPanel.tsx's SkinPreviewCanvas). Every other v2 guarantee is
 * untouched: a skin never appears in TowerLevelStats/TowerSpecial's own
 * BASE numbers (only as an explicit, separate modifier applied on top), and
 * never changes the tower's footprint.
 *
 * The five VISUAL axes read by rendering/EntityRenderer.ts's draw{Type}
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
  | "wind-swirl"
  // bundle-exclusive (PACK_TOWER_SKINS): no other skin uses these
  | "heart-embers"
  | "crown-snow"
  | "emerald-glints"
  | "blood-sparks"
  | "eclipse-motes"
  | "black-snow"
  | "royal-rays"
  | "royal-sparks"
  // ranking-prize exclusive (RANKED_TOWER_SKINS)
  | "hourglass-sand"
  | "nebula-drift"
  | "clock-glyphs"
  | "star-fall"
  | "arena-sparks"
  | "war-embers"
  | "shield-glints"
  | "gong-pulse"
  | "banner-motes"
  | "blue-flame"
  | "silver-mist"
  | "comet-trail";

export interface SkinParticleStyle {
  color: string;
  behavior: SkinParticleBehavior;
}

/**
 * SIDEGRADE, NEVER A STRICT UPGRADE — every field here is small (bounded to
 * ±8%, see towerSkins.test.ts's own numeric-bounds assertions) and every
 * commercial skin below pairs exactly one upside field with exactly one
 * downside field, so no skin is ever strictly better than the default look
 * in every situation — it specializes the tower's existing archetype
 * instead of generically inflating it (spec: "SIDEGRADES / SPECIALIZATIONS,
 * não power creep"). All fields are optional and multiplicative/additive
 * over the tower's already-computed base+Mastery numbers:
 *   - `*Mult` fields multiply the stat (1.06 = +6%, 0.96 = -4%).
 *   - `*Add` fields add directly to the stat's own unit (a fraction like
 *     0.05 = +5 percentage points for a chance/percent stat, or ms for a
 *     duration) — NEGATIVE is a real, valid downside for several of these
 *     (e.g. a lower `chainFalloffAdd` is a BUFF — see Stormcaller Tempest —
 *     while a lower `slowPercentAdd` is a nerf, so "sign = good" does not
 *     hold uniformly; towerSkins.test.ts documents each skin's own
 *     buff/nerf pair explicitly rather than inferring it from sign alone).
 * Only the fields relevant to a tower's own archetype are ever set on that
 * tower's skins (e.g. `burnDamageMult` only appears on INFERNO skins).
 * Applied by entities/Tower.ts's getTowerStats (damage/attackSpeed/range)
 * and config/towerStats.ts's getTowerSpecialAtLevel (everything else) —
 * BOTH accept the effect as an explicit optional parameter, sourced ONLY
 * from `tower.equippedSkinId`'s own definition, so a skin merely being
 * PREVIEWED (which never touches `equippedSkinId`) can never apply it.
 */
export interface SkinGameplayEffect {
  damageMult?: number;
  attackSpeedMult?: number;
  rangeMult?: number;
  /** IRONWOOD only. */
  critChanceAdd?: number;
  /** IRONWOOD only. */
  bossDamageMultAdd?: number;
  /** INFERNO only. */
  aoeRadiusMult?: number;
  /** INFERNO only. */
  burnDamageMult?: number;
  /** INFERNO only, milliseconds. */
  burnDurationMsAdd?: number;
  /** FROSTBORN only. */
  slowPercentAdd?: number;
  /** FROSTBORN only. */
  freezeChanceAdd?: number;
  /** STORMCALLER only. */
  armorPenetrationAdd?: number;
  /** STORMCALLER only — LOWER is the buff (chain hits retain more damage per jump). */
  chainFalloffAdd?: number;
}

/** Every field absent — the explicit, reusable "this skin/tier changes nothing about gameplay" value. Used by every PRESTIGE skin (a free P50 reward must never also be a free permanent combat-stat upgrade — see PRESTIGE_TOWER_SKINS's own doc comment) and by anything else that is cosmetic-only. */
export const NO_GAMEPLAY_EFFECT: SkinGameplayEffect = {};

/**
 * HORDENOVA Season/Progression v1.0 — commercial tier, one of three fixed
 * price points (see TOWER_SKIN_TIER_PRICES). Purely a pricing classification
 * — never read by combat code, never affects catalog/ownership/equip logic.
 */
export type TowerSkinTier = "ENTRY" | "INTERMEDIATE" | "PREMIUM" | "PRESTIGE" | "DUEL" | "PACK" | "RANKED";

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
  /** Bought with Duel Coins only (config/duel.ts DUEL_SHOP), never with Gems. */
  DUEL: 0,
  /** Only inside a Store bundle bought with real money (config/store.ts SKIN_BUNDLES), never with Gems. */
  PACK: 0,
  /** Only as a ranking prize (config/rankedRewards.ts): never sold, never in a bundle. */
  RANKED: 0,
};

/**
 * GEMS ECONOMY v2 — every commercial skin gets a dual price: `gemCost`
 * above stays the exact, unchanged 💎 PURCHASED price (Purchased-Gems
 * players see zero change), and 🔒 FREE = PURCHASED x 1.5 (config/
 * gemsEconomy.ts's own methodology). For PREMIUM (800), that's exactly the
 * user's own worked example: 1,200 Free / 800 Purchased — preserved
 * verbatim, not silently changed.
 */
export function getTowerSkinDualPrice(def: Pick<TowerSkinDefinition, "gemCost">): DualGemPrice {
  return dualGemPrice(def.gemCost);
}

/**
 * REWARD BONUS — what a paid skin gives on top of its look and its combat
 * trade-off: more Gold and more Gem Shards, which only speed up
 * progression. (A paid skin also charges its tower's mana a little faster —
 * SKIN_MANA_GAIN_BONUS in config/towerMana.ts.) Counted once per tower TYPE that has a paid
 * (non-Prestige) skin equipped and at least one tower of that type on the
 * map — so the most it can reach is 4 types x 5% = +20%.
 */
export const SKIN_REWARD_BONUS_PER_TYPE = 0.05;

/**
 * EVOLUÇÃO DE SKIN — the animated version of a Premium skin you own: a
 * turning rune ring, a breathing glow and rising sparks in the skin's own
 * colours (rendering/skinEvolution.ts). Purely visual, permanent.
 */
export const SKIN_EVOLUTION_PRICE: DualGemPrice = dualGemPrice(400);

/** Only the commercial tiers are sold for Gems; Prestige, Duel and bundle skins (price 0 here) never are. */
export function isGemPurchasableSkin(def: Pick<TowerSkinDefinition, "tier">): boolean {
  return def.tier === "ENTRY" || def.tier === "INTERMEDIATE" || def.tier === "PREMIUM";
}

export function canEvolveSkin(def: Pick<TowerSkinDefinition, "tier">): boolean {
  return def.tier === "PREMIUM";
}

export function isPaidTowerSkin(skinId: string | null | undefined): boolean {
  if (!skinId) return false;
  const def = getTowerSkinDefinition(skinId);
  return !!def && def.tier !== "PRESTIGE";
}

/** 1 + 5% for each tower type in play wearing a paid skin. */
export function getSkinRewardMultiplier(equippedByType: Partial<Record<TowerType, string>>, typesInPlay: Iterable<TowerType>): number {
  let types = 0;
  for (const type of new Set(typesInPlay)) if (isPaidTowerSkin(equippedByType[type])) types++;
  return 1 + types * SKIN_REWARD_BONUS_PER_TYPE;
}

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
   * Shown in the shop as "Cosmetic Attribute — <name>". Purely the
   * shop-facing NAME for this skin's own `projectileStyle` (its attack
   * visual signature) — never itself a gameplay input. The REAL gameplay
   * numbers live in `gameplayEffect` below and are always shown to the
   * player as their own explicit "GAMEPLAY EFFECTS" block (spec: "nunca
   * esconder o efeito") — this field and that one are deliberately never
   * conflated, see towerSkins.test.ts.
   */
  cosmeticAttribute: { i18nKey: string };
  /** See SkinGameplayEffect's own doc comment. `NO_GAMEPLAY_EFFECT` for every PRESTIGE skin. */
  gameplayEffect: SkinGameplayEffect;
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
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "corrupted",
    coreShape: "void-eye",
    weaponDetail: "tendrils",
    particleStyle: { color: "#8a3fff", behavior: "void-wisps" },
    projectileStyle: "void-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_WARDEN_OF_THE_ABYSS" },
    gameplayEffect: { critChanceAdd: 0.05, attackSpeedMult: 0.96 },
  },
  {
    id: "IRONWOOD_CELESTIAL_WARDEN",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_CELESTIAL_WARDEN",
    paletteOverride: { primary: "#e8dcc0", secondary: "#a89468", accent: "#fff2c9", glow: "rgba(255,230,150,0.7)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "radiant",
    coreShape: "halo",
    weaponDetail: "halo-ring",
    particleStyle: { color: "#fff2c9", behavior: "light-motes" },
    projectileStyle: "radiant-arrow",
    cosmeticAttribute: { i18nKey: "IRONWOOD_CELESTIAL_WARDEN" },
    gameplayEffect: { rangeMult: 1.06, damageMult: 0.96 },
  },
  {
    id: "IRONWOOD_ARCANE_ENGINE",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_ARCANE_ENGINE",
    paletteOverride: { primary: "#4a5560", secondary: "#1c2228", accent: "#6adfff", glow: "rgba(106,223,255,0.6)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "mechanical",
    coreShape: "gear-core",
    weaponDetail: "gear-array",
    particleStyle: { color: "#6adfff", behavior: "circuit-pulses" },
    projectileStyle: "energy-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_ARCANE_ENGINE" },
    gameplayEffect: { attackSpeedMult: 1.06, damageMult: 0.96 },
  },
  {
    id: "IRONWOOD_ANCIENT_HUNTER",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_ANCIENT_HUNTER",
    paletteOverride: { primary: "#6a5a3a", secondary: "#2a2216", accent: "#8fffb0", glow: "rgba(143,255,176,0.55)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "bone",
    coreShape: "spirit-skull",
    weaponDetail: "trophies",
    particleStyle: { color: "#8fffb0", behavior: "spirit-wisps" },
    projectileStyle: "spirit-arrow",
    cosmeticAttribute: { i18nKey: "IRONWOOD_ANCIENT_HUNTER" },
    gameplayEffect: { bossDamageMultAdd: 0.06, attackSpeedMult: 0.97 },
  },
  {
    id: "IRONWOOD_IRONCLAD_JUGGERNAUT",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_IRONCLAD_JUGGERNAUT",
    paletteOverride: { primary: "#2c2f33", secondary: "#121315", accent: "#ff8a3a", glow: "rgba(255,138,58,0.55)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "armored",
    coreShape: "forge-core",
    weaponDetail: "plates",
    particleStyle: { color: "#ff8a3a", behavior: "sparks" },
    projectileStyle: "heavy-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_IRONCLAD_JUGGERNAUT" },
    gameplayEffect: { damageMult: 1.07, attackSpeedMult: 0.95 },
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
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "corrupted",
    coreShape: "demon-maw",
    weaponDetail: "horns",
    particleStyle: { color: "#ff2e2e", behavior: "embers" },
    projectileStyle: "hellfire-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_ASHEN_TYRANT" },
    gameplayEffect: { burnDamageMult: 1.06, aoeRadiusMult: 0.96 },
  },
  {
    id: "INFERNO_VOLCANIC_COLOSSUS",
    towerType: "INFERNO",
    i18nKey: "INFERNO_VOLCANIC_COLOSSUS",
    paletteOverride: { primary: "#4a3428", secondary: "#1c1410", accent: "#ff8a3a", glow: "rgba(255,138,58,0.6)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "molten",
    coreShape: "lava-core",
    weaponDetail: "obsidian-plates",
    particleStyle: { color: "#ff8a3a", behavior: "embers" },
    projectileStyle: "magma-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_VOLCANIC_COLOSSUS" },
    gameplayEffect: { aoeRadiusMult: 1.06, damageMult: 0.96 },
  },
  {
    id: "INFERNO_INDUSTRIAL_FORGE",
    towerType: "INFERNO",
    i18nKey: "INFERNO_INDUSTRIAL_FORGE",
    paletteOverride: { primary: "#565a5e", secondary: "#232628", accent: "#eaf2ff", glow: "rgba(234,242,255,0.55)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "industrial",
    coreShape: "pressure-core",
    weaponDetail: "gauges",
    particleStyle: { color: "#eaf2ff", behavior: "steam" },
    projectileStyle: "pressure-bolt",
    cosmeticAttribute: { i18nKey: "INFERNO_INDUSTRIAL_FORGE" },
    gameplayEffect: { attackSpeedMult: 1.06, burnDamageMult: 0.96 },
  },
  {
    id: "INFERNO_SOLAR_ASCENDANT",
    towerType: "INFERNO",
    i18nKey: "INFERNO_SOLAR_ASCENDANT",
    paletteOverride: { primary: "#e8d090", secondary: "#a8843c", accent: "#fff6d0", glow: "rgba(255,246,208,0.7)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "celestial",
    coreShape: "solar-core",
    weaponDetail: "corona",
    particleStyle: { color: "#fff6d0", behavior: "solar-flares" },
    projectileStyle: "solar-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_SOLAR_ASCENDANT" },
    gameplayEffect: { damageMult: 1.06, attackSpeedMult: 0.96 },
  },
  {
    id: "INFERNO_PLAGUE_FURNACE",
    towerType: "INFERNO",
    i18nKey: "INFERNO_PLAGUE_FURNACE",
    paletteOverride: { primary: "#3a4a28", secondary: "#182210", accent: "#aaff4a", glow: "rgba(170,255,74,0.6)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "toxic",
    coreShape: "toxic-orb",
    weaponDetail: "vents",
    particleStyle: { color: "#aaff4a", behavior: "toxic-bubbles" },
    projectileStyle: "toxic-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_PLAGUE_FURNACE" },
    gameplayEffect: { burnDurationMsAdd: 240, damageMult: 0.97 },
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
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "natural",
    coreShape: "jade-crystal",
    weaponDetail: "moss-growth",
    particleStyle: { color: "#c8f0a0", behavior: "drifting-leaves" },
    projectileStyle: "jade-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_ANCIENT_GUARDIAN" },
    gameplayEffect: { rangeMult: 1.05, damageMult: 0.96 },
  },
  {
    id: "FROSTBORN_VOID_FROST",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_VOID_FROST",
    paletteOverride: { primary: "#241c30", secondary: "#0c0814", accent: "#7a4aff", glow: "rgba(122,74,255,0.6)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "voidtouched",
    coreShape: "void-shard",
    weaponDetail: "dark-icicles",
    particleStyle: { color: "#7a4aff", behavior: "void-wisps" },
    projectileStyle: "black-frost-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_VOID_FROST" },
    gameplayEffect: { freezeChanceAdd: 0.05, attackSpeedMult: 0.96 },
  },
  {
    id: "FROSTBORN_ARCANE_CRYSTAL",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_ARCANE_CRYSTAL",
    paletteOverride: { primary: "#4a3c5a", secondary: "#201830", accent: "#ff9ae0", glow: "rgba(255,154,224,0.55)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "prismatic",
    coreShape: "prism-cluster",
    weaponDetail: "crystal-array",
    particleStyle: { color: "#ff9ae0", behavior: "prism-sparkles" },
    projectileStyle: "prism-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_ARCANE_CRYSTAL" },
    gameplayEffect: { damageMult: 1.06, rangeMult: 0.96 },
  },
  {
    id: "FROSTBORN_CELESTIAL_ICE",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_CELESTIAL_ICE",
    paletteOverride: { primary: "#d8ecf8", secondary: "#a8c8d8", accent: "#eaf6ff", glow: "rgba(234,246,255,0.7)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "celestial",
    coreShape: "starlight-core",
    weaponDetail: "aurora-crown",
    particleStyle: { color: "#eaf6ff", behavior: "starlight" },
    projectileStyle: "starfrost-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_CELESTIAL_ICE" },
    gameplayEffect: { slowPercentAdd: 0.06, damageMult: 0.96 },
  },
  {
    id: "FROSTBORN_GLACIAL_WARLORD",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_GLACIAL_WARLORD",
    paletteOverride: { primary: "#1c3a4a", secondary: "#0c1c26", accent: "#4ecfff", glow: "rgba(78,207,255,0.6)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "glacial",
    coreShape: "glacial-core",
    weaponDetail: "ice-armor",
    particleStyle: { color: "#4ecfff", behavior: "frost-shards" },
    projectileStyle: "glacial-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_GLACIAL_WARLORD" },
    gameplayEffect: { attackSpeedMult: 1.06, slowPercentAdd: -0.04 },
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
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "voidtouched",
    coreShape: "void-orb",
    weaponDetail: "void-rods",
    particleStyle: { color: "#5a1fff", behavior: "void-wisps" },
    projectileStyle: "void-arc",
    cosmeticAttribute: { i18nKey: "STORMCALLER_VOID" },
    gameplayEffect: { armorPenetrationAdd: 0.06, attackSpeedMult: 0.96 },
  },
  {
    id: "STORMCALLER_THUNDER",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_THUNDER",
    paletteOverride: { primary: "#1c3450", secondary: "#0c1826", accent: "#4ac8ff", glow: "rgba(74,200,255,0.7)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "tempest",
    coreShape: "thunder-orb",
    weaponDetail: "lightning-rods-heavy",
    particleStyle: { color: "#4ac8ff", behavior: "sparks" },
    projectileStyle: "thunder-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_THUNDER" },
    gameplayEffect: { damageMult: 1.07, rangeMult: 0.96 },
  },
  {
    id: "STORMCALLER_CELESTIAL",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_CELESTIAL",
    paletteOverride: { primary: "#4a3c1a", secondary: "#241c0a", accent: "#ffe9a0", glow: "rgba(255,233,160,0.7)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "celestial",
    coreShape: "divine-orb",
    weaponDetail: "halo-rods",
    particleStyle: { color: "#ffe9a0", behavior: "light-motes" },
    projectileStyle: "divine-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_CELESTIAL" },
    gameplayEffect: { rangeMult: 1.06, damageMult: 0.96 },
  },
  {
    id: "STORMCALLER_ARCANE",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_ARCANE",
    paletteOverride: { primary: "#3a2c50", secondary: "#180f26", accent: "#d89aff", glow: "rgba(216,154,255,0.6)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "prismatic",
    coreShape: "rune-array",
    weaponDetail: "rune-rods",
    particleStyle: { color: "#d89aff", behavior: "prism-sparkles" },
    projectileStyle: "arcane-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_ARCANE" },
    gameplayEffect: { attackSpeedMult: 1.06, damageMult: 0.96 },
  },
  {
    id: "STORMCALLER_TEMPEST",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_TEMPEST",
    paletteOverride: { primary: "#1c4a3c", secondary: "#0c221c", accent: "#6affd0", glow: "rgba(106,255,208,0.6)" },
    unlockLevel: 1,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
    material: "tempest",
    coreShape: "cyclone-orb",
    weaponDetail: "wind-rods",
    particleStyle: { color: "#6affd0", behavior: "wind-swirl" },
    projectileStyle: "cyclone-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_TEMPEST" },
    gameplayEffect: { chainFalloffAdd: -0.05, attackSpeedMult: 0.96 },
  },
  // ---------------------------------------------------------------------
  // ENTRY and INTERMEDIATE skins — cheaper looks for every tower: Entry
  // skins change only the colours and materials; Intermediate ones add a
  // small trade-off, half the size of a Premium skin's.
  // ---------------------------------------------------------------------
  {
    id: "IRONWOOD_AUTUMN",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_AUTUMN",
    paletteOverride: { primary: "#8a5a32", secondary: "#2e1a0c", accent: "#ffb04a", glow: "rgba(255,176,74,0.5)" },
    unlockLevel: 1,
    tier: "ENTRY",
    gemCost: TOWER_SKIN_TIER_PRICES.ENTRY,
    material: "natural",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#d8782a", behavior: "drifting-leaves" },
    projectileStyle: "radiant-arrow",
    cosmeticAttribute: { i18nKey: "IRONWOOD_AUTUMN" },
    gameplayEffect: {},
  },
  {
    id: "IRONWOOD_BIRCH",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_BIRCH",
    paletteOverride: { primary: "#e4ddcc", secondary: "#8a8274", accent: "#bfe88a", glow: "rgba(191,232,138,0.5)" },
    unlockLevel: 1,
    tier: "ENTRY",
    gemCost: TOWER_SKIN_TIER_PRICES.ENTRY,
    material: "natural",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#bfe88a", behavior: "drifting-leaves" },
    projectileStyle: "jade-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_BIRCH" },
    gameplayEffect: {},
  },
  {
    id: "IRONWOOD_BLOODWOOD",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_BLOODWOOD",
    paletteOverride: { primary: "#5a1a1a", secondary: "#1a0606", accent: "#ff3a3a", glow: "rgba(255,58,58,0.5)" },
    unlockLevel: 1,
    tier: "INTERMEDIATE",
    gemCost: TOWER_SKIN_TIER_PRICES.INTERMEDIATE,
    material: "corrupted",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff3a3a", behavior: "embers" },
    projectileStyle: "void-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_BLOODWOOD" },
    gameplayEffect: { critChanceAdd: 0.03, attackSpeedMult: 0.98 },
  },
  {
    id: "IRONWOOD_FROSTPINE",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_FROSTPINE",
    paletteOverride: { primary: "#4a5a66", secondary: "#1a2228", accent: "#8ae8ff", glow: "rgba(138,232,255,0.5)" },
    unlockLevel: 1,
    tier: "INTERMEDIATE",
    gemCost: TOWER_SKIN_TIER_PRICES.INTERMEDIATE,
    material: "glacial",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#8ae8ff", behavior: "frost-shards" },
    projectileStyle: "glacial-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_FROSTPINE" },
    gameplayEffect: { rangeMult: 1.03, damageMult: 0.98 },
  },
  {
    id: "INFERNO_COPPER",
    towerType: "INFERNO",
    i18nKey: "INFERNO_COPPER",
    paletteOverride: { primary: "#7a4a2a", secondary: "#3a2214", accent: "#ff9a3a", glow: "rgba(255,154,58,0.5)" },
    unlockLevel: 1,
    tier: "ENTRY",
    gemCost: TOWER_SKIN_TIER_PRICES.ENTRY,
    material: "industrial",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff9a3a", behavior: "embers" },
    projectileStyle: "magma-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_COPPER" },
    gameplayEffect: {},
  },
  {
    id: "INFERNO_SOOT",
    towerType: "INFERNO",
    i18nKey: "INFERNO_SOOT",
    paletteOverride: { primary: "#26262a", secondary: "#121214", accent: "#ff6a1a", glow: "rgba(255,106,26,0.5)" },
    unlockLevel: 1,
    tier: "ENTRY",
    gemCost: TOWER_SKIN_TIER_PRICES.ENTRY,
    material: "industrial",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff6a1a", behavior: "steam" },
    projectileStyle: "hellfire-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_SOOT" },
    gameplayEffect: {},
  },
  {
    id: "INFERNO_BLUE_FLAME",
    towerType: "INFERNO",
    i18nKey: "INFERNO_BLUE_FLAME",
    paletteOverride: { primary: "#2a3442", secondary: "#141a22", accent: "#3aa8ff", glow: "rgba(58,168,255,0.5)" },
    unlockLevel: 1,
    tier: "INTERMEDIATE",
    gemCost: TOWER_SKIN_TIER_PRICES.INTERMEDIATE,
    material: "molten",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#3aa8ff", behavior: "embers" },
    projectileStyle: "solar-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_BLUE_FLAME" },
    gameplayEffect: { burnDamageMult: 1.04, aoeRadiusMult: 0.97 },
  },
  {
    id: "INFERNO_EMERALD",
    towerType: "INFERNO",
    i18nKey: "INFERNO_EMERALD",
    paletteOverride: { primary: "#24342a", secondary: "#121a14", accent: "#4aff7a", glow: "rgba(74,255,122,0.5)" },
    unlockLevel: 1,
    tier: "INTERMEDIATE",
    gemCost: TOWER_SKIN_TIER_PRICES.INTERMEDIATE,
    material: "toxic",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#4aff7a", behavior: "toxic-bubbles" },
    projectileStyle: "toxic-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_EMERALD" },
    gameplayEffect: { burnDurationMsAdd: 300, damageMult: 0.98 },
  },
  {
    id: "FROSTBORN_SANDSTONE",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_SANDSTONE",
    paletteOverride: { primary: "#a8865a", secondary: "#5a4428", accent: "#7ee6ff", glow: "rgba(126,230,255,0.5)" },
    unlockLevel: 1,
    tier: "ENTRY",
    gemCost: TOWER_SKIN_TIER_PRICES.ENTRY,
    material: "natural",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#7ee6ff", behavior: "frost-shards" },
    projectileStyle: "glacial-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_SANDSTONE" },
    gameplayEffect: {},
  },
  {
    id: "FROSTBORN_MOONSTONE",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_MOONSTONE",
    paletteOverride: { primary: "#8a90a8", secondary: "#464a5e", accent: "#d8e0ff", glow: "rgba(216,224,255,0.5)" },
    unlockLevel: 1,
    tier: "ENTRY",
    gemCost: TOWER_SKIN_TIER_PRICES.ENTRY,
    material: "celestial",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#d8e0ff", behavior: "starlight" },
    projectileStyle: "starfrost-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_MOONSTONE" },
    gameplayEffect: {},
  },
  {
    id: "FROSTBORN_AURORA",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_AURORA",
    paletteOverride: { primary: "#2a3a4a", secondary: "#121c26", accent: "#6affc8", glow: "rgba(106,255,200,0.5)" },
    unlockLevel: 1,
    tier: "INTERMEDIATE",
    gemCost: TOWER_SKIN_TIER_PRICES.INTERMEDIATE,
    material: "prismatic",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#6affc8", behavior: "prism-sparkles" },
    projectileStyle: "prism-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_AURORA" },
    gameplayEffect: { slowPercentAdd: 0.02, damageMult: 0.98 },
  },
  {
    id: "FROSTBORN_OBSIDIAN",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_OBSIDIAN",
    paletteOverride: { primary: "#1e1e24", secondary: "#0c0c10", accent: "#ff5a6a", glow: "rgba(255,90,106,0.5)" },
    unlockLevel: 1,
    tier: "INTERMEDIATE",
    gemCost: TOWER_SKIN_TIER_PRICES.INTERMEDIATE,
    material: "voidtouched",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff5a6a", behavior: "void-wisps" },
    projectileStyle: "black-frost-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_OBSIDIAN" },
    gameplayEffect: { freezeChanceAdd: 0.02, attackSpeedMult: 0.98 },
  },
  {
    id: "STORMCALLER_COPPER",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_COPPER",
    paletteOverride: { primary: "#7a5a44", secondary: "#3e2c20", accent: "#ffb04a", glow: "rgba(255,176,74,0.5)" },
    unlockLevel: 1,
    tier: "ENTRY",
    gemCost: TOWER_SKIN_TIER_PRICES.ENTRY,
    material: "mechanical",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ffb04a", behavior: "sparks" },
    projectileStyle: "thunder-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_COPPER" },
    gameplayEffect: {},
  },
  {
    id: "STORMCALLER_SLATE",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_SLATE",
    paletteOverride: { primary: "#4e5458", secondary: "#26292c", accent: "#8ab8ff", glow: "rgba(138,184,255,0.5)" },
    unlockLevel: 1,
    tier: "ENTRY",
    gemCost: TOWER_SKIN_TIER_PRICES.ENTRY,
    material: "tempest",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#8ab8ff", behavior: "wind-swirl" },
    projectileStyle: "cyclone-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_SLATE" },
    gameplayEffect: {},
  },
  {
    id: "STORMCALLER_RUBY",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_RUBY",
    paletteOverride: { primary: "#4a2a30", secondary: "#221216", accent: "#ff3a5a", glow: "rgba(255,58,90,0.5)" },
    unlockLevel: 1,
    tier: "INTERMEDIATE",
    gemCost: TOWER_SKIN_TIER_PRICES.INTERMEDIATE,
    material: "radiant",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff3a5a", behavior: "sparks" },
    projectileStyle: "arcane-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_RUBY" },
    gameplayEffect: { chainFalloffAdd: -0.03, rangeMult: 0.98 },
  },
  {
    id: "STORMCALLER_SUNSTORM",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_SUNSTORM",
    paletteOverride: { primary: "#c8b48a", secondary: "#7a6a48", accent: "#ffd84a", glow: "rgba(255,216,74,0.5)" },
    unlockLevel: 1,
    tier: "INTERMEDIATE",
    gemCost: TOWER_SKIN_TIER_PRICES.INTERMEDIATE,
    material: "radiant",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ffd84a", behavior: "solar-flares" },
    projectileStyle: "divine-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_SUNSTORM" },
    gameplayEffect: { critChanceAdd: 0.03, damageMult: 0.98 },
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
    gameplayEffect: NO_GAMEPLAY_EFFECT,
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
    gameplayEffect: NO_GAMEPLAY_EFFECT,
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
    gameplayEffect: NO_GAMEPLAY_EFFECT,
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
    gameplayEffect: NO_GAMEPLAY_EFFECT,
  },
];


/**
 * DUELO — tower skins bought with Duel Coins in the Duel Shop. They show in
 * the Duel and in the Eternal castle only; the Season castle keeps its own
 * skins (the Gem ones), so the Season isn't touched by the Duel. Purely
 * visual: a Duel skin replaces only the look, never any effect or bonus.
 */
export const DUEL_TOWER_SKINS: readonly TowerSkinDefinition[] = [
  {
    id: "IRONWOOD_GLADIATOR",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_GLADIATOR",
    paletteOverride: { primary: "#6a3a1e", secondary: "#22100a", accent: "#ff4a2a", glow: "rgba(255,74,42,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "molten",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff4a2a", behavior: "embers" },
    projectileStyle: "magma-orb",
    cosmeticAttribute: { i18nKey: "IRONWOOD_GLADIATOR" },
    gameplayEffect: {},
  },
  {
    id: "IRONWOOD_CHAMPION",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_CHAMPION",
    paletteOverride: { primary: "#e8e0cc", secondary: "#1e1c1e", accent: "#ffd84a", glow: "rgba(255,216,74,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "radiant",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ffd84a", behavior: "solar-flares" },
    projectileStyle: "divine-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_CHAMPION" },
    gameplayEffect: {},
  },
  {
    id: "INFERNO_GLADIATOR",
    towerType: "INFERNO",
    i18nKey: "INFERNO_GLADIATOR",
    paletteOverride: { primary: "#7a2a1e", secondary: "#1e120a", accent: "#ff4a1a", glow: "rgba(255,74,26,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "molten",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff4a1a", behavior: "embers" },
    projectileStyle: "magma-orb",
    cosmeticAttribute: { i18nKey: "INFERNO_GLADIATOR" },
    gameplayEffect: {},
  },
  {
    id: "INFERNO_CHAMPION",
    towerType: "INFERNO",
    i18nKey: "INFERNO_CHAMPION",
    paletteOverride: { primary: "#e8e0cc", secondary: "#1e1c22", accent: "#ffd84a", glow: "rgba(255,216,74,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "radiant",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ffd84a", behavior: "solar-flares" },
    projectileStyle: "divine-bolt",
    cosmeticAttribute: { i18nKey: "INFERNO_CHAMPION" },
    gameplayEffect: {},
  },
  {
    id: "FROSTBORN_GLADIATOR",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_GLADIATOR",
    paletteOverride: { primary: "#8a5232", secondary: "#22120a", accent: "#ff6a3a", glow: "rgba(255,106,58,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "molten",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff6a3a", behavior: "embers" },
    projectileStyle: "magma-orb",
    cosmeticAttribute: { i18nKey: "FROSTBORN_GLADIATOR" },
    gameplayEffect: {},
  },
  {
    id: "FROSTBORN_CHAMPION",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_CHAMPION",
    paletteOverride: { primary: "#f0e8d4", secondary: "#1a1a22", accent: "#ffe08a", glow: "rgba(255,224,138,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "radiant",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ffe08a", behavior: "solar-flares" },
    projectileStyle: "divine-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_CHAMPION" },
    gameplayEffect: {},
  },
  {
    id: "STORMCALLER_GLADIATOR",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_GLADIATOR",
    paletteOverride: { primary: "#7a4428", secondary: "#1c0e08", accent: "#ff5a2a", glow: "rgba(255,90,42,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "molten",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff5a2a", behavior: "embers" },
    projectileStyle: "magma-orb",
    cosmeticAttribute: { i18nKey: "STORMCALLER_GLADIATOR" },
    gameplayEffect: {},
  },
  {
    id: "STORMCALLER_CHAMPION",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_CHAMPION",
    paletteOverride: { primary: "#f0e8d4", secondary: "#1a1a22", accent: "#ffe06a", glow: "rgba(255,224,106,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "radiant",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ffe06a", behavior: "solar-flares" },
    projectileStyle: "divine-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_CHAMPION" },
    gameplayEffect: {},
  },
  {
    id: "IRONWOOD_LEGEND",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_LEGEND",
    paletteOverride: { primary: "#1e1a20", secondary: "#08060a", accent: "#ff3a5a", glow: "rgba(255,58,90,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "voidtouched",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff3a5a", behavior: "embers" },
    projectileStyle: "void-bolt",
    cosmeticAttribute: { i18nKey: "IRONWOOD_LEGEND" },
    gameplayEffect: {},
  },
  {
    id: "INFERNO_LEGEND",
    towerType: "INFERNO",
    i18nKey: "INFERNO_LEGEND",
    paletteOverride: { primary: "#1e1a20", secondary: "#08060a", accent: "#ff3a5a", glow: "rgba(255,58,90,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "voidtouched",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff3a5a", behavior: "embers" },
    projectileStyle: "void-bolt",
    cosmeticAttribute: { i18nKey: "INFERNO_LEGEND" },
    gameplayEffect: {},
  },
  {
    id: "FROSTBORN_LEGEND",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_LEGEND",
    paletteOverride: { primary: "#1e1a20", secondary: "#08060a", accent: "#ff3a5a", glow: "rgba(255,58,90,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "voidtouched",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff3a5a", behavior: "embers" },
    projectileStyle: "void-bolt",
    cosmeticAttribute: { i18nKey: "FROSTBORN_LEGEND" },
    gameplayEffect: {},
  },
  {
    id: "STORMCALLER_LEGEND",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_LEGEND",
    paletteOverride: { primary: "#1e1a20", secondary: "#08060a", accent: "#ff3a5a", glow: "rgba(255,58,90,0.5)" },
    unlockLevel: 1,
    tier: "DUEL",
    gemCost: 0,
    material: "voidtouched",
    coreShape: "",
    weaponDetail: "",
    particleStyle: { color: "#ff3a5a", behavior: "embers" },
    projectileStyle: "void-bolt",
    cosmeticAttribute: { i18nKey: "STORMCALLER_LEGEND" },
    gameplayEffect: {},
  },
];

/**
 * PACOTES — tower skins that only come inside a Store bundle bought with
 * real money (config/store.ts SKIN_BUNDLES). Never sold for Gems, never in
 * the daily shop or the Season Pass. Each one is built on one of its tower's
 * premium structures, in its own colours, with a mark of its own on top
 * (`packFlourish`, drawn by battlefield3d/models/towerModel.ts). Like every
 * paid skin, a small trade-off effect and the +5% Gold/shards bonus.
 */
function packSkin(id: string, towerType: TowerType, palette: TowerSkinPaletteOverride, material: SkinMaterialFinish, particle: SkinParticleStyle, projectileStyle: string, gameplayEffect: SkinGameplayEffect, tier: TowerSkinTier = "PACK"): TowerSkinDefinition {
  return { id, towerType, i18nKey: id, paletteOverride: palette, unlockLevel: 1, tier, gemCost: 0, material, coreShape: "", weaponDetail: "", particleStyle: particle, projectileStyle, cosmeticAttribute: { i18nKey: id }, gameplayEffect };
}

export const PACK_TOWER_SKINS: readonly TowerSkinDefinition[] = [
  packSkin("INFERNO_PACK_EMBERHEART", "INFERNO", { primary: "#5a1a14", secondary: "#1a0606", accent: "#ffb23a", glow: "rgba(255,120,40,0.65)" }, "molten", { color: "#ffb23a", behavior: "heart-embers" }, "heart-orb", { burnDamageMult: 1.05, attackSpeedMult: 0.97 }),
  packSkin("FROSTBORN_PACK_WINTER_CROWN", "FROSTBORN", { primary: "#c8d4e4", secondary: "#2a3a5a", accent: "#4a7aff", glow: "rgba(90,140,255,0.6)" }, "glacial", { color: "#bcd4ff", behavior: "crown-snow" }, "crown-shard", { slowPercentAdd: 0.05, damageMult: 0.97 }),
  packSkin("IRONWOOD_PACK_EMERALD_SENTINEL", "IRONWOOD", { primary: "#2a4a2e", secondary: "#0e1a10", accent: "#e8c050", glow: "rgba(80,230,140,0.55)" }, "natural", { color: "#6affa0", behavior: "emerald-glints" }, "emerald-arrow", { rangeMult: 1.05, attackSpeedMult: 0.97 }),
  packSkin("STORMCALLER_PACK_CRIMSON_STORM", "STORMCALLER", { primary: "#3a1014", secondary: "#14060a", accent: "#ff3a4a", glow: "rgba(255,58,74,0.6)" }, "tempest", { color: "#ff5a6a", behavior: "blood-sparks" }, "blood-bolt", { damageMult: 1.06, rangeMult: 0.96 }),
  packSkin("IRONWOOD_PACK_ECLIPSE", "IRONWOOD", { primary: "#141218", secondary: "#060508", accent: "#ffc848", glow: "rgba(255,200,72,0.6)" }, "voidtouched", { color: "#ffc848", behavior: "eclipse-motes" }, "eclipse-arrow", { critChanceAdd: 0.05, damageMult: 0.97 }),
  packSkin("FROSTBORN_PACK_ECLIPSE", "FROSTBORN", { primary: "#16141c", secondary: "#060508", accent: "#ffc848", glow: "rgba(255,200,72,0.6)" }, "voidtouched", { color: "#ffc848", behavior: "black-snow" }, "black-frost-shard", { freezeChanceAdd: 0.04, attackSpeedMult: 0.97 }),
  packSkin("INFERNO_PACK_SOVEREIGN", "INFERNO", { primary: "#f2ead8", secondary: "#9a7a3a", accent: "#e0203a", glow: "rgba(255,220,140,0.7)" }, "celestial", { color: "#ffe2a0", behavior: "royal-rays" }, "sovereign-sun", { aoeRadiusMult: 1.05, burnDamageMult: 0.97 }),
  packSkin("STORMCALLER_PACK_SOVEREIGN", "STORMCALLER", { primary: "#f2ead8", secondary: "#9a7a3a", accent: "#e0203a", glow: "rgba(255,220,140,0.7)" }, "celestial", { color: "#ffe2a0", behavior: "royal-sparks" }, "sovereign-bolt", { chainFalloffAdd: -0.04, damageMult: 0.97 }),
];

/**
 * RANKING PRIZES — tower skins that only the top of a ranking ever gets
 * (config/rankedRewards.ts): the yearly Eternal ranking ("Eternidade"), the
 * monthly Duel ranking ("Coroa da Arena") and the monthly Season ranking
 * ("Estandarte Real"). Never sold, never in a bundle. Each has its own 3D
 * crest, shot, impact and aura that no other skin uses.
 */
export const RANKED_TOWER_SKINS: readonly TowerSkinDefinition[] = [
  // Eternidade — violet night, gold and starlight
  packSkin("IRONWOOD_ETERNAL_RANK", "IRONWOOD", { primary: "#2a1a44", secondary: "#0c0816", accent: "#e8c060", glow: "rgba(170,120,255,0.6)" }, "celestial", { color: "#c8a8ff", behavior: "hourglass-sand" }, "eternal-arrow", { critChanceAdd: 0.05, attackSpeedMult: 0.97 }, "RANKED"),
  packSkin("INFERNO_ETERNAL_RANK", "INFERNO", { primary: "#2a1440", secondary: "#0c0614", accent: "#ffb0f0", glow: "rgba(200,120,255,0.65)" }, "celestial", { color: "#e0a0ff", behavior: "nebula-drift" }, "eternal-nova", { aoeRadiusMult: 1.05, damageMult: 0.97 }, "RANKED"),
  packSkin("FROSTBORN_ETERNAL_RANK", "FROSTBORN", { primary: "#262040", secondary: "#0a0814", accent: "#a8d8ff", glow: "rgba(150,180,255,0.6)" }, "celestial", { color: "#c8e0ff", behavior: "clock-glyphs" }, "eternal-stasis", { slowPercentAdd: 0.05, damageMult: 0.97 }, "RANKED"),
  packSkin("STORMCALLER_ETERNAL_RANK", "STORMCALLER", { primary: "#1e1438", secondary: "#08050f", accent: "#d8b0ff", glow: "rgba(190,140,255,0.65)" }, "celestial", { color: "#e8d0ff", behavior: "star-fall" }, "eternal-bolt", { chainFalloffAdd: -0.04, damageMult: 0.97 }, "RANKED"),
  // Coroa da Arena — arena red, bronze and steel
  packSkin("IRONWOOD_ARENA_RANK", "IRONWOOD", { primary: "#5a1a14", secondary: "#1e0806", accent: "#e0a050", glow: "rgba(255,140,80,0.55)" }, "armored", { color: "#ffb070", behavior: "arena-sparks" }, "arena-arrow", { critChanceAdd: 0.04, rangeMult: 0.97 }, "RANKED"),
  packSkin("INFERNO_ARENA_RANK", "INFERNO", { primary: "#6a1a10", secondary: "#200806", accent: "#ffc060", glow: "rgba(255,120,40,0.6)" }, "molten", { color: "#ffa040", behavior: "war-embers" }, "arena-fire", { burnDamageMult: 1.05, rangeMult: 0.97 }, "RANKED"),
  packSkin("FROSTBORN_ARENA_RANK", "FROSTBORN", { primary: "#5a2026", secondary: "#1a080a", accent: "#d8e8ff", glow: "rgba(220,230,255,0.55)" }, "armored", { color: "#e8f0ff", behavior: "shield-glints" }, "arena-frost", { freezeChanceAdd: 0.04, damageMult: 0.97 }, "RANKED"),
  packSkin("STORMCALLER_ARENA_RANK", "STORMCALLER", { primary: "#5a1418", secondary: "#1a0608", accent: "#ffd070", glow: "rgba(255,180,90,0.6)" }, "armored", { color: "#ffd890", behavior: "gong-pulse" }, "arena-bolt", { damageMult: 1.05, attackSpeedMult: 0.97 }, "RANKED"),
  // Estandarte Real — royal blue, silver and laurel gold
  packSkin("IRONWOOD_SEASON_RANK", "IRONWOOD", { primary: "#1a2a5a", secondary: "#080e20", accent: "#f0d070", glow: "rgba(120,170,255,0.55)" }, "armored", { color: "#a8c8ff", behavior: "banner-motes" }, "standard-arrow", { rangeMult: 1.04, damageMult: 0.98 }, "RANKED"),
  packSkin("INFERNO_SEASON_RANK", "INFERNO", { primary: "#1e2a60", secondary: "#080c22", accent: "#ffd880", glow: "rgba(110,160,255,0.6)" }, "celestial", { color: "#8ab8ff", behavior: "blue-flame" }, "standard-fire", { burnDamageMult: 1.04, attackSpeedMult: 0.98 }, "RANKED"),
  packSkin("FROSTBORN_SEASON_RANK", "FROSTBORN", { primary: "#203066", secondary: "#080e22", accent: "#f0f4ff", glow: "rgba(170,200,255,0.6)" }, "glacial", { color: "#d8e8ff", behavior: "silver-mist" }, "standard-frost", { slowPercentAdd: 0.04, rangeMult: 0.98 }, "RANKED"),
  packSkin("STORMCALLER_SEASON_RANK", "STORMCALLER", { primary: "#1a2860", secondary: "#060a20", accent: "#e8f0ff", glow: "rgba(140,190,255,0.65)" }, "tempest", { color: "#b8d8ff", behavior: "comet-trail" }, "standard-bolt", { chainFalloffAdd: -0.03, damageMult: 0.98 }, "RANKED"),
];

const SKINS_BY_ID = new Map([...TOWER_SKINS, ...PRESTIGE_TOWER_SKINS, ...DUEL_TOWER_SKINS, ...PACK_TOWER_SKINS, ...RANKED_TOWER_SKINS].map((s) => [s.id, s]));

/** Ranking-prize skins for this tower type (config/rankedRewards.ts). */
export function getRankedSkinsForTower(type: TowerType): readonly TowerSkinDefinition[] {
  return RANKED_TOWER_SKINS.filter((s) => s.towerType === type);
}

export function getTowerSkinDefinition(id: string): TowerSkinDefinition | null {
  return SKINS_BY_ID.get(id) ?? null;
}

export function getSkinsForTower(type: TowerType): readonly TowerSkinDefinition[] {
  return TOWER_SKINS.filter((s) => s.towerType === type);
}

/** Bundle-exclusive skins for this tower type (config/store.ts SKIN_BUNDLES). */
export function getPackSkinsForTower(type: TowerType): readonly TowerSkinDefinition[] {
  return PACK_TOWER_SKINS.filter((s) => s.towerType === type);
}

/** Prestige-exclusive skins for this tower type — never purchasable, only ever granted (see PRESTIGE_TOWER_SKINS's own doc comment). */
export function getPrestigeSkinsForTower(type: TowerType): readonly TowerSkinDefinition[] {
  return PRESTIGE_TOWER_SKINS.filter((s) => s.towerType === type);
}
