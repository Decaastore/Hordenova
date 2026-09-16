import type { TowerType } from "./towerStats";

/**
 * Tower Skin architecture (Progression 2.0 spec section 10/11). A skin is a
 * pure visual override — a palette swap plus an optional extra-ornament
 * flag consumed by rendering/EntityRenderer.ts's draw functions. It NEVER
 * appears in TowerLevelStats/TowerSpecial and is never read by
 * CombatSystem.ts, so equipping one is architecturally incapable of
 * touching damage/attack-speed/range/drop-rate/progression — the same
 * guarantee proven by a dedicated test (see towerSkins.test.ts).
 *
 * `paletteOverride` mirrors rendering/theme.ts's TowerTheme shape exactly
 * (primary/secondary/accent/glow) so applying a skin is just "merge these
 * fields over the base theme before drawing" — see EntityRenderer.drawTower.
 * Only one real skin per tower ships in this pass (the architecture proof);
 * adding another later is one more entry in TOWER_SKINS, nothing else.
 */

export interface TowerSkinPaletteOverride {
  primary?: string;
  secondary?: string;
  accent?: string;
  glow?: string;
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
  /** i18n key: towerInfo.skins.<id>.name / .description */
  i18nKey: string;
  paletteOverride: TowerSkinPaletteOverride;
  /** Extra dark-fantasy ornament flag read by EntityRenderer's stage-gated draw code (e.g. a void-energy ring instead of the default rune glow). Cosmetic only. */
  ornament: "abyss" | "ancient" | "void" | "none";
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
}

export const TOWER_SKINS: readonly TowerSkinDefinition[] = [
  {
    id: "IRONWOOD_WARDEN_OF_THE_ABYSS",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_WARDEN_OF_THE_ABYSS",
    paletteOverride: { primary: "#241f22", secondary: "#0a0809", accent: "#8a3fff", glow: "rgba(138,63,255,0.55)" },
    ornament: "abyss",
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
  },
  {
    id: "INFERNO_ASHEN_TYRANT",
    towerType: "INFERNO",
    i18nKey: "INFERNO_ASHEN_TYRANT",
    paletteOverride: { primary: "#3a1a1a", secondary: "#150808", accent: "#ff2e2e", glow: "rgba(255,46,46,0.6)" },
    ornament: "abyss",
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
  },
  {
    id: "FROSTBORN_ANCIENT_GUARDIAN",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_ANCIENT_GUARDIAN",
    paletteOverride: { primary: "#7a8a6a", secondary: "#33402c", accent: "#d8e8b8", glow: "rgba(180,220,140,0.55)" },
    ornament: "ancient",
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
  },
  {
    id: "STORMCALLER_VOID",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_VOID",
    paletteOverride: { primary: "#1a1622", secondary: "#08060c", accent: "#5a1fff", glow: "rgba(90,31,255,0.6)" },
    ornament: "void",
    unlockLevel: 15,
    tier: "PREMIUM",
    gemCost: TOWER_SKIN_TIER_PRICES.PREMIUM,
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
    ornament: "ancient",
    unlockLevel: Number.POSITIVE_INFINITY,
    tier: "PRESTIGE",
    gemCost: 0,
  },
  {
    id: "INFERNO_PRESTIGE_ASCENDANT",
    towerType: "INFERNO",
    i18nKey: "INFERNO_PRESTIGE_ASCENDANT",
    paletteOverride: { primary: "#2a2410", secondary: "#100d04", accent: "#ffd257", glow: "rgba(255,210,87,0.6)" },
    ornament: "ancient",
    unlockLevel: Number.POSITIVE_INFINITY,
    tier: "PRESTIGE",
    gemCost: 0,
  },
  {
    id: "FROSTBORN_PRESTIGE_ASCENDANT",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_PRESTIGE_ASCENDANT",
    paletteOverride: { primary: "#2a2410", secondary: "#100d04", accent: "#ffd257", glow: "rgba(255,210,87,0.6)" },
    ornament: "ancient",
    unlockLevel: Number.POSITIVE_INFINITY,
    tier: "PRESTIGE",
    gemCost: 0,
  },
  {
    id: "STORMCALLER_PRESTIGE_ASCENDANT",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_PRESTIGE_ASCENDANT",
    paletteOverride: { primary: "#2a2410", secondary: "#100d04", accent: "#ffd257", glow: "rgba(255,210,87,0.6)" },
    ornament: "ancient",
    unlockLevel: Number.POSITIVE_INFINITY,
    tier: "PRESTIGE",
    gemCost: 0,
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
