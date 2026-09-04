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

export interface CastleSkinDefinition {
  id: string;
  /** i18n key: castleSkins.<id>.name / .description */
  i18nKey: string;
  paletteOverride: CastleSkinPaletteOverride;
}

/** One proof skin, matching towerSkins.ts's "one real skin ships the architecture" precedent — more are just another entry here, nothing else changes. */
export const CASTLE_SKINS: readonly CastleSkinDefinition[] = [
  {
    id: "OBSIDIAN_BASTION",
    i18nKey: "OBSIDIAN_BASTION",
    paletteOverride: { rock: "#2e2734", rockDark: "#130f18" },
  },
];

const CASTLE_SKINS_BY_ID = new Map(CASTLE_SKINS.map((s) => [s.id, s]));

export function getCastleSkinDefinition(id: string): CastleSkinDefinition | null {
  return CASTLE_SKINS_BY_ID.get(id) ?? null;
}
