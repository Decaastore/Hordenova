import type { CSSProperties } from "react";
import type { TowerInstance } from "@/entities/Tower";
import { getTowerStats, getTowerUpgradeCost } from "@/entities/Tower";
import { MAX_TOWER_LEVEL, TOWER_DEFINITIONS } from "@/config/towerStats";

interface TowerInfoPanelProps {
  tower: TowerInstance;
  gold: number;
  onUpgrade: () => void;
  onClose: () => void;
}

export function TowerInfoPanel({ tower, gold, onUpgrade, onClose }: TowerInfoPanelProps) {
  const def = TOWER_DEFINITIONS[tower.type];
  const stats = getTowerStats(tower);
  const upgradeCost = getTowerUpgradeCost(tower);
  const canAfford = upgradeCost !== null && gold >= upgradeCost;

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>{def.name}</strong>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#a89bc2" }}>
        Level {stats.level} / {MAX_TOWER_LEVEL}
      </div>
      <Row label="Damage" value={stats.damage.toFixed(1)} />
      <Row label="Attack Speed" value={`${stats.attackSpeed.toFixed(2)}/s`} />
      <Row label="Range" value={stats.range.toFixed(0)} />
      <Row label="Special" value={def.role} />
      <button
        onClick={onUpgrade}
        disabled={upgradeCost === null || !canAfford}
        style={upgradeButtonStyle}
      >
        {upgradeCost === null ? "MAX LEVEL" : `Upgrade — ${upgradeCost}g`}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: "#a89bc2" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 70,
  right: 16,
  width: 200,
  padding: 12,
  borderRadius: 8,
  border: "1px solid #4a3f5f",
  background: "rgba(20,16,28,0.95)",
  color: "#f2e9ff",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const closeButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#a89bc2",
  fontSize: 16,
  lineHeight: 1,
};

const upgradeButtonStyle: CSSProperties = {
  marginTop: 6,
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #c9a8ff",
  background: "#3a2f5a",
  color: "#f2e9ff",
  fontWeight: 700,
};
