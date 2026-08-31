import type { CSSProperties } from "react";
import type { HudSnapshot } from "@/engine/GameEngine";

interface DefeatOverlayProps {
  hud: HudSnapshot;
  onTryAgain: () => void;
  onExitToMenu: () => void;
}

export function DefeatOverlay({ hud, onTryAgain, onExitToMenu }: DefeatOverlayProps) {
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 2 }}>FORTRESS FALLEN</h1>
        <div style={{ display: "flex", gap: 24, margin: "16px 0" }}>
          <Stat label="Wave Reached" value={String(hud.wave)} />
          <Stat label="Enemies Defeated" value={String(hud.enemiesDefeated)} />
          <Stat label="Best Wave" value={String(hud.bestWave)} />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#a89bc2" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(10,8,14,0.85)",
};

const cardStyle: CSSProperties = {
  padding: 32,
  borderRadius: 12,
  border: "1px solid #4a3f5f",
  background: "#1a1522",
  color: "#f2e9ff",
  textAlign: "center",
};

const primaryButtonStyle: CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "1px solid #c9a8ff",
  background: "#3a2f5a",
  color: "#f2e9ff",
  fontWeight: 700,
  fontSize: 14,
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "1px solid #4a3f5f",
  background: "transparent",
  color: "#a89bc2",
  fontWeight: 700,
  fontSize: 14,
};
