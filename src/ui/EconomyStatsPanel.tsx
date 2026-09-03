import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { getGlobalEconomyStats, type LocalEconomySummary } from "@/engine/EconomyStats";

interface EconomyStatsPanelProps {
  summary: LocalEconomySummary;
}

/** Item System spec sections 18/21/33 — shows exactly what this device can honestly know, and states plainly that anything cross-player is unavailable rather than inventing a number. */
export function EconomyStatsPanel({ summary }: EconomyStatsPanelProps) {
  const { t } = useLanguage();
  const global = getGlobalEconomyStats();

  return (
    <div>
      <div style={sectionTitleStyle}>{t("economy.localTitle")}</div>
      <div style={rowsStyle}>
        <StatRow label={t("economy.bossesDefeated")} value={summary.bossesDefeatedTotal} />
        <StatRow label={t("economy.miniBossesDefeated")} value={summary.miniBossesDefeatedTotal} />
        <StatRow label={t("economy.itemsOwned")} value={summary.itemsOwnedTotal} />
      </div>

      <div style={{ ...sectionTitleStyle, marginTop: 18 }}>{t("economy.globalTitle")}</div>
      {global.available ? (
        <div style={rowsStyle}>
          <StatRow label={t("trade.title")} value={global.itemsTraded} />
        </div>
      ) : (
        <div style={unavailableStyle}>{t("economy.globalUnavailable")}</div>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value.toLocaleString()}</span>
    </div>
  );
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: PALETTE.uiAccent,
  marginBottom: 8,
};

const rowsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 10px",
  borderRadius: 6,
  background: "rgba(0,0,0,0.25)",
  border: `1px solid ${PALETTE.uiPanelBorder}`,
};

const labelStyle: CSSProperties = { fontSize: 12, color: PALETTE.uiText };
const valueStyle: CSSProperties = { fontSize: 13, fontWeight: 700, color: PALETTE.gold };

const unavailableStyle: CSSProperties = {
  fontSize: 12,
  fontStyle: "italic",
  color: PALETTE.uiTextDim,
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
};
