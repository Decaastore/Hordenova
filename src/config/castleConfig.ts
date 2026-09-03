/**
 * Castle Visual State architecture (Progression 2.0 spec section 12-15).
 * The Castle is layered exactly like towers/enemies: Gameplay State
 * (baseHp/maxBaseHp, owned by GameEngine) -> Visual State (this file's pure
 * hpPercent->tier mapping) -> the actual draw (rendering/MapRenderer.ts's
 * drawFortress + its damage overlay) -> VFX (rendering/vfx.ts's castle
 * impact burst + camera shake, triggered from the SAME "enemy reached base"
 * moment GameEngine already flags via the `castle_damage` audio event).
 *
 * Nothing here is skin-specific — the five tiers below apply to ANY
 * castle skin (see section 15: "funcionar para qualquer skin compatível").
 * A skin only ever overrides the fortress's stonework palette, never this
 * tier logic.
 */

export type CastleHpTier = 1 | 2 | 3 | 4 | 5;

export interface CastleTierDefinition {
  tier: CastleHpTier;
  /** Upper bound (inclusive) of hpPercent (0..1) this tier covers. */
  maxHpPercent: number;
  /** i18n key: castle.tiers.<i18nKey>.label — purely descriptive, shown nowhere critical yet (reserved for a future HP-state tooltip). */
  i18nKey: "INTACT" | "WORN" | "DAMAGED" | "CRITICAL" | "COLLAPSED";
}

export const CASTLE_TIERS: readonly CastleTierDefinition[] = [
  { tier: 1, maxHpPercent: 1.0, i18nKey: "INTACT" },
  { tier: 2, maxHpPercent: 0.75, i18nKey: "WORN" },
  { tier: 3, maxHpPercent: 0.5, i18nKey: "DAMAGED" },
  { tier: 4, maxHpPercent: 0.25, i18nKey: "CRITICAL" },
  { tier: 5, maxHpPercent: 0, i18nKey: "COLLAPSED" },
];

/** hpPercent is 0..1 (baseHp / maxBaseHp). Pure function — the single source both the renderer and any future HUD indicator should call. */
export function getCastleHpTier(hpPercent: number): CastleHpTier {
  const clamped = Math.min(Math.max(hpPercent, 0), 1);
  if (clamped <= 0) return 5;
  if (clamped <= 0.25) return 4;
  if (clamped <= 0.5) return 3;
  if (clamped <= 0.75) return 2;
  return 1;
}

export function getCastleTierDefinition(tier: CastleHpTier): CastleTierDefinition {
  return CASTLE_TIERS.find((t) => t.tier === tier)!;
}
