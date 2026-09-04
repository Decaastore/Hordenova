import { useEffect, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import type { RouletteResult } from "@/engine/GameEngine";

interface RouletteBannerProps {
  result: RouletteResult;
  onAcknowledge: () => void;
}

const AUTO_DISMISS_MS = 6000;

/**
 * Master Implementation spec sections 46-48 — the Roulette result banner.
 * `result` was already genuinely rolled and already granted (see
 * GameEngine.triggerRouletteSpin) by the time this ever renders — this
 * component only ever displays a real outcome, never determines one, which
 * is the whole point of spec section 47's "sem resultado pré-determinado
 * escondido" requirement.
 */
export function RouletteBanner({ result, onAcknowledge }: RouletteBannerProps) {
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(onAcknowledge, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [result.wave, result.rewardType, onAcknowledge]);

  const isRareSkin = result.rewardType === "CASTLE_SKIN" && result.castleSkinId !== null;

  return (
    <div
      style={{
        ...containerStyle,
        borderColor: isRareSkin ? PALETTE.gem : PALETTE.gold,
        boxShadow: isRareSkin ? `0 0 30px ${PALETTE.gem}88, 0 8px 24px rgba(0,0,0,0.5)` : `0 0 22px ${PALETTE.gold}66, 0 8px 24px rgba(0,0,0,0.5)`,
      }}
      onClick={onAcknowledge}
      role="button"
    >
      <div style={eyebrowStyle}>{t("roulette.title")}</div>
      <div style={{ ...outcomeStyle, color: isRareSkin ? PALETTE.gem : PALETTE.uiAccentBright }}>
        {t(`roulette.outcomes.${result.rewardType}` as TranslationKey)}
      </div>
      {result.rewardType === "CASTLE_SKIN" && result.castleSkinId === null && (
        <div style={fallbackNoteStyle}>{t("roulette.fallbackNote")}</div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAcknowledge();
        }}
        style={closeButtonStyle}
      >
        ×
      </button>
    </div>
  );
}

const containerStyle: CSSProperties = {
  // Bottom-center (not top-center) — wave-10/30/50/... milestones often
  // coincide with a main boss wave (30/50/70/90/110/130 are all multiples
  // of 10), which already owns the top-center BossBanner/PhaseBanner
  // real estate; this never fights them for the same spot.
  position: "absolute",
  bottom: 16,
  left: "50%",
  transform: "translateX(-50%)",
  width: 240,
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid",
  background: "linear-gradient(160deg, rgba(52,37,22,0.97), rgba(30,20,10,0.97))",
  color: PALETTE.uiText,
  zIndex: 6,
  cursor: "pointer",
  textAlign: "center",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.6,
  color: PALETTE.uiTextDim,
  fontWeight: 700,
  textTransform: "uppercase",
};

const outcomeStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 16,
  fontWeight: 700,
  margin: "4px 0 2px",
};

const fallbackNoteStyle: CSSProperties = {
  fontSize: 9.5,
  color: PALETTE.uiTextDim,
  marginTop: 4,
  lineHeight: 1.4,
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 10,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 15,
  lineHeight: 1,
  cursor: "pointer",
};
