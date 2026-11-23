import type { CSSProperties, ReactNode } from "react";
import { TOWER_DEFINITIONS, TOWER_TYPES, type TowerType } from "@/config/towerStats";
import { PALETTE, TOWER_THEME } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { CoinIcon } from "./icons";

interface TowerPaletteProps {
  gold: number;
  pendingTowerType: TowerType | null;
  onSelect: (type: TowerType | null) => void;
  /** The map already holds the maximum number of towers — nothing more can be built. */
  mapFull?: boolean;
  mapFullLabel?: string;
  /** Always-mounted control shown at the end of the bar (the specials panel). */
  trailing?: ReactNode;
  /** Towers of each type already built (map + bench) and the per-type limit — a type at its limit can't be picked. */
  typeCounts?: Partial<Record<TowerType, number>>;
  typeLimit?: number;
}

export function TowerPalette({ gold, pendingTowerType, onSelect, mapFull = false, mapFullLabel, trailing, typeCounts, typeLimit }: TowerPaletteProps) {
  const { t } = useLanguage();
  return (
    <div style={containerStyle} className="tp-bar">
      <style>{TP_CSS}</style>
      {mapFull && mapFullLabel && <div style={fullStyle}>{mapFullLabel}</div>}
      {TOWER_TYPES.map((type) => {
        const def = TOWER_DEFINITIONS[type];
        const theme = TOWER_THEME[type];
        const built = typeCounts?.[type] ?? 0;
        const atLimit = typeLimit !== undefined && built >= typeLimit;
        const affordable = gold >= def.buildCost && !mapFull && !atLimit;
        const active = pendingTowerType === type;
        return (
          <button
            key={type}
            data-tutorial={`tower-${type}`}
            disabled={!affordable}
            onClick={() => onSelect(active ? null : type)}
            className="tp-card"
            title={atLimit && typeLimit !== undefined ? t("deploy.typeLimitReached", { max: typeLimit }) : t(`towers.${type}.description`)}
            style={{
              ...cardStyle,
              borderColor: active ? theme.accent : PALETTE.uiPanelBorder,
              boxShadow: active ? `0 0 14px ${theme.glow}` : "none",
              opacity: affordable ? 1 : 0.4,
            }}
          >
            <div className="tp-swatch" style={{ ...swatchStyle, background: theme.primary, boxShadow: `0 0 8px ${theme.glow}` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tp-name" style={{ fontWeight: 700, fontSize: 13, color: PALETTE.uiText }}>{t(`towers.${type}.name`)}</div>
              <div className="tp-role" style={{ fontSize: 9.5, color: PALETTE.uiTextDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(`towers.${type}.role`)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                <CoinIcon size={10} color={PALETTE.gold} />
                <span style={{ fontSize: 11, color: PALETTE.gold, fontWeight: 700 }}>{def.buildCost}</span>
                {typeLimit !== undefined && (
                  <span
                    data-testid={`tower-count-${type}`}
                    style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: atLimit ? PALETTE.uiAccentBright : PALETTE.uiTextDim }}
                  >
                    {t("deploy.typeCount", { n: built, max: typeLimit })}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
      {trailing}
    </div>
  );
}

/**
 * PHONES — the bar must leave the map room to play: in portrait the four towers
 * fit one row (name, cost and count, no role line) with the specials as a slim
 * strip under them; on a phone held sideways (short screen) everything is one
 * slim row.
 */
const TP_CSS = `
@media (max-width: 720px), (max-height: 520px) {
  .tp-bar { gap: 6px !important; padding: 6px 8px calc(6px + env(safe-area-inset-bottom)) !important; }
  .tp-card { min-width: 0 !important; max-width: none !important; padding: 6px 7px !important; gap: 6px !important; min-height: 44px; }
  .tp-role { display: none; }
  .tp-name { font-size: 12px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tp-swatch { width: 12px !important; height: 12px !important; }
}
@media (max-width: 720px) and (min-height: 521px) {
  .tp-bar { flex-wrap: wrap !important; }
  .tp-card { flex: 1 1 calc(25% - 6px) !important; }
  .tp-bar > [data-testid=specials-panel] { flex: 1 1 100% !important; width: auto !important; height: 46px !important; padding: 5px 6px 5px 10px !important; margin-left: 0 !important; }
}
@media (max-width: 380px) {
  .tp-card { padding: 6px 5px !important; gap: 4px !important; }
  .tp-name { font-size: 11px !important; letter-spacing: -0.2px; text-overflow: clip !important; }
  .tp-swatch { display: none; }
}
@media (max-height: 520px) {
  .tp-bar > [data-testid=specials-panel] > div > div:first-child > span:last-child { display: none; }
  .tp-bar { flex-wrap: nowrap !important; }
  .tp-card { flex: 1 1 0 !important; }
  .tp-bar > [data-testid=specials-panel] { flex: 0 0 auto !important; width: 220px !important; height: 44px !important; padding: 4px 6px 4px 10px !important; }
}
`;

const containerStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "10px 20px",
  background: `linear-gradient(0deg, ${PALETTE.uiPanelBg}, rgba(28,18,10,0.97))`,
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
  background: "#3a2a18",
  textAlign: "left",
  flex: "1 1 0",
  minWidth: 128,
  maxWidth: 270,
  transition: "box-shadow 120ms ease, border-color 120ms ease",
};

const swatchStyle: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "50%",
  flexShrink: 0,
};

const fullStyle: CSSProperties = {
  alignSelf: "center",
  fontSize: 12,
  fontWeight: 700,
  color: PALETTE.uiTextDim,
  padding: "0 6px",
  whiteSpace: "nowrap",
};
