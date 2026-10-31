import { useState, type CSSProperties } from "react";
import { PALETTE, TOWER_THEME } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import type { TowerType } from "@/config/towerStats";
import { HIGH_GROUND_RANGE_MULT, RUNE_ALTAR_DAMAGE_MULT } from "@/data/mapLayouts";

export interface BenchTower {
  id: string;
  type: TowerType;
  level: number;
}

interface DeployOverlayProps {
  phaseNumber: number;
  phaseI18nKey: string;
  /** Towers still waiting for a spot on this map. */
  bench: readonly BenchTower[];
  /** The one the next click on the map will place. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStart: () => void;
}

const pct = (mult: number) => Math.round((mult - 1) * 100);

function isSmallScreen(): boolean {
  try {
    return typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 700px), (max-height: 560px)").matches;
  } catch {
    return false;
  }
}

/**
 * DEPLOY — shown when the run reaches a new map (every phase has its own
 * road and build sites). Every tower came off the old map with everything
 * it had (level, Mastery, specialization, skin, items) and waits here; the
 * player picks one and clicks a spot on the map to place it — ONCE. After
 * that, moving it is the regular reposition (the daily free move, then
 * Gems). The phase starts when every tower is on the map.
 */
export function DeployOverlay({ phaseNumber, phaseI18nKey, bench, selectedId, onSelect, onStart }: DeployOverlayProps) {
  const { t } = useLanguage();
  // On a phone the map area is only a few hundred pixels tall: start as the
  // slim strip there. Build sites can sit anywhere, including under the full
  // panel, so it can always be collapsed; the strip lets clicks through to
  // the map except on its own buttons.
  const [collapsed, setCollapsed] = useState(isSmallScreen);
  const done = bench.length === 0;

  const chips = (
    <div style={collapsed ? { ...chipsStyle, flexWrap: "nowrap", marginTop: 0 } : chipsStyle}>
      {[...bench].sort((a, b) => b.level - a.level).map((tower) => {
        const active = tower.id === selectedId;
        const theme = TOWER_THEME[tower.type];
        return (
          <button
            key={tower.id}
            onClick={() => onSelect(tower.id)}
            aria-pressed={active}
            style={{
              ...chipStyle,
              borderColor: active ? theme.accent : PALETTE.uiPanelBorder,
              boxShadow: active ? `0 0 12px ${theme.glow}` : "none",
              background: active ? "#4a3520" : "#3a2a18",
            }}
          >
            <span style={{ ...dotStyle, background: theme.primary, boxShadow: `0 0 6px ${theme.glow}` }} />
            {t(`towers.${tower.type}.name` as TranslationKey)}
            <span style={levelStyle}>{t("deploy.level", { level: tower.level })}</span>
          </button>
        );
      })}
    </div>
  );

  const startButton = (extra?: CSSProperties) => (
    <button style={{ ...primaryStyle, ...(done ? null : disabledStyle), ...extra }} onClick={onStart} disabled={!done} title={done ? undefined : t("deploy.placeAllFirst")}>
      {t("deploy.start")}
    </button>
  );

  if (collapsed) {
    return (
      <div style={stripStyle} role="dialog" aria-label={t("deploy.title")}>
        <span style={stripTextStyle}>{done ? t("deploy.allPlaced") : t("deploy.remaining", { count: bench.length })}</span>
        {!done && <div style={{ ...stripChipsWrap, pointerEvents: "auto" }}>{chips}</div>}
        <button style={{ ...ghostStyle, ...smallButton }} onClick={() => setCollapsed(false)}>
          {t("deploy.showPanel")}
        </button>
        {startButton(smallButton)}
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
      {!done && (
        <>
          <div style={sectionStyle}>{t("deploy.pickHint")}</div>
          {chips}
        </>
      )}
      <div style={rowStyle}>
        <span style={countStyle}>{done ? t("deploy.allPlaced") : t("deploy.remaining", { count: bench.length })}</span>
        <button style={ghostStyle} onClick={() => setCollapsed(true)}>
          {t("deploy.hidePanel")}
        </button>
        {startButton()}
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 14,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(580px, calc(100% - 24px))",
  boxSizing: "border-box",
  padding: "14px 18px 14px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "linear-gradient(160deg, rgba(40,28,16,0.97), rgba(22,15,8,0.97))",
  boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
  color: PALETTE.uiText,
  zIndex: 7,
  maxHeight: "calc(100% - 20px)",
  overflowY: "auto",
};
const stripStyle: CSSProperties = {
  // left+right with an auto margin (not left:50% + translate) so the strip
  // may use the full width on a phone and still sits centred
  position: "absolute",
  top: 8,
  left: 8,
  right: 8,
  marginInline: "auto",
  width: "fit-content",
  maxWidth: "calc(100% - 16px)",
  boxSizing: "border-box",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px 6px 14px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(26,18,10,0.92)",
  boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
  color: PALETTE.uiText,
  zIndex: 7,
  pointerEvents: "none",
};
const stripTextStyle: CSSProperties = { flex: "0 0 auto", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" };
// the tower list drops to its own row when the strip runs out of room (phones)
const stripChipsWrap: CSSProperties = { order: 3, minWidth: 0, flex: "1 1 260px", overflowX: "auto" };
const smallButton: CSSProperties = { padding: "5px 12px", fontSize: 12.5, pointerEvents: "auto", whiteSpace: "nowrap" };
const kickerStyle: CSSProperties = { fontSize: 12, color: PALETTE.gold, fontWeight: 700 };
const titleStyle: CSSProperties = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: PALETTE.uiAccentBright };
const bodyStyle: CSSProperties = { margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: PALETTE.uiTextDim };
const legendStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 8, fontSize: 12.5, color: PALETTE.uiText };
const legendItemStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7 };
const dotStyle: CSSProperties = { width: 9, height: 9, borderRadius: "50%", display: "inline-block", flexShrink: 0 };
const sectionStyle: CSSProperties = { marginTop: 12, fontSize: 12.5, fontWeight: 700, color: PALETTE.uiText };
const chipsStyle: CSSProperties = { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" };
const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 8,
  border: "1px solid",
  color: PALETTE.uiText,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const levelStyle: CSSProperties = { color: PALETTE.uiTextDim, fontWeight: 600 };
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
const disabledStyle: CSSProperties = { opacity: 0.45, cursor: "not-allowed" };
