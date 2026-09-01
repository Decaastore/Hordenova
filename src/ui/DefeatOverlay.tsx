import type { CSSProperties } from "react";
import type { HudSnapshot } from "@/engine/GameEngine";
import { PALETTE } from "@/rendering/theme";
import { SkullIcon } from "./icons";

interface DefeatOverlayProps {
  hud: HudSnapshot;
  onTryAgain: () => void;
  onExitToMenu: () => void;
}

export function DefeatOverlay({ hud, onTryAgain, onExitToMenu }: DefeatOverlayProps) {
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <SkullIcon size={34} color={PALETTE.danger} style={{ filter: `drop-shadow(0 0 10px ${PALETTE.danger}aa)` }} />
        <h1 style={titleStyle}>FORTRESS FALLEN</h1>
        <div style={dividerStyle} />
        <div style={{ display: "flex", gap: 28, margin: "18px 0" }}>
          <Stat label="Wave Reached" value={String(hud.wave)} />
          <Stat label="Enemies Defeated" value={String(hud.enemiesDefeated)} />
          <Stat label="Best Wave" value={String(hud.bestWave)} highlight />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onTryAgain} style={primaryButtonStyle}>
            TRY AGAIN
          </button>
          <button onClick={onExitToMenu} style={secondaryButtonStyle}>
            MAIN MENU
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
      <div style={{ fontSize: 22, fontWeight: 700, color: highlight ? PALETTE.gold : PALETTE.uiText }}>{value}</div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "radial-gradient(circle at 50% 40%, rgba(90,30,20,0.4), rgba(28,18,10,0.9) 70%)",
  zIndex: 3,
};

const cardStyle: CSSProperties = {
  padding: "30px 40px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: `linear-gradient(160deg, rgba(54,36,22,0.97), rgba(30,20,12,0.98))`,
  boxShadow: "0 0 60px rgba(226,87,74,0.15), 0 20px 50px rgba(0,0,0,0.6)",
  color: PALETTE.uiText,
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const titleStyle: CSSProperties = {
  margin: "10px 0 0",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 30,
  letterSpacing: 3,
  color: PALETTE.uiText,
  textShadow: `0 0 18px ${PALETTE.danger}77`,
};

const dividerStyle: CSSProperties = {
  width: 60,
  height: 2,
  background: PALETTE.danger,
  opacity: 0.5,
  margin: "12px auto 0",
};

const primaryButtonStyle: CSSProperties = {
  padding: "11px 26px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.18)",
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 1,
  boxShadow: `0 0 16px ${PALETTE.uiAccent}55`,
};

const secondaryButtonStyle: CSSProperties = {
  padding: "11px 26px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "transparent",
  color: PALETTE.uiTextDim,
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 1,
};
