import type { CSSProperties } from "react";
import { GAME_SPEEDS, type GameSpeed } from "@/config/gameBalance";
import type { HudSnapshot } from "@/engine/GameEngine";

interface HUDProps {
  hud: HudSnapshot;
  onSetSpeed: (speed: GameSpeed) => void;
}

const PHASE_LABEL: Record<HudSnapshot["phase"], string> = {
  PRE_RUN: "PRE-RUN",
  RUNNING: "RUNNING",
  WAVE_TRANSITION: "WAVE CLEARED",
  DEFEAT: "FORTRESS FALLEN",
};

export function HUD({ hud, onSetSpeed }: HUDProps) {
  return (
    <div style={barStyle}>
      <div style={groupStyle}>
        <Stat label="WAVE" value={String(hud.wave)} />
        <Stat label="BASE HP" value={`${Math.ceil(hud.baseHp)} / ${hud.maxBaseHp}`} />
        <Stat label="GOLD" value={String(hud.gold)} />
        <Stat label="STATE" value={PHASE_LABEL[hud.phase]} />
      </div>
      <div style={groupStyle}>
        {GAME_SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => onSetSpeed(speed)}
            style={{
              ...speedButtonStyle,
              borderColor: hud.speed === speed ? "#c9a8ff" : "#4a3f5f",
              color: hud.speed === speed ? "#f2e9ff" : "#a89bc2",
            }}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 88 }}>
      <div style={{ fontSize: 10, letterSpacing: 1, color: "#a89bc2" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#f2e9ff" }}>{value}</div>
    </div>
  );
}

const barStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 20px",
  background: "rgba(15,12,22,0.9)",
  borderBottom: "1px solid #3a2f4a",
  gap: 16,
  flexWrap: "wrap",
};

const groupStyle: CSSProperties = {
  display: "flex",
  gap: 20,
  alignItems: "center",
};

const speedButtonStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid #4a3f5f",
  background: "#1e1829",
  fontWeight: 700,
  fontSize: 13,
};
