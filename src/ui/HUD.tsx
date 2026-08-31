import type { CSSProperties, ReactNode } from "react";
import { GAME_SPEEDS, type GameSpeed } from "@/config/gameBalance";
import type { HudSnapshot } from "@/engine/GameEngine";
import { PALETTE } from "@/rendering/theme";
import { BoltIcon, CoinIcon, ShieldIcon, WaveIcon } from "./icons";

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
  const hpRatio = hud.baseHp / hud.maxBaseHp;
  const hpColor = hpRatio > 0.5 ? PALETTE.success : hpRatio > 0.2 ? PALETTE.gold : PALETTE.danger;

  return (
    <div style={barStyle}>
      <div style={brandStyle}>HORDENOVA</div>

      <div style={groupStyle}>
        <Stat icon={<WaveIcon color={PALETTE.uiAccent} />} label="WAVE" value={String(hud.wave)} />
        <Stat
          icon={<ShieldIcon color={hpColor} />}
          label="BASE HP"
          value={`${Math.ceil(hud.baseHp)} / ${hud.maxBaseHp}`}
          valueColor={hpColor}
        />
        <Stat icon={<CoinIcon color={PALETTE.gold} />} label="GOLD" value={String(hud.gold)} valueColor={PALETTE.gold} />
        <div style={{ textAlign: "center", minWidth: 100 }}>
          <div style={labelStyle}>STATE</div>
          <div style={{ ...valueStyle, fontSize: 13 }}>{PHASE_LABEL[hud.phase]}</div>
        </div>
      </div>

      <div style={groupStyle}>
        <BoltIcon color={PALETTE.uiTextDim} size={13} />
        {GAME_SPEEDS.map((speed) => {
          const active = hud.speed === speed;
          return (
            <button
              key={speed}
              onClick={() => onSetSpeed(speed)}
              style={{
                ...speedButtonStyle,
                borderColor: active ? PALETTE.uiAccent : PALETTE.uiPanelBorder,
                color: active ? PALETTE.uiAccentBright : PALETTE.uiTextDim,
                background: active ? "rgba(201,168,255,0.15)" : "#17121f",
                boxShadow: active ? `0 0 10px ${PALETTE.uiAccent}66` : "none",
              }}
            >
              {speed}x
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 92 }}>
      <span style={{ opacity: 0.85, display: "flex" }}>{icon}</span>
      <div>
        <div style={labelStyle}>{label}</div>
        <div style={{ ...valueStyle, color: valueColor ?? valueStyle.color }}>{value}</div>
      </div>
    </div>
  );
}

const barStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "9px 22px",
  background: `linear-gradient(180deg, ${PALETTE.uiPanelBg}, rgba(10,8,16,0.97))`,
  borderBottom: `1px solid ${PALETTE.uiPanelBorder}`,
  boxShadow: "0 2px 14px rgba(0,0,0,0.5)",
  gap: 18,
  flexWrap: "wrap",
  position: "relative",
  zIndex: 2,
};

const brandStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 3,
  color: PALETTE.uiAccentBright,
  textShadow: `0 0 12px ${PALETTE.uiAccent}88`,
  whiteSpace: "nowrap",
};

const groupStyle: CSSProperties = {
  display: "flex",
  gap: 20,
  alignItems: "center",
  flexWrap: "wrap",
  rowGap: 6,
};

const labelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.4,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const valueStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: PALETTE.uiText,
  lineHeight: 1.3,
};

const speedButtonStyle: CSSProperties = {
  padding: "5px 11px",
  borderRadius: 6,
  border: "1px solid",
  fontWeight: 700,
  fontSize: 12,
  transition: "background 120ms ease, box-shadow 120ms ease",
};
