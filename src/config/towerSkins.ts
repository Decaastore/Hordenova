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

export interface TowerSkinDefinition {
  id: string;
  towerType: TowerType;
  /** i18n key: towerInfo.skins.<id>.name / .description */
  i18nKey: string;
  paletteOverride: TowerSkinPaletteOverride;
  /** Extra dark-fantasy ornament flag read by EntityRenderer's stage-gated draw code (e.g. a void-energy ring instead of the default rune glow). Cosmetic only. */
  ornament: "abyss" | "ancient" | "void" | "none";
  /** Minimum tower level required before this skin can be equipped — purely cosmetic gating, never a stat requirement. */
  unlockLevel: number;
}

export const TOWER_SKINS: readonly TowerSkinDefinition[] = [
  {
    id: "IRONWOOD_WARDEN_OF_THE_ABYSS",
    towerType: "IRONWOOD",
    i18nKey: "IRONWOOD_WARDEN_OF_THE_ABYSS",
    paletteOverride: { primary: "#241f22", secondary: "#0a0809", accent: "#8a3fff", glow: "rgba(138,63,255,0.55)" },
    ornament: "abyss",
    unlockLevel: 15,
  },
  {
    id: "INFERNO_ASHEN_TYRANT",
    towerType: "INFERNO",
    i18nKey: "INFERNO_ASHEN_TYRANT",
    paletteOverride: { primary: "#3a1a1a", secondary: "#150808", accent: "#ff2e2e", glow: "rgba(255,46,46,0.6)" },
    ornament: "abyss",
    unlockLevel: 15,
  },
  {
    id: "FROSTBORN_ANCIENT_GUARDIAN",
    towerType: "FROSTBORN",
    i18nKey: "FROSTBORN_ANCIENT_GUARDIAN",
    paletteOverride: { primary: "#7a8a6a", secondary: "#33402c", accent: "#d8e8b8", glow: "rgba(180,220,140,0.55)" },
    ornament: "ancient",
    unlockLevel: 15,
  },
  {
    id: "STORMCALLER_VOID",
    towerType: "STORMCALLER",
    i18nKey: "STORMCALLER_VOID",
    paletteOverride: { primary: "#1a1622", secondary: "#08060c", accent: "#5a1fff", glow: "rgba(90,31,255,0.6)" },
    ornament: "void",
    unlockLevel: 15,
  },
];

const SKINS_BY_ID = new Map(TOWER_SKINS.map((s) => [s.id, s]));

export function getTowerSkinDefinition(id: string): TowerSkinDefinition | null {
  return SKINS_BY_ID.get(id) ?? null;
}

export function getSkinsForTower(type: TowerType): readonly TowerSkinDefinition[] {
  return TOWER_SKINS.filter((s) => s.towerType === type);
}
