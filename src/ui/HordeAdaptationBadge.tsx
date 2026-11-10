import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PALETTE, TOWER_THEME } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { TOWER_TYPES, type TowerType } from "@/config/towerStats";

interface HordeAdaptationBadgeProps {
  multipliers: Readonly<Record<TowerType, number>>;
  changeSeq: number;
}

/**
 * A HORDA QUE APRENDE — a small card over the map, top-left, that only
 * appears once the horde has adapted: which tower it now shrugs off and
 * which one it's weak to. Click for the rule. It lights up for a moment
 * whenever the horde adapts again.
 */
export function HordeAdaptationBadge({ multipliers, changeSeq }: HordeAdaptationBadgeProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const firstSeq = useRef(changeSeq);
  useEffect(() => {
    if (changeSeq === firstSeq.current) return;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 2600);
    return () => window.clearTimeout(id);
  }, [changeSeq]);

  const resisted = TOWER_TYPES.filter((type) => multipliers[type] < 0.9999).sort((a, b) => multipliers[a] - multipliers[b]);
  const weak = TOWER_TYPES.find((type) => multipliers[type] > 1.0001);
  if (resisted.length === 0) return null;
  const towerName = (type: TowerType) => t(`towers.${type}.name` as TranslationKey);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      style={{
        ...cardStyle,
        borderColor: flash ? PALETTE.danger : PALETTE.uiPanelBorder,
        boxShadow: flash ? `0 0 18px ${PALETTE.danger}88` : cardStyle.boxShadow,
      }}
      aria-expanded={open}
      data-testid="horde-badge"
    >
      <div style={titleStyle}>{flash && resisted[0] ? t("horde.changed", { tower: towerName(resisted[0]) }) : t("horde.title")}</div>
      {resisted.map((type) => (
        <div key={type} style={lineStyle}>
          <span style={{ ...dotStyle, background: TOWER_THEME[type].primary }} />
          <span style={{ color: "#ff9a8a" }}>{t("horde.resistLine", { tower: towerName(type), pct: Math.round((1 - multipliers[type]) * 100) })}</span>
        </div>
      ))}
      {weak && (
        <div style={lineStyle}>
          <span style={{ ...dotStyle, background: TOWER_THEME[weak].primary }} />
          <span style={{ color: PALETTE.success }}>{t("horde.weakLine", { tower: towerName(weak), pct: Math.round((multipliers[weak] - 1) * 100) })}</span>
        </div>
      )}
      {open && <div style={explainStyle}>{t("horde.explain")}</div>}
    </button>
  );
}

const cardStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  left: 12,
  zIndex: 6,
  maxWidth: 250,
  display: "grid",
  gap: 3,
  padding: "8px 11px",
  borderRadius: 10,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.94), rgba(30,20,12,0.96))",
  color: PALETTE.uiText,
  boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
  textAlign: "left",
  cursor: "pointer",
  transition: "border-color 300ms, box-shadow 300ms",
  font: "inherit",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 13,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  marginBottom: 1,
};

const lineStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600 };
const dotStyle: CSSProperties = { width: 8, height: 8, borderRadius: 4, flexShrink: 0 };
const explainStyle: CSSProperties = { fontSize: 11, color: PALETTE.uiTextDim, lineHeight: 1.4, marginTop: 4, fontWeight: 400 };
