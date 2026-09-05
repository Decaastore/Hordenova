import type { CSSProperties } from "react";
import type { EndgameWallReport } from "@/engine/GameEngine";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { SkullIcon } from "./icons";

interface EndgameWallBannerProps {
  report: EndgameWallReport;
  onDismiss: () => void;
}

/**
 * CORREÇÃO DE REQUISITOS (BOSS STALL FIX, Option B — Explicit Progression
 * Wall). Surfaced by GameEngine once ENDGAME_WALL_ESCAPE_THRESHOLD
 * consecutive boss escapes (zero kills) happen in a row — the exact
 * "PROGRESSÃO ESTAGNADA" state the spec asks for: current boss, best damage
 * achieved, best phase reached, and a real recommendation (reusing the same
 * rule-based diagnosis engine PROGRESSION_STOPPED already shows — see
 * BattleDiagnostics.generateFailureReport), never a silent escape with no
 * feedback.
 *
 * Deliberately NOT a full-screen blocking overlay like
 * ProgressionStoppedOverlay: the run keeps ticking underneath this banner
 * exactly as before (spec: "não deve travar o jogo") — dismissing it only
 * clears the banner, never pauses or resets anything. A fresh one can
 * reappear later if the streak (reset only by an actual boss kill) reaches
 * the threshold again.
 */
export function EndgameWallBanner({ report, onDismiss }: EndgameWallBannerProps) {
  const { t } = useLanguage();
  const damagePercent = Math.round(report.bestDamageFraction * 100);

  return (
    <div style={containerStyle} role="status">
      <div style={headerRowStyle}>
        <SkullIcon size={18} color={PALETTE.danger} />
        <div style={titleStyle}>{t("endgameWall.title")}</div>
        <button onClick={onDismiss} style={closeButtonStyle} aria-label={t("endgameWall.dismiss")}>
          ×
        </button>
      </div>

      <div style={subtitleStyle}>
        {t("endgameWall.currentBoss", { boss: t(`bosses.${report.bossNameKey}.name` as TranslationKey), wave: report.wave })}
      </div>

      <div style={statsRowStyle}>
        <Stat label={t("endgameWall.bestDamage")} value={`${damagePercent}%`} />
        <Stat label={t("endgameWall.bestWave")} value={String(report.bestWave)} />
        <Stat label={t("endgameWall.escapes")} value={String(report.consecutiveEscapes)} />
      </div>

      {report.diagnosis.recommendations.length > 0 && (
        <div style={recommendationSectionStyle}>
          <div style={sectionLabelStyle}>{t("endgameWall.recommendation")}</div>
          <ul style={listStyle}>
            {report.diagnosis.recommendations.slice(0, 2).map((rec) => (
              <li key={rec.id} style={listItemStyle}>
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
        </div>
      )}

      <div style={continuesNoteStyle}>{t("endgameWall.continuesNote")}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={statValueStyle}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  width: 340,
  maxWidth: "calc(100% - 32px)",
  padding: "12px 16px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.danger}`,
  background: "linear-gradient(160deg, rgba(54,26,22,0.97), rgba(28,14,12,0.98))",
  boxShadow: `0 0 26px ${PALETTE.danger}44, 0 8px 24px rgba(0,0,0,0.5)`,
  color: PALETTE.uiText,
  zIndex: 5,
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  position: "relative",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 1.5,
  color: PALETTE.danger,
  textTransform: "uppercase",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: -4,
  right: -6,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
};

const subtitleStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  marginTop: 4,
};

const statsRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-around",
  marginTop: 10,
  paddingTop: 8,
  borderTop: `1px solid ${PALETTE.uiPanelBorder}`,
};

const statValueStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
};

const statLabelStyle: CSSProperties = {
  fontSize: 8.5,
  letterSpacing: 0.6,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
  marginTop: 1,
};

const recommendationSectionStyle: CSSProperties = {
  marginTop: 10,
  paddingTop: 8,
  borderTop: `1px solid ${PALETTE.uiPanelBorder}`,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 9.5,
  letterSpacing: 1,
  color: PALETTE.uiAccentBright,
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: 4,
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 14,
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const listItemStyle: CSSProperties = {
  fontSize: 10.5,
  lineHeight: 1.35,
  color: PALETTE.gold,
};

const continuesNoteStyle: CSSProperties = {
  fontSize: 9,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
  marginTop: 8,
  textAlign: "center",
};
