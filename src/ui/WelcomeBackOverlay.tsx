import type { CSSProperties } from "react";
import type { OfflineSimulationResult } from "@/engine/OfflineDefense";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";

interface WelcomeBackOverlayProps {
  summary: OfflineSimulationResult;
  onContinue: () => void;
}

/** Offline Defense summary — spec section 11's "WELCOME BACK / WHILE YOU WERE AWAY..." beat. */
export function WelcomeBackOverlay({ summary, onContinue }: WelcomeBackOverlayProps) {
  const { t } = useLanguage();

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>{t("offlineReturn.title")}</h1>
        <div style={dividerStyle} />
        <div style={subtitleStyle}>{t("offlineReturn.subtitle")}</div>

        <div style={statsListStyle}>
          <StatLine label={t("offlineReturn.phasesCleared", { count: summary.phasesCleared })} />
          {summary.miniBossesCleared > 0 && (
            <StatLine label={t("offlineReturn.miniBossesCleared", { count: summary.miniBossesCleared })} />
          )}
          {summary.bossesCleared > 0 && (
            <StatLine label={t("offlineReturn.bossesCleared", { count: summary.bossesCleared })} />
          )}
          <StatLine label={t("offlineReturn.resourcesEarned", { count: summary.resourcesEarned })} highlight />
        </div>

        <div style={progressionBoxStyle}>
          <div style={progressionLabelStyle}>{t("offlineReturn.currentProgression")}</div>
          <div style={progressionValueStyle}>{t("offlineReturn.phaseLabel", { phase: summary.endingWave })}</div>
        </div>

        <button onClick={onContinue} style={primaryButtonStyle}>
          {t("offlineReturn.continueButton")}
        </button>
      </div>
    </div>
  );
}

function StatLine({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color: highlight ? PALETTE.gold : PALETTE.uiText }}>{label}</div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "radial-gradient(circle at 50% 40%, rgba(60,90,120,0.35), rgba(28,18,10,0.92) 70%)",
  zIndex: 5,
};

const cardStyle: CSSProperties = {
  padding: "30px 42px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.97), rgba(30,20,12,0.98))",
  boxShadow: "0 0 60px rgba(120,180,255,0.15), 0 20px 50px rgba(0,0,0,0.6)",
  color: PALETTE.uiText,
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  minWidth: 300,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 26,
  letterSpacing: 3,
  color: PALETTE.uiAccentBright,
  textShadow: `0 0 18px ${PALETTE.uiAccent}77`,
};

const dividerStyle: CSSProperties = {
  width: 60,
  height: 2,
  background: PALETTE.uiAccent,
  opacity: 0.5,
  margin: "10px auto",
};

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  color: PALETTE.uiTextDim,
  letterSpacing: 0.5,
  marginBottom: 16,
};

const statsListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 18,
};

const progressionBoxStyle: CSSProperties = {
  padding: "10px 20px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.25)",
  marginBottom: 20,
};

const progressionLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.4,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const progressionValueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: PALETTE.uiText,
};

const primaryButtonStyle: CSSProperties = {
  padding: "11px 32px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.18)",
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 1,
  boxShadow: `0 0 16px ${PALETTE.uiAccent}55`,
};
