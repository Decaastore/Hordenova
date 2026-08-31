import { useState, type CSSProperties } from "react";
import { loadSave } from "@/engine/SaveSystem";
import { PALETTE } from "@/rendering/theme";
import { MenuBackground } from "./MenuBackground";

interface MainMenuProps {
  onStart: () => void;
}

/**
 * Cinematic dark-fantasy title screen (Phase 2 spec section 13). The
 * button below calls the same `onStart` the app has always used to begin
 * a run — no second start-logic path.
 */
export function MainMenu({ onStart }: MainMenuProps) {
  const save = loadSave();
  const [hover, setHover] = useState(false);

  return (
    <div style={rootStyle}>
      <MenuBackground />
      <div style={scrimStyle} />

      <div style={contentStyle}>
        <div style={titleBlockStyle}>
          <div style={titleStyle}>HORDENOVA</div>
          <div style={subtitleStyle}>BUILD. UPGRADE. SURVIVE.</div>
        </div>

        <button
          onClick={onStart}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            ...buttonStyle,
            transform: hover ? "translateY(-2px) scale(1.03)" : "translateY(0) scale(1)",
            boxShadow: hover
              ? `0 0 34px ${PALETTE.uiAccent}aa, 0 10px 30px rgba(0,0,0,0.55)`
              : `0 0 18px ${PALETTE.uiAccent}66, 0 8px 24px rgba(0,0,0,0.5)`,
          }}
        >
          ENTER THE HORDE
        </button>

        <div style={bestWaveStyle}>
          <span style={{ opacity: 0.7 }}>BEST WAVE</span>
          <span style={bestWaveValueStyle}>{String(save.bestWave).padStart(2, "0")}</span>
        </div>
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  background: PALETTE.skyBottom,
};

const scrimStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(6,4,10,0.15) 0%, rgba(6,4,10,0.35) 55%, rgba(4,3,7,0.82) 100%)",
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
  textAlign: "center",
  marginBottom: "clamp(8px, 2vh, 20px)",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "clamp(40px, 9vw, 96px)",
  fontWeight: 700,
  letterSpacing: "clamp(4px, 1.2vw, 12px)",
  color: PALETTE.uiText,
  textShadow: `0 0 24px ${PALETTE.uiAccent}99, 0 0 60px ${PALETTE.crystalWarm}55, 0 4px 14px rgba(0,0,0,0.7)`,
  lineHeight: 1,
};

const subtitleStyle: CSSProperties = {
  marginTop: "clamp(8px, 1.6vh, 16px)",
  fontSize: "clamp(11px, 1.6vw, 15px)",
  letterSpacing: "clamp(2px, 0.6vw, 5px)",
  color: PALETTE.uiTextDim,
  textShadow: "0 2px 8px rgba(0,0,0,0.7)",
};

const buttonStyle: CSSProperties = {
  padding: "clamp(12px, 2vh, 18px) clamp(32px, 6vw, 56px)",
  fontSize: "clamp(14px, 1.8vw, 18px)",
  fontWeight: 700,
  letterSpacing: "clamp(1.5px, 0.4vw, 3px)",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: `linear-gradient(180deg, rgba(58,47,90,0.9), rgba(30,24,48,0.92))`,
  color: PALETTE.uiAccentBright,
  cursor: "pointer",
  transition: "transform 160ms ease, box-shadow 160ms ease",
};

const bestWaveStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  fontSize: "clamp(9px, 1.1vw, 11px)",
  letterSpacing: 2,
  color: PALETTE.uiTextDim,
  textShadow: "0 2px 6px rgba(0,0,0,0.6)",
};

const bestWaveValueStyle: CSSProperties = {
  fontSize: "clamp(14px, 1.8vw, 18px)",
  fontWeight: 700,
  color: PALETTE.gold,
  letterSpacing: 1,
};
