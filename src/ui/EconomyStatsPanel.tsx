import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getGlobalEconomyStats, type LocalEconomySummary } from "@/engine/EconomyStats";
import { getPrestigeTier, getPrestigeUpgradeCost } from "@/config/prestige";
import { GemIcon } from "./icons";

interface EconomyStatsPanelProps {
  summary: LocalEconomySummary;
  /** Master Implementation Pass spec section 7-8 — Profile Prestige. */
  gems: number;
  prestigeLevel: number;
  onUpgradePrestige: () => void;
}

/** Item System spec sections 18/21/33 — shows exactly what this device can honestly know, and states plainly that anything cross-player is unavailable rather than inventing a number. */
export function EconomyStatsPanel({ summary, gems, prestigeLevel, onUpgradePrestige }: EconomyStatsPanelProps) {
  const { t } = useLanguage();
  const global = getGlobalEconomyStats();
  const tier = getPrestigeTier(prestigeLevel);
  const nextCost = getPrestigeUpgradeCost(prestigeLevel);
  const affordable = gems >= nextCost;
  const tierLabel = t(`prestige.tiers.${tier.nameKey}` as TranslationKey) + (tier.cycle > 0 ? ` ${tier.cycle + 1}` : "");

  return (
    <div>
      <div style={sectionTitleStyle}>{t("economy.localTitle")}</div>
      <div style={rowsStyle}>
        <StatRow label={t("economy.bossesDefeated")} value={summary.bossesDefeatedTotal} />
        <StatRow label={t("economy.miniBossesDefeated")} value={summary.miniBossesDefeatedTotal} />
        <StatRow label={t("economy.itemsOwned")} value={summary.itemsOwnedTotal} />
      </div>

      <div style={{ ...sectionTitleStyle, marginTop: 18 }}>{t("prestige.title")}</div>
      <div style={prestigeCardStyle}>
        <div style={{ fontSize: 15, fontWeight: 800, color: tier.color }}>{tierLabel}</div>
        <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, marginTop: 2 }}>{t("prestige.level", { level: prestigeLevel })}</div>
        <button onClick={onUpgradePrestige} disabled={!affordable} style={{ ...prestigeButtonStyle, opacity: affordable ? 1 : 0.5 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {t("prestige.upgrade")}
            <span style={{ opacity: 0.6 }}>·</span>
            <GemIcon size={11} color={PALETTE.gem} /> {nextCost}
          </span>
        </button>
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

const prestigeCardStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "rgba(0,0,0,0.25)",
  border: `1px solid ${PALETTE.uiPanelBorder}`,
};

const prestigeButtonStyle: CSSProperties = {
  marginTop: 8,
  padding: "7px 10px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.gem}`,
  background: "rgba(200,138,255,0.1)",
  color: PALETTE.uiText,
  fontWeight: 700,
  fontSize: 11.5,
};

const unavailableStyle: CSSProperties = {
  fontSize: 12,
  fontStyle: "italic",
  color: PALETTE.uiTextDim,
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
};
