import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave } from "@/engine/SaveSystem";
import { getAscensionStatus, syncSeasonIfNeeded } from "@/engine/AscensionManager";
import { formatDurationShort } from "@/utils/formatDuration";
import { TopNav, type NavView } from "@/ui/TopNav";
import { AscensionPanel } from "@/ui/AscensionPanel";

interface SeasonScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

/**
 * PRÓXIMA GRANDE FASE spec sections 25-26 — the Season is a first-class
 * top-nav destination, not a screen you only glimpse while picking a mode
 * (there is no mode picker anymore — see AscensionManager.ts's "DECISÃO
 * DEFINITIVA SOBRE PROGRESSÃO" doc comment). Everything shown here reads
 * the same permanent save as the game itself; nothing is fabricated —
 * ranking honesty follows AscensionManager's existing documented stance
 * (no backend yet, so a real Top 5 of other players doesn't exist).
 */
export function SeasonScreen({ onNavigate, onPlay }: SeasonScreenProps) {
  const { t } = useLanguage();
  const [panelOpen, setPanelOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    syncSeasonIfNeeded();
    setRefreshTick((n) => n + 1);
  }, []);

  const save = useMemo(() => loadSave(), [refreshTick]);
  const status = useMemo(() => getAscensionStatus(), [refreshTick]);

  return (
    <div style={rootStyle}>
      <TopNav active="SEASON" onNavigate={onNavigate} onPlay={onPlay} />
      <div style={bodyStyle}>
        <div style={heroStyle}>
          <div style={seasonLabelStyle}>{t("season.title", { number: status.seasonNumber })}</div>
          <div style={themeNameStyle}>{t(`ascension.seasonThemes.${status.themeNameKey}` as TranslationKey)}</div>
          <div style={timerStyle}>{t("season.endsIn", { time: formatDurationShort(status.timeRemainingMs) })}</div>

          <div style={bestWaveCardStyle}>
            <div style={bestWaveLabelStyle}>{t("season.yourBest")}</div>
            <div style={bestWaveValueStyle}>{status.seasonBestWave}</div>
            {!status.hasParticipated && <div style={notParticipatingStyle}>{t("season.notYetParticipating")}</div>}
          </div>

          <button onClick={onPlay} style={playButtonStyle}>
            {t("nav.play")}
          </button>
          <button onClick={() => setPanelOpen(true)} style={collectionLinkStyle}>
            {t("season.viewCollection")}
          </button>
        </div>

        <div style={recordsRowStyle}>
          <Record label={t("ascension.records.seasonsWon")} value={save.ascensionSeasonsWon} />
          <Record label={t("ascension.records.top3")} value={save.ascensionTop3} />
          <Record label={t("ascension.records.top5")} value={save.ascensionTop5} />
        </div>

        <p style={honestNoteStyle}>{t("ascension.topFive.honestNote")}</p>
      </div>

      {panelOpen && <AscensionPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}

function Record({ label, value }: { label: string; value: number }) {
  return (
    <div style={recordStyle}>
      <div style={recordValueStyle}>{value}</div>
      <div style={recordLabelStyle}>{label}</div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: `linear-gradient(180deg, #241a10, #150f09)`,
  color: PALETTE.uiText,
  overflow: "hidden",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "24px 32px 60px",
  maxWidth: 640,
  margin: "0 auto",
  width: "100%",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 24,
};

const heroStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  textAlign: "center",
};

const seasonLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 2,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const themeNameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 26,
  fontWeight: 700,
  color: PALETTE.gem,
};

const timerStyle: CSSProperties = {
  fontSize: 12,
  color: PALETTE.uiTextDim,
  marginBottom: 8,
};

const bestWaveCardStyle: CSSProperties = {
  padding: "16px 28px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.gem}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.94), rgba(30,20,12,0.96))",
  marginBottom: 8,
};

const bestWaveLabelStyle: CSSProperties = {
  fontSize: 10.5,
  letterSpacing: 1.2,
  fontWeight: 700,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const bestWaveValueStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 34,
  fontWeight: 800,
  color: PALETTE.uiAccentBright,
};

const notParticipatingStyle: CSSProperties = {
  fontSize: 10,
  color: PALETTE.uiTextDim,
  marginTop: 4,
};

const playButtonStyle: CSSProperties = {
  marginTop: 4,
  padding: "12px 32px",
  borderRadius: 10,
  border: `2px solid ${PALETTE.gold}`,
  background: `linear-gradient(180deg, #ffe9a0, ${PALETTE.gold} 60%, #d98a2a)`,
  color: "#3a2408",
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: 1,
  cursor: "pointer",
};

const collectionLinkStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 11,
  letterSpacing: 0.6,
  textDecoration: "underline",
  cursor: "pointer",
};

const recordsRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-around",
  width: "100%",
  paddingTop: 18,
  borderTop: `1px solid ${PALETTE.uiPanelBorder}`,
};

const recordStyle: CSSProperties = {
  textAlign: "center",
};

const recordValueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: PALETTE.gold,
};

const recordLabelStyle: CSSProperties = {
  fontSize: 9.5,
  color: PALETTE.uiTextDim,
  marginTop: 2,
};

const honestNoteStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
  textAlign: "center",
};
