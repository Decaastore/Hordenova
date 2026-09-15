import { useState, type CSSProperties, type ReactNode } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getItemDefinition } from "@/config/itemDefinitions";
import { getRarityDefinition } from "@/config/rarity";
import { getBossDefinitionById } from "@/config/bossConfig";
import { RarityBadge } from "./RarityBadge";
import { ItemGlyph } from "./ItemGlyph";

export const ITEM_TOOLTIP_KEYFRAMES = `
@keyframes hordenova-tooltip-fade {
  from { opacity: 0; transform: translate(-50%, -4px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
`;

/**
 * ITENS COMO ITENS REAIS spec section 5 — a professional hover tooltip
 * (icon, name, rarity, type, description, effects, origin), shown on
 * hover without requiring a click. Wraps any item tile — the existing
 * click-to-open ItemDetailsModal (full history/drop-table/trade view)
 * stays exactly as it was; this is the quick-glance layer on top of it,
 * not a replacement.
 */
export function ItemHoverCard({ itemDefinitionId, children }: { itemDefinitionId: string; children: ReactNode }) {
  const [hovering, setHovering] = useState(false);
  const def = getItemDefinition(itemDefinitionId);
  if (!def) return <>{children}</>;

  return (
    <div
      style={wrapperStyle}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {children}
      {hovering && <ItemTooltip itemDefinitionId={itemDefinitionId} />}
    </div>
  );
}

export function ItemTooltip({ itemDefinitionId }: { itemDefinitionId: string }) {
  const { t } = useLanguage();
  const def = getItemDefinition(itemDefinitionId);
  if (!def) return null;
  const rarityDef = getRarityDefinition(def.rarity);
  const boss = def.source.type !== "PHASE_MILESTONE" ? getBossDefinitionById(def.source.refId) : null;

  return (
    <div style={{ ...tooltipStyle, borderColor: rarityDef.color, boxShadow: `0 0 24px ${rarityDef.glow}, 0 10px 30px rgba(0,0,0,0.6)` }}>
      <div style={headerRowStyle}>
        <ItemGlyph category={def.category} rarity={rarityDef} size={48} />
        <div>
          <div style={nameStyle}>{t(`items.${def.i18nKey}.name` as TranslationKey)}</div>
          <div style={badgeRowStyle}>
            <RarityBadge rarity={def.rarity} />
            <span style={typeTagStyle}>{t(`itemCategory.${def.category}` as TranslationKey)}</span>
          </div>
        </div>
      </div>
      <p style={descriptionStyle}>{t(`items.${def.i18nKey}.description` as TranslationKey)}</p>
      {def.effects.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>{t("inventory.effects")}</div>
          {def.effects.map((effect, i) => (
            <div key={i} style={effectLineStyle}>
              {t(`itemEffect.${effect.kind}` as TranslationKey, { value: effect.value })}
            </div>
          ))}
        </div>
      )}
      {boss && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>{t("inventory.acquiredFrom")}</div>
          <div style={mutedLineStyle}>{t(`bosses.${boss.i18nKey}.name` as TranslationKey)}</div>
        </div>
      )}
      {!def.tradable && <div style={soulboundTagStyle}>{t("inventory.soulbound")}</div>}
    </div>
  );
}

const wrapperStyle: CSSProperties = {
  position: "relative",
};

const tooltipStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: "50%",
  transform: "translateX(-50%)",
  width: 220,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid",
  background: "linear-gradient(165deg, rgba(28,18,10,0.98), rgba(10,7,4,0.99))",
  color: PALETTE.uiText,
  zIndex: 30,
  pointerEvents: "none",
  animation: "hordenova-tooltip-fade 120ms ease-out",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const nameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 13,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  marginBottom: 4,
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const typeTagStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
};

const descriptionStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.5,
  color: PALETTE.uiText,
  marginTop: 10,
  marginBottom: 0,
};

const sectionStyle: CSSProperties = {
  marginTop: 8,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 8.5,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
  marginBottom: 3,
};

const effectLineStyle: CSSProperties = {
  fontSize: 11,
  color: PALETTE.success,
  fontWeight: 700,
};

const mutedLineStyle: CSSProperties = {
  fontSize: 11,
  color: PALETTE.uiTextDim,
};

const soulboundTagStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.4,
  color: PALETTE.danger,
  textTransform: "uppercase",
};
