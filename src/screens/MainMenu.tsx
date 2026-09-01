import { useState, type CSSProperties } from "react";
import { loadSave } from "@/engine/SaveSystem";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageSelector } from "@/ui/LanguageSelector";
import { MenuBackground } from "./MenuBackground";

interface MainMenuProps {
  onStart: () => void;
}

/**
 * Cinematic epic-fantasy title screen — bright forest, golden light,
 * imposing fortress, vibrant portal (art direction: colorful medieval
 * adventure, not dark-fantasy horror). The button below calls the same
 * `onStart` the app has always used to begin a run — no second start-logic
 * path.
 */
export function MainMenu({ onStart }: MainMenuProps) {
  const save = loadSave();
  const [hover, setHover] = useState(false);
  const { t } = useLanguage();

  return (
    <div style={rootStyle}>
      <style>{PULSE_KEYFRAMES}</style>
      <MenuBackground />
      <div style={scrimStyle} />

      <LanguageSelector />

      <div style={contentStyle}>
        <div style={titleBlockStyle}>
          <div style={titleGlowStyle} aria-hidden="true" />
          <div style={titleStyle}>HORDENOVA</div>
          <div style={subtitleStyle}>{t("menu.subtitle")}</div>
        </div>

        <div style={playWrapStyle}>
          <div style={playHaloStyle} aria-hidden="true" />
          <button
            onClick={onStart}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              ...buttonStyle,
              transform: hover ? "translateY(-2px) scale(1.05)" : "translateY(0) scale(1)",
              boxShadow: hover ? buttonShadowHover : buttonShadow,
            }}
          >
            <span style={buttonLabelStyle}>{t("menu.play")}</span>
          </button>
        </div>

        <div style={bestWaveStyle}>
          <span style={{ opacity: 0.85 }}>{t("menu.bestWave")}</span>
          <span style={bestWaveValueStyle}>{String(save.bestWave).padStart(2, "0")}</span>
        </div>
      </div>
    </div>
  );
}

const PULSE_KEYFRAMES = `
@keyframes hordenova-play-halo {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.85; transform: translate(-50%, -50%) scale(1.1); }
}
`;

const rootStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  background: PALETTE.mapBackgroundFallback,
};

const scrimStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(30,22,10,0.05) 0%, rgba(30,22,10,0.18) 55%, rgba(20,14,6,0.62) 100%)",
};

const contentStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "clamp(14px, 3vh, 26px)",
  padding: "5vh 5vw 7vh",
  boxSizing: "border-box",
};

const titleBlockStyle: CSSProperties = {
  position: "relative",
  textAlign: "center",
  marginBottom: "clamp(8px, 2vh, 20px)",
};

const titleGlowStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(720px, 80vw)",
  height: "min(320px, 40vh)",
  background: "radial-gradient(ellipse at center, rgba(255,210,87,0.35), rgba(255,210,87,0) 70%)",
  filter: "blur(6px)",
  pointerEvents: "none",
  zIndex: -1,
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "clamp(44px, 9.5vw, 104px)",
  fontWeight: 900,
  letterSpacing: "clamp(4px, 1.2vw, 12px)",
  lineHeight: 1,
  backgroundImage: `linear-gradient(180deg, #fff6d8 0%, ${PALETTE.gold} 45%, #c9822a 100%)`,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
  WebkitTextStroke: "2px #5a3410",
  filter:
    "drop-shadow(0 0 22px rgba(255,210,87,0.75)) drop-shadow(0 6px 10px rgba(40,20,0,0.6))",
};

const subtitleStyle: CSSProperties = {
  marginTop: "clamp(8px, 1.6vh, 16px)",
  fontSize: "clamp(11px, 1.6vw, 15px)",
  fontWeight: 700,
  letterSpacing: "clamp(2px, 0.6vw, 5px)",
  color: PALETTE.uiText,
  textShadow: "0 2px 6px rgba(20,12,0,0.85)",
};

const playWrapStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const playHaloStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: "min(520px, 60vw)",
  height: "min(220px, 26vh)",
  background: "radial-gradient(ellipse at center, rgba(255,210,87,0.45), rgba(255,210,87,0) 68%)",
  animation: "hordenova-play-halo 2.6s ease-in-out infinite",
  pointerEvents: "none",
};

const buttonStyle: CSSProperties = {
  position: "relative",
  padding: "clamp(17px, 2.7vh, 24px) clamp(46px, 8vw, 76px)",
  fontSize: "clamp(17px, 2.2vw, 22px)",
  fontWeight: 800,
  letterSpacing: "clamp(1.5px, 0.4vw, 3px)",
  borderRadius: 16,
  border: `2px solid #8a5a1f`,
  background: `linear-gradient(180deg, #ffe9a0 0%, ${PALETTE.gold} 42%, #d98a2a 100%)`,
  color: "#4a2a08",
  cursor: "pointer",
  transition: "transform 160ms ease, box-shadow 160ms ease",
};

const buttonLabelStyle: CSSProperties = {
  textShadow: "0 1px 0 rgba(255,255,255,0.5)",
};

const buttonShadow =
  "inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 6px rgba(120,60,10,0.35), 0 0 20px rgba(255,210,87,0.55), 0 10px 24px rgba(30,15,0,0.45)";
const buttonShadowHover =
  "inset 0 2px 0 rgba(255,255,255,0.65), inset 0 -3px 6px rgba(120,60,10,0.35), 0 0 38px rgba(255,210,87,0.85), 0 14px 30px rgba(30,15,0,0.5)";

const bestWaveStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  fontSize: "clamp(9px, 1.1vw, 11px)",
  letterSpacing: 2,
  fontWeight: 700,
  color: PALETTE.uiText,
  textShadow: "0 2px 6px rgba(20,12,0,0.85)",
};

const bestWaveValueStyle: CSSProperties = {
  fontSize: "clamp(14px, 1.8vw, 18px)",
  fontWeight: 800,
  color: PALETTE.gold,
  letterSpacing: 1,
  textShadow: "0 2px 6px rgba(20,12,0,0.85)",
};
