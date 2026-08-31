import type { CSSProperties } from "react";
import { TOWER_DEFINITIONS, TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { PALETTE, TOWER_THEME } from "@/rendering/theme";
import { CoinIcon } from "./icons";

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
        const theme = TOWER_THEME[type];
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
              borderColor: active ? theme.accent : PALETTE.uiPanelBorder,
              boxShadow: active ? `0 0 14px ${theme.glow}` : "none",
              opacity: affordable ? 1 : 0.4,
            }}
          >
            <div style={{ ...swatchStyle, background: theme.primary, boxShadow: `0 0 8px ${theme.glow}` }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: PALETTE.uiText }}>{def.name}</div>
              <div style={{ fontSize: 9.5, color: PALETTE.uiTextDim }}>{def.role}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                <CoinIcon size={10} color={PALETTE.gold} />
                <span style={{ fontSize: 11, color: PALETTE.gold, fontWeight: 700 }}>{def.buildCost}</span>
              </div>
            </div>
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
  background: `linear-gradient(0deg, ${PALETTE.uiPanelBg}, rgba(10,8,16,0.97))`,
  borderTop: `1px solid ${PALETTE.uiPanelBorder}`,
  boxShadow: "0 -2px 14px rgba(0,0,0,0.5)",
  flexWrap: "wrap",
  position: "relative",
  zIndex: 2,
};

const cardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid",
  background: "#16111f",
  textAlign: "left",
  minWidth: 128,
  transition: "box-shadow 120ms ease, border-color 120ms ease",
};

const swatchStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "50%",
  flexShrink: 0,
};
