import type { CSSProperties } from "react";
import { TOWER_DEFINITIONS, TOWER_TYPES, type TowerType } from "@/config/towerStats";

interface TowerPaletteProps {
  gold: number;
  pendingTowerType: TowerType | null;
  onSelect: (type: TowerType | null) => void;
}

export function TowerPalette({ gold, pendingTowerType, onSelect }: TowerPaletteProps) {
  return (
    <div style={containerStyle}>
      {TOWER_TYPES.map((type) => {
        const def = TOWER_DEFINITIONS[type];
        const affordable = gold >= def.buildCost;
        const active = pendingTowerType === type;
        return (
          <button
            key={type}
            disabled={!affordable}
            onClick={() => onSelect(active ? null : type)}
            title={def.description}
            style={{
              ...cardStyle,
              borderColor: active ? "#c9a8ff" : "#4a3f5f",
              opacity: affordable ? 1 : 0.45,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>{def.name}</div>
            <div style={{ fontSize: 10, color: "#a89bc2" }}>{def.role}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{def.buildCost}g</div>
          </button>
        );
      })}
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "10px 20px",
  background: "rgba(15,12,22,0.9)",
  borderTop: "1px solid #3a2f4a",
  flexWrap: "wrap",
};

const cardStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #4a3f5f",
  background: "#1e1829",
  color: "#f2e9ff",
  textAlign: "left",
  minWidth: 110,
};
