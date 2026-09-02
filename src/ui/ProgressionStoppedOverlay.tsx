import type { CSSProperties } from "react";
import type { HudSnapshot } from "@/engine/GameEngine";
import type { FailureReport } from "@/engine/BattleDiagnostics";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { SkullIcon } from "./icons";

interface ProgressionStoppedOverlayProps {
  hud: HudSnapshot;
  report: FailureReport | null;
  onDismiss: () => void;
  onRetry: () => void;
  onExitToMenu: () => void;
}

/**
 * The Active Idle "PROGRESSION STOPPED" diagnostic report — spec section 2.
 * Deliberately not a "YOU LOST" screen: it explains WHY the run stopped and
 * HOW to improve using real recommendations from BattleDiagnostics (see
 * generateFailureReport — rule-based off recorded battle data, never
 * random), then offers real actions before any future monetization surface
 * (see the disabled boost pill — spec section 9: show free options first).
 */
export function ProgressionStoppedOverlay({ hud, report, onDismiss, onRetry, onExitToMenu }: ProgressionStoppedOverlayProps) {
  const { t } = useLanguage();

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <SkullIcon size={30} color={PALETTE.danger} style={{ filter: `drop-shadow(0 0 10px ${PALETTE.danger}aa)` }} />
        <h1 style={titleStyle}>{t("progressionStopped.title")}</h1>
        <div style={phaseFailedStyle}>{t("progressionStopped.phaseFailed", { phase: hud.wave })}</div>
        <div style={dividerStyle} />

        {report && (
          <div style={reportGridStyle}>
            <section style={sectionStyle}>
              <div style={sectionTitleStyle}>{t("progressionStopped.whyDidILose")}</div>
              <ul style={listStyle}>
                {report.reasonKeys.map((key) => (
                  <li key={key} style={listItemStyle}>
                    {t(`progressionStopped.reasons.${key}`)}
                  </li>
                ))}
              </ul>
            </section>

            <section style={sectionStyle}>
              <div style={sectionTitleStyle}>{t("progressionStopped.howCanIImprove")}</div>
              <ul style={listStyle}>
                {report.recommendations.map((rec) => (
                  <li key={rec.id} style={{ ...listItemStyle, color: PALETTE.gold }}>
                    {rec.towerId
                      ? t("progressionStopped.recommendationLine", {
                          tower: t(`towers.${rec.towerType}.name`),
                          from: rec.fromLevel ?? 0,
                          to: rec.toLevel ?? 0,
                          percent: rec.damagePercentGain ?? 0,
                          stat: t("progressionStopped.statDamage"),
                        })
                      : t("progressionStopped.recommendationBuildNew", { tower: t(`towers.${rec.towerType}.name`) })}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        <div style={{ display: "flex", gap: 20, margin: "14px 0" }}>
          <Stat label={t("defeat.enemiesDefeated")} value={String(hud.enemiesDefeated)} />
          <Stat label={t("defeat.bestWave")} value={String(hud.bestWave)} highlight />
        </div>

        <div style={buttonRowStyle}>
          <button onClick={onDismiss} style={primaryButtonStyle}>
            {t("progressionStopped.continueBuilding")}
          </button>
          <button onClick={onRetry} style={primaryButtonStyle}>
            {t("progressionStopped.retry")}
          </button>
        </div>
        <div style={buttonRowStyle}>
          <button disabled style={boostButtonStyle}>
            {t("progressionStopped.boostComingSoon")}
          </button>
          <button onClick={onExitToMenu} style={secondaryButtonStyle}>
            {t("progressionStopped.mainMenu")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: 1, color: PALETTE.uiTextDim, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? PALETTE.gold : PALETTE.uiText }}>{value}</div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "radial-gradient(circle at 50% 40%, rgba(90,30,20,0.4), rgba(28,18,10,0.92) 70%)",
  zIndex: 5,
  overflowY: "auto",
  padding: 20,
};

const cardStyle: CSSProperties = {
  padding: "26px 36px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.97), rgba(30,20,12,0.98))",
  boxShadow: "0 0 60px rgba(226,87,74,0.15), 0 20px 50px rgba(0,0,0,0.6)",
  color: PALETTE.uiText,
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  maxWidth: 560,
  width: "100%",
};

const titleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 26,
  letterSpacing: 3,
  color: PALETTE.uiText,
  textShadow: `0 0 18px ${PALETTE.danger}77`,
};

const phaseFailedStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: 1.5,
  color: PALETTE.danger,
  marginTop: 6,
  fontWeight: 700,
};

const dividerStyle: CSSProperties = {
  width: 60,
  height: 2,
  background: PALETTE.danger,
  opacity: 0.5,
  margin: "12px auto",
};

const reportGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 20,
  width: "100%",
  textAlign: "left",
  marginBottom: 6,
};

const sectionStyle: CSSProperties = {
  minWidth: 0,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1,
  color: PALETTE.uiAccentBright,
  textTransform: "uppercase",
  marginBottom: 6,
  fontWeight: 700,
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 16,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const listItemStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.4,
  color: PALETTE.uiText,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  marginTop: 8,
};

const primaryButtonStyle: CSSProperties = {
  padding: "11px 22px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.18)",
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: 0.6,
  boxShadow: `0 0 16px ${PALETTE.uiAccent}55`,
};

const secondaryButtonStyle: CSSProperties = {
  padding: "11px 22px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "transparent",
  color: PALETTE.uiTextDim,
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: 0.6,
};

const boostButtonStyle: CSSProperties = {
  padding: "11px 22px",
  borderRadius: 8,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
  background: "transparent",
  color: PALETTE.uiTextDim,
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: 0.6,
  opacity: 0.5,
  cursor: "not-allowed",
};
