import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { HIGH_GROUND_RANGE_MULT, MAX_TOWERS_ON_MAP, RUNE_ALTAR_DAMAGE_MULT } from "@/data/mapLayouts";

interface DeployOverlayProps {
  phaseNumber: number;
  phaseI18nKey: string;
  towerCount: number;
  /** A tower is picked up and waiting for its destination. */
  moving: boolean;
  onAutoArrange: () => void;
  onStart: () => void;
}

const pct = (mult: number) => Math.round((mult - 1) * 100);

/**
 * DEPLOY — shown when the run reaches a new map (every phase has its own
 * road and build sites). Towers keep everything (level, Mastery,
 * specialization, skin, items); they were placed on a suggested
 * arrangement and the player can move/swap them freely here before the
 * phase begins. The map underneath stays interactive: click a tower, then
 * click where it should go.
 */
export function DeployOverlay({ phaseNumber, phaseI18nKey, towerCount, moving, onAutoArrange, onStart }: DeployOverlayProps) {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  // Build sites can sit anywhere on the map, including under this panel, so
  // it gets out of the way: a slim strip while a tower is being moved, or
  // whenever the player collapses it. The strip itself lets clicks through
  // to the map; only its buttons catch them.
  if (moving || collapsed) {
    return (
      <div style={stripStyle} role="dialog" aria-label={t("deploy.title")}>
        <span style={stripTextStyle}>{moving ? t("deploy.movingShort") : t(`phases.${phaseI18nKey}.name` as TranslationKey)}</span>
        {!moving && (
          <>
            <button style={{ ...ghostStyle, ...smallButton }} onClick={() => setCollapsed(false)}>
              {t("deploy.showPanel")}
            </button>
            <button style={{ ...primaryStyle, ...smallButton }} onClick={onStart}>
              {t("deploy.start")}
            </button>
          </>
        )}
      </div>
    );
  }
  return (
    <div style={panelStyle} role="dialog" aria-label={t("deploy.title")}>
      <div style={kickerStyle}>{t("deploy.kicker", { number: phaseNumber })}</div>
      <div style={titleStyle}>{t(`phases.${phaseI18nKey}.name` as TranslationKey)}</div>
      <p style={bodyStyle}>{t("deploy.body")}</p>
      <div style={legendStyle}>
        <span style={legendItemStyle}>
          <span style={{ ...dotStyle, background: "#9fd8ff", boxShadow: "0 0 8px #9fd8ff" }} />
          {t("deploy.highGround", { pct: pct(HIGH_GROUND_RANGE_MULT) })}
        </span>
        <span style={legendItemStyle}>
          <span style={{ ...dotStyle, background: "#c79bff", boxShadow: "0 0 8px #c79bff" }} />
          {t("deploy.runeAltar", { pct: pct(RUNE_ALTAR_DAMAGE_MULT) })}
        </span>
      </div>
      <div style={rowStyle}>
        <span style={countStyle}>{t("deploy.towerCount", { count: towerCount, max: MAX_TOWERS_ON_MAP })}</span>
        <button style={ghostStyle} onClick={() => setCollapsed(true)}>
          {t("deploy.hidePanel")}
        </button>
        <button style={ghostStyle} onClick={onAutoArrange}>
          {t("deploy.autoArrange")}
        </button>
        <button style={primaryStyle} onClick={onStart}>
          {t("deploy.start")}
        </button>
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 14,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(560px, calc(100% - 24px))",
  boxSizing: "border-box",
  padding: "14px 18px 14px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "linear-gradient(160deg, rgba(40,28,16,0.97), rgba(22,15,8,0.97))",
  boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
  color: PALETTE.uiText,
  zIndex: 7,
};
const stripStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: "calc(100% - 24px)",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px 6px 14px",
  borderRadius: 999,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(26,18,10,0.9)",
  boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
  color: PALETTE.uiText,
  zIndex: 7,
  pointerEvents: "none",
};
const stripTextStyle: CSSProperties = { fontSize: 13, fontWeight: 600, padding: "3px 6px 3px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const smallButton: CSSProperties = { padding: "5px 12px", fontSize: 12.5, pointerEvents: "auto", whiteSpace: "nowrap" };
const kickerStyle: CSSProperties = { fontSize: 12, color: PALETTE.gold, fontWeight: 700 };
const titleStyle: CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: PALETTE.uiAccentBright };
const bodyStyle: CSSProperties = { margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: PALETTE.uiTextDim };
const legendStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8, fontSize: 12.5, color: PALETTE.uiText };
const legendItemStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7 };
const dotStyle: CSSProperties = { width: 9, height: 9, borderRadius: "50%", display: "inline-block" };
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" };
const countStyle: CSSProperties = { fontSize: 12.5, color: PALETTE.uiTextDim, marginRight: "auto" };
const ghostStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.2)",
  color: PALETTE.uiText,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const primaryStyle: CSSProperties = {
  padding: "8px 18px",
  borderRadius: 8,
  border: "1px solid #f2c873",
  background: "linear-gradient(180deg, #f6cf7a, #e8b04b 55%, #c58a2c)",
  color: "#2b1906",
  fontWeight: 800,
  fontSize: 13.5,
  cursor: "pointer",
};
