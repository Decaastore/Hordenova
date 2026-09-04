import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave, ASCENSION_STORAGE_KEY } from "@/engine/SaveSystem";
import { getAscensionStatus, syncSeasonIfNeeded } from "@/engine/AscensionManager";
import { formatDurationShort } from "@/utils/formatDuration";
import { MenuBackground } from "./MenuBackground";
import { AscensionPanel } from "@/ui/AscensionPanel";

export type GameMode = "INFINITE" | "ASCENSION";

interface ModeSelectScreenProps {
  onSelectMode: (mode: GameMode) => void;
  onBack: () => void;
}

/**
 * Master Implementation spec section 1 — the mode-select mockup made real:
 * two unmistakably different cards, one PERMANENT progress path and one
 * WEEKLY competition, never conflated. Mounting this screen is also the
 * entry point that catches Ascension up on any season boundary that
 * passed while the player was away (spec section 9), before any Ascension
 * number is ever displayed.
 */
export function ModeSelectScreen({ onSelectMode, onBack }: ModeSelectScreenProps) {
  const { t } = useLanguage();
  const [panelOpen, setPanelOpen] = useState(false);
  // Re-read after syncSeasonIfNeeded (which may mutate SaveData) rather than
  // relying on a value captured before the sync ran.
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    syncSeasonIfNeeded();
    setRefreshTick((n) => n + 1);
  }, []);

  const infiniteSave = useMemo(() => loadSave(), [refreshTick]);
  const ascensionSave = useMemo(() => loadSave(ASCENSION_STORAGE_KEY), [refreshTick]);
  const ascensionStatus = useMemo(() => getAscensionStatus(), [refreshTick]);

  return (
    <div style={rootStyle}>
      <div style={backgroundWrapStyle}>
        <MenuBackground transitionAt={null} />
        <div style={scrimStyle} />
      </div>

      <div style={contentStyle}>
        <div style={titleStyle}>{t("modeSelect.title")}</div>

        <div style={cardsRowStyle}>
          <div style={cardStyle}>
            <div style={cardIconStyle}>♾️</div>
            <div style={cardLabelStyle}>{t("modeSelect.infinite.label")}</div>
            <div style={cardSubtitleStyle}>{t("modeSelect.infinite.subtitle")}</div>
            <div style={cardStatStyle}>{t("modeSelect.infinite.phase", { wave: infiniteSave.bestWave })}</div>
            <button onClick={() => onSelectMode("INFINITE")} style={{ ...playButtonStyle, borderColor: PALETTE.uiAccent, color: PALETTE.uiAccentBright }}>
              {t("modeSelect.infinite.play")}
            </button>
          </div>

          <div style={{ ...cardStyle, borderColor: PALETTE.gem }}>
            <div style={cardIconStyle}>🏆</div>
            <div style={{ ...cardLabelStyle, color: PALETTE.gem }}>{t("modeSelect.ascension.label")}</div>
            <div style={cardSubtitleStyle}>{t("modeSelect.ascension.subtitle")}</div>
            <div style={cardSeasonNameStyle}>{t(`ascension.seasonThemes.${ascensionStatus.themeNameKey}` as TranslationKey)}</div>
            <div style={cardStatStyle}>{t("modeSelect.ascension.endsIn", { time: formatDurationShort(ascensionStatus.timeRemainingMs) })}</div>
            <div style={cardStatStyle}>{t("modeSelect.ascension.yourBest", { wave: ascensionSave.currentWave })}</div>
            <button onClick={() => onSelectMode("ASCENSION")} style={{ ...playButtonStyle, borderColor: PALETTE.gem, color: "#e8d4ff" }}>
              {t("modeSelect.ascension.play")}
            </button>
            <button onClick={() => setPanelOpen(true)} style={collectionLinkStyle}>
              {t("modeSelect.ascension.viewCollection")}
            </button>
          </div>
        </div>

        <button onClick={onBack} style={backButtonStyle}>
          ←
        </button>
      </div>

      {panelOpen && <AscensionPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}

const rootStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  background: PALETTE.mapBackgroundFallback,
};

const backgroundWrapStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
};

const scrimStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(180deg, rgba(20,14,6,0.55) 0%, rgba(20,14,6,0.75) 100%)",
};

const contentStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "clamp(20px, 4vh, 40px)",
  padding: "5vh 5vw",
  boxSizing: "border-box",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "clamp(22px, 3.4vw, 34px)",
  fontWeight: 800,
  letterSpacing: "clamp(2px, 0.6vw, 5px)",
  color: PALETTE.uiAccentBright,
  textShadow: "0 2px 10px rgba(20,12,0,0.85)",
};

const cardsRowStyle: CSSProperties = {
  display: "flex",
  gap: "clamp(16px, 3vw, 32px)",
  flexWrap: "wrap",
  justifyContent: "center",
};

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  width: "clamp(220px, 26vw, 300px)",
  padding: "clamp(20px, 3vh, 30px) clamp(18px, 2.4vw, 26px)",
  borderRadius: 16,
  border: `2px solid ${PALETTE.uiAccent}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.94), rgba(30,20,12,0.96))",
  boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
};

const cardIconStyle: CSSProperties = {
  fontSize: 34,
};

const cardLabelStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: 2,
  color: PALETTE.uiAccentBright,
};

const cardSubtitleStyle: CSSProperties = {
  fontSize: 10.5,
  letterSpacing: 1.4,
  fontWeight: 700,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
  marginBottom: 4,
};

const cardSeasonNameStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: PALETTE.gem,
  marginBottom: 2,
};

const cardStatStyle: CSSProperties = {
  fontSize: 12,
  color: PALETTE.uiText,
};

const playButtonStyle: CSSProperties = {
  marginTop: 12,
  padding: "10px 22px",
  borderRadius: 10,
  border: "2px solid",
  background: "rgba(0,0,0,0.25)",
  fontWeight: 800,
  fontSize: 12.5,
  letterSpacing: 1,
  cursor: "pointer",
};

const collectionLinkStyle: CSSProperties = {
  marginTop: 4,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 10,
  letterSpacing: 0.6,
  textDecoration: "underline",
  cursor: "pointer",
};

const backButtonStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  left: 18,
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.35)",
  color: PALETTE.uiText,
  fontSize: 16,
  cursor: "pointer",
};
