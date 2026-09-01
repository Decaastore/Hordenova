import type { CSSProperties } from "react";
import type { TowerInstance } from "@/entities/Tower";
import { getTowerStats, getTowerUpgradeCost } from "@/entities/Tower";
import { MAX_TOWER_LEVEL, TOWER_DEFINITIONS } from "@/config/towerStats";
import { PALETTE, TOWER_THEME } from "@/rendering/theme";
import { CoinIcon } from "./icons";

interface TowerInfoPanelProps {
  tower: TowerInstance;
  gold: number;
  onUpgrade: () => void;
  onClose: () => void;
}

export function TowerInfoPanel({ tower, gold, onUpgrade, onClose }: TowerInfoPanelProps) {
  const def = TOWER_DEFINITIONS[tower.type];
  const theme = TOWER_THEME[tower.type];
  const stats = getTowerStats(tower);
  const upgradeCost = getTowerUpgradeCost(tower);
  const canAfford = upgradeCost !== null && gold >= upgradeCost;

  return (
    <div style={{ ...panelStyle, borderColor: theme.primary, boxShadow: `0 0 22px ${theme.glow}, 0 8px 24px rgba(0,0,0,0.5)` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...dotStyle, background: theme.primary, boxShadow: `0 0 8px ${theme.glow}` }} />
          <strong style={{ fontSize: 14, color: PALETTE.uiText, letterSpacing: 0.5 }}>{def.name}</strong>
        </div>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>
      </div>
      <div style={{ fontSize: 11, color: PALETTE.uiTextDim }}>
        Level {stats.level} / {MAX_TOWER_LEVEL}
      </div>
      <div style={dividerStyle} />
      <Row label="Damage" value={stats.damage.toFixed(1)} />
      <Row label="Attack Speed" value={`${stats.attackSpeed.toFixed(2)}/s`} />
      <Row label="Range" value={stats.range.toFixed(0)} />
      <Row label="Special" value={def.role} />
      <button
        onClick={onUpgrade}
        disabled={upgradeCost === null || !canAfford}
        style={{
          ...upgradeButtonStyle,
          borderColor: theme.primary,
          opacity: upgradeCost === null || !canAfford ? 0.5 : 1,
        }}
      >
        {upgradeCost === null ? (
          "MAX LEVEL"
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            UPGRADE <CoinIcon size={11} color={PALETTE.gold} /> {upgradeCost}
          </span>
        )}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: PALETTE.uiTextDim }}>{label}</span>
      <span style={{ color: PALETTE.uiText, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 208,
  padding: 14,
  borderRadius: 10,
  border: "1px solid",
  background: `linear-gradient(160deg, rgba(52,37,22,0.97), rgba(30,20,10,0.97))`,
  color: PALETTE.uiText,
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const dotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: PALETTE.uiPanelBorder,
  margin: "2px 0",
};

const closeButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
};

const upgradeButtonStyle: CSSProperties = {
  marginTop: 4,
  padding: "7px 10px",
  borderRadius: 7,
  border: "1px solid",
  background: "rgba(255,255,255,0.04)",
  color: PALETTE.uiText,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: 0.5,
};
