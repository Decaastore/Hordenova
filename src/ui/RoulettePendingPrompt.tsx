import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { ROULETTE_ENTRIES } from "@/config/roulette";

interface RoulettePendingPromptProps {
  wave: number;
  onSpin: () => void;
}

/** Purely cosmetic spin delay — the real roll/grant already happened synchronously inside GameEngine.spinPendingRoulette() by the time this timer fires; this only gates when the reveal (RouletteBanner) is allowed to render. */
const SPIN_ANIMATION_MS = 900;

/**
 * AUDITORIA E CORREÇÃO GERAL spec sections 2-3 — the Roulette must actually
 * APPEAR and require a real click before anything is granted. This renders
 * whenever GameEngine.getHudSnapshot().pendingRouletteSpinWave is non-null
 * (a milestone was reached but not yet spun — including across an F5, since
 * that field is derived from the PERSISTED pendingRouletteSpinWaves queue).
 *
 * Shows the real odds table (spec section 2: "possíveis resultados") using
 * config/roulette.ts's own ROULETTE_ENTRIES — the exact same weights
 * rollRoulette() uses, nothing display-only.
 */
export function RoulettePendingPrompt({ wave, onSpin }: RoulettePendingPromptProps) {
  const { t } = useLanguage();
  const [spinning, setSpinning] = useState(false);

  const handleClick = () => {
    if (spinning) return;
    setSpinning(true);
    // The click is the "decision" (spec section 3) — the roll itself
    // happens the instant onSpin() runs; this timeout only delays how long
    // the spinning visual plays before GameScreen's next render swaps this
    // prompt out for the RouletteBanner reveal (hud.pendingRouletteResult
    // becomes non-null the moment onSpin() returns).
    setTimeout(onSpin, SPIN_ANIMATION_MS);
  };

  return (
    <div style={containerStyle} role="dialog" aria-label={t("roulette.pendingTitle")}>
      <div style={eyebrowStyle}>{t("roulette.pendingTitle")}</div>
      <div style={subtitleStyle}>{t("roulette.pendingSubtitle", { wave })}</div>

      <div style={oddsLabelStyle}>{t("roulette.oddsTitle")}</div>
      <div style={oddsListStyle}>
        {ROULETTE_ENTRIES.map((entry) => (
          <div key={entry.type} style={oddsRowStyle}>
            <span>{t(`roulette.outcomes.${entry.type}` as TranslationKey)}</span>
            <span style={oddsPercentStyle}>{entry.weightPercent}%</span>
          </div>
        ))}
      </div>

      <button onClick={handleClick} disabled={spinning} style={{ ...spinButtonStyle, opacity: spinning ? 0.6 : 1 }}>
        {spinning ? t("roulette.spinning") : t("roulette.spinButton")}
      </button>
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  width: 260,
  padding: "14px 16px",
  borderRadius: 10,
  border: `1px solid ${PALETTE.gold}`,
  background: "linear-gradient(160deg, rgba(52,37,22,0.98), rgba(30,20,10,0.98))",
  color: PALETTE.uiText,
  zIndex: 6,
  textAlign: "center",
  boxShadow: `0 0 24px ${PALETTE.gold}55, 0 8px 24px rgba(0,0,0,0.55)`,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.6,
  color: PALETTE.uiAccentBright,
  fontWeight: 800,
  textTransform: "uppercase",
};

const subtitleStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  marginTop: 2,
  marginBottom: 8,
};

const oddsLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: 4,
};

const oddsListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  marginBottom: 10,
};

const oddsRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 10.5,
};

const oddsPercentStyle: CSSProperties = {
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
};

const spinButtonStyle: CSSProperties = {
  width: "100%",
  padding: "8px 0",
  borderRadius: 8,
  border: `1px solid ${PALETTE.gold}`,
  background: PALETTE.gold,
  color: "#241a08",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 1,
  cursor: "pointer",
};
