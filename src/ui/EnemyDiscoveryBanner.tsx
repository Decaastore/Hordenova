import { useEffect, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import type { EnemyType } from "@/config/enemyStats";

interface EnemyDiscoveryBannerProps {
  enemyType: EnemyType;
  onAcknowledge: () => void;
}

const AUTO_DISMISS_MS = 7000;

/**
 * "NEW ENEMY / IRONCLAD / Heavy armor greatly reduces physical damage. /
 * WEAKNESS: Magic / Armor Penetration" — Content Progression spec section
 * 14. Fires once per enemy type ever (GameEngine.maybeDiscover persists
 * discoveredEnemyTypes so it never repeats after the first sighting), and
 * explains WHY a new threat breaks the current build, not just its stats.
 */
export function EnemyDiscoveryBanner({ enemyType, onAcknowledge }: EnemyDiscoveryBannerProps) {
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(onAcknowledge, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [enemyType, onAcknowledge]);

  return (
    <div style={containerStyle}>
      <div style={eyebrowStyle}>{t("discovery.newEnemy")}</div>
      <div style={nameStyle}>{t(`enemies.${enemyType}.name` as TranslationKey)}</div>
      <div style={descriptionStyle}>{t(`enemies.${enemyType}.description` as TranslationKey)}</div>
      <div style={weaknessRowStyle}>
        <span style={weaknessLabelStyle}>{t("discovery.weakness")}</span>
        <span style={weaknessValueStyle}>{t(`enemies.${enemyType}.weakness` as TranslationKey)}</span>
      </div>
      <button onClick={onAcknowledge} style={closeButtonStyle}>
        ×
      </button>
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  width: 230,
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(52,37,22,0.97), rgba(30,20,10,0.97))",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  color: PALETTE.uiText,
  zIndex: 5,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.6,
  color: PALETTE.danger,
  fontWeight: 700,
  textTransform: "uppercase",
};

const nameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 16,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
  marginTop: 2,
};

const descriptionStyle: CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.4,
  color: PALETTE.uiTextDim,
  marginTop: 5,
};

const weaknessRowStyle: CSSProperties = {
  marginTop: 8,
  display: "flex",
  flexDirection: "column",
  gap: 1,
};

const weaknessLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.2,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const weaknessValueStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: PALETTE.success,
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
