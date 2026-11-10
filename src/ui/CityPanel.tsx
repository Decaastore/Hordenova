import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { CITY_BUILDINGS, CITY_REBUILD_WAVES, type CityBuildingId } from "@/config/city";
import { CoinIcon } from "./icons";

interface CityPanelProps {
  seasonBestWave: number;
  burning: Readonly<Partial<Record<CityBuildingId, number>>>;
  goldShare: number;
  onClose: () => void;
}

/** O CASTELO VIRA CIDADE — every building, whether it stands, burns or is still to come, and what the city pays. The game keeps running behind it. */
export function CityPanel({ seasonBestWave, burning, goldShare, onClose }: CityPanelProps) {
  const { t } = useLanguage();
  return (
    <div style={panelStyle} role="dialog" aria-label={t("city.title")} data-testid="city-panel">
      <button onClick={onClose} style={closeStyle} aria-label={t("city.close")}>
        ×
      </button>
      <div style={titleStyle}>{t("city.title")}</div>
      <div style={subStyle}>{t("city.lead")}</div>
      <div style={incomeStyle}>
        <CoinIcon size={12} color={PALETTE.gold} />
        {t("city.income", { pct: Math.round(goldShare * 100) })}
      </div>
      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
        {CITY_BUILDINGS.map((b) => {
          const built = seasonBestWave >= b.unlockWave;
          const fire = burning[b.id] ?? 0;
          const status = !built
            ? t("city.locked", { wave: b.unlockWave })
            : fire > 0
              ? t("city.burning", { n: fire })
              : t("city.standing");
          const statusColor = !built ? PALETTE.uiTextDim : fire > 0 ? PALETTE.danger : PALETTE.success;
          return (
            <div key={b.id} style={{ ...rowStyle, opacity: built ? 1 : 0.55 }} data-testid={`city-row-${b.id}`}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: PALETTE.uiText }}>{t(`city.buildings.${b.id}` as TranslationKey)}</div>
                <div style={{ fontSize: 10.5, color: statusColor, lineHeight: 1.3 }}>{status}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: built && fire === 0 ? PALETTE.gold : PALETTE.uiTextDim, whiteSpace: "nowrap" }}>
                {t("city.bonus", { pct: Math.round(b.goldShare * 100) })}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ ...subStyle, marginTop: 10, lineHeight: 1.45 }}>{t("city.fireRule", { n: CITY_REBUILD_WAVES })}</div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 290,
  maxWidth: "calc(100% - 24px)",
  maxHeight: "calc(100% - 24px)",
  overflowY: "auto",
  padding: "16px 16px 14px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.98), rgba(30,20,12,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
  zIndex: 30,
};

const closeStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 10,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 18,
  cursor: "pointer",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: 1,
  color: PALETTE.uiAccentBright,
};

const subStyle: CSSProperties = { fontSize: 11, color: PALETTE.uiTextDim, marginTop: 4, lineHeight: 1.4 };

const incomeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 10,
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(255,210,87,0.1)",
  border: `1px solid ${PALETTE.uiAccent}55`,
  fontSize: 12,
  fontWeight: 700,
  color: PALETTE.uiAccentBright,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.22)",
};
