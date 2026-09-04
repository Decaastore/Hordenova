import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getAscensionStatus } from "@/engine/AscensionManager";
import { formatDurationShort } from "@/utils/formatDuration";

/**
 * Master Implementation spec section 1 — makes the current mode
 * unmistakable while actually playing, not just on the mode-select screen.
 * Read-only: getAscensionStatus() never mutates anything, so this can
 * safely recompute on every parent re-render (GameScreen already re-renders
 * on every HUD-relevant engine tick) without any extra plumbing.
 */
export function AscensionHudBadge() {
  const { t } = useLanguage();
  const status = getAscensionStatus();

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>🏆 {t(`ascension.seasonThemes.${status.themeNameKey}` as TranslationKey)}</div>
      <div style={timerStyle}>{t("ascension.hudBadge.endsIn", { time: formatDurationShort(status.timeRemainingMs) })}</div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: 16,
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.gem}`,
  background: "linear-gradient(160deg, rgba(52,37,22,0.92), rgba(30,20,10,0.92))",
  color: PALETTE.uiText,
  zIndex: 3,
  pointerEvents: "none",
};

const labelStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.6,
  color: PALETTE.gem,
};

const timerStyle: CSSProperties = {
  fontSize: 9.5,
  color: PALETTE.uiTextDim,
  marginTop: 2,
};
