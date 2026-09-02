import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";

interface PhaseBannerProps {
  phaseId: string;
}

const VISIBLE_MS = 4200;

/**
 * "Estou entrando em um lugar novo" (Content Progression spec section 10):
 * a brief ceremonial banner the moment the player's wave crosses into a
 * new phase/biome. Purely presentational — derives its own show/hide timing
 * from `phaseId` changing, no engine-side "just crossed" bookkeeping needed.
 * Doesn't fire on first mount (arriving mid-phase on load isn't "entering").
 */
export function PhaseBanner({ phaseId }: PhaseBannerProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const prevPhaseId = useRef<string | null>(null);

  useEffect(() => {
    const previous = prevPhaseId.current;
    prevPhaseId.current = phaseId;
    if (previous === null || previous === phaseId) return;

    setVisible(true);
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [phaseId]);

  if (!visible) return null;

  return (
    <div style={containerStyle}>
      <div style={eyebrowStyle}>{t("phaseBanner.entering")}</div>
      <div style={nameStyle}>{t(`phases.${phaseId}.name` as TranslationKey)}</div>
      <div style={taglineStyle}>{t(`phases.${phaseId}.tagline` as TranslationKey)}</div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "absolute",
  top: "28%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  zIndex: 6,
  pointerEvents: "none",
  textAlign: "center",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 3,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
  textShadow: "0 2px 8px rgba(0,0,0,0.9)",
};

const nameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 34,
  fontWeight: 700,
  letterSpacing: 2,
  color: PALETTE.uiAccentBright,
  textShadow: `0 0 24px ${PALETTE.uiAccent}aa, 0 3px 10px rgba(0,0,0,0.9)`,
};

const taglineStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: 1,
  color: PALETTE.uiText,
  textShadow: "0 2px 8px rgba(0,0,0,0.9)",
};
