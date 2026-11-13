/**
 * Castle Skin architecture (Visual Overhaul spec section 20). Mirrors
 * config/towerSkins.ts's proven pattern exactly: a skin is a pure palette
 * override, merged over the base look at draw time, and it is
 * architecturally incapable of touching gameplay because nothing in
 * GameEngine, SaveSystem, or CombatSystem ever reads a CastleSkinDefinition
 * — the three layers stay strictly separate:
 *
 *   CASTLE GAMEPLAY   — baseHp/maxBaseHp, owned entirely by GameEngine
 *                        (see GameEngine.ts's `baseHp`/`maxBaseHp` fields
 *                        and HudSnapshot). Never imports this file.
 *   CASTLE VISUAL      — hpPercent -> tier mapping (castleConfig.ts's
 *   DEFINITION           CastleTierDefinition/getCastleHpTier). Applies
 *                        identically no matter which skin is equipped
 *                        (spec: "funcionar para qualquer skin compatível").
 *   CASTLE SKIN         — THIS file. A skin could future-alter the
 *                        fortress's stonework/gate/banner colors — and,
 *                        with real assets, architecture/materials/
 *                        lighting/ornaments/destruction-particles — but
 *                        NEVER hp/damage/resistance/gameplay (spec: "NUNCA
 *                        HP/dano/resistência/gameplay").
 *
 * No shop/catalog UI ships in this pass — this is the architecture spec
 * section 20 asks for prepared ahead of one, exactly like towerSkins.ts
 * shipped its first skins before any purchase flow existed. Passing a
 * CastleSkinDefinition into rendering/MapRenderer.ts's drawFortress (see
 * `skin` param) proves the wiring end-to-end with zero engine changes.
 */

export interface CastleSkinPaletteOverride {
  /** Overrides biome.palette.rock for the fortress draw only — every other biome-driven element (terrain, decorations, path) is untouched. */
  rock?: string;
  /** Overrides biome.palette.rockDark for the fortress draw only. */
  rockDark?: string;
}

export type CastleSkinSource = "ROULETTE" | "PRESTIGE" | "STORE" | "COLLECTION" | "BEGINNER";
export type CastleSkinAura = "EMBER" | "FROST" | "SOLAR" | "VERDANT" | "VOID" | "BANNERS" | "SHARDS";

export interface CastleSkinDefinition {
  id: string;
  /** i18n key: castleSkins.<id>.name / .description */
  i18nKey: string;
  paletteOverride: CastleSkinPaletteOverride;
  /** How it is earned. Only ROULETTE skins can come from the roulette; STORE skins are bought. */
  source: CastleSkinSource;
  /** SKINS DE CASTELO — the realistic castle sprite recolored with this hue ("color" blend), at this strength 0..1. */
  tint: string;
  tintStrength: number;
  /** Window/torch glow color. */
  glow: string;
  /** The skin's living effect around the castle (rendering/castleSkinFx.ts). */
  aura: CastleSkinAura;
  /** STORE skins only: Gems (free or purchased). */
  priceGems?: number;
}

/** FASE 6 — the Prestige P100 reward's id (config/prestige.ts's PRESTIGE_MILESTONE_REWARDS, "prestigeCastleSkin"). Granted directly into SaveData.unlockedCastleSkinIds by GameEngine.grantEarnedPrestigeMilestoneRewards, the exact same idiom the Roulette CASTLE_SKIN outcome already uses — never sold, never spun for. */
export const PRESTIGE_CASTLE_SKIN_ID = "PRESTIGE_ETERNAL_BASTION";

/** One proof skin, matching towerSkins.ts's "one real skin ships the architecture" precedent — more are just another entry here, nothing else changes. */
export const CASTLE_SKINS: readonly CastleSkinDefinition[] = [
  {
    id: "OBSIDIAN_BASTION",
    i18nKey: "OBSIDIAN_BASTION",
    paletteOverride: { rock: "#2e2734", rockDark: "#130f18" },
    source: "ROULETTE",
    tint: "#1c2a2c",
    tintStrength: 0.75,
    glow: "#5af0d8",
    aura: "SHARDS",
  },
  {
    id: PRESTIGE_CASTLE_SKIN_ID,
    i18nKey: PRESTIGE_CASTLE_SKIN_ID,
    paletteOverride: { rock: "#4a3f14", rockDark: "#1c1808" },
    source: "PRESTIGE",
    tint: "#c9a23a",
    tintStrength: 0.7,
    glow: "#ffe08a",
    aura: "SOLAR",
  },
  // SKINS DE CASTELO — sold in the Store (cosmetic only, never HP/damage/resistance)
  { id: "FROST_CITADEL", i18nKey: "FROST_CITADEL", paletteOverride: { rock: "#9fc3d8", rockDark: "#3d5b70" }, source: "STORE", tint: "#7fc4ff", tintStrength: 0.7, glow: "#bfe8ff", aura: "FROST", priceGems: 600 },
  { id: "INFERNAL_KEEP", i18nKey: "INFERNAL_KEEP", paletteOverride: { rock: "#5a2018", rockDark: "#240a06" }, source: "STORE", tint: "#c0301a", tintStrength: 0.65, glow: "#ff6a2a", aura: "EMBER", priceGems: 600 },
  { id: "SOLAR_SANCTUM", i18nKey: "SOLAR_SANCTUM", paletteOverride: { rock: "#e8dcc0", rockDark: "#8a7a52" }, source: "STORE", tint: "#ffe2a0", tintStrength: 0.55, glow: "#fff0c0", aura: "SOLAR", priceGems: 900 },
  { id: "VERDANT_HOLD", i18nKey: "VERDANT_HOLD", paletteOverride: { rock: "#4d6a3a", rockDark: "#1f2e16" }, source: "STORE", tint: "#5f9a3a", tintStrength: 0.6, glow: "#d8ff9a", aura: "VERDANT", priceGems: 450 },
  // earned, never sold
  { id: "VOID_SPIRE", i18nKey: "VOID_SPIRE", paletteOverride: { rock: "#3a2a5a", rockDark: "#140c24" }, source: "COLLECTION", tint: "#7a4ad8", tintStrength: 0.72, glow: "#c79bff", aura: "VOID" },
  { id: "RECRUIT_KEEP", i18nKey: "RECRUIT_KEEP", paletteOverride: { rock: "#8a6a44", rockDark: "#3a2a16" }, source: "BEGINNER", tint: "#c08a4a", tintStrength: 0.45, glow: "#ffcf8a", aura: "BANNERS" },
];

export const STORE_CASTLE_SKINS = CASTLE_SKINS.filter((s) => s.source === "STORE");

const CASTLE_SKINS_BY_ID = new Map(CASTLE_SKINS.map((s) => [s.id, s]));

export function getCastleSkinDefinition(id: string): CastleSkinDefinition | null {
  return CASTLE_SKINS_BY_ID.get(id) ?? null;
}
