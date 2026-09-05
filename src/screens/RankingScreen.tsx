import { useMemo, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { loadSave } from "@/engine/SaveSystem";
import { getAscensionStatus } from "@/engine/AscensionManager";
import { getPrestigeTier, getPrestigeUpgradeCost } from "@/config/prestige";
import type { TranslationKey } from "@/i18n/translate";
import { TopNav, type NavView } from "@/ui/TopNav";
import { TrophyIcon, ShieldIcon } from "@/ui/icons";

interface RankingScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

/**
 * PRODUÇÃO VISUAL spec point 8/29 — Ranking is now a first-class top-nav
 * destination (previously only glimpsed as a small block on the Season
 * screen). HONESTY NOTE (same contract AscensionManager.ts's own doc
 * comment documents for the Season screen): HORDENOVA has no backend yet,
 * so there is no real opponent pool. This screen NEVER fabricates other
 * players, fake names, or fake positions — every number here is the
 * player's own real save data. Where a real ranking position/next-player
 * comparison would go, it shows an explicit "not available without a
 * server" state instead, ready to be replaced by real data once a backend
 * exists (see config/ascension.ts's SeasonLeaderboard/SeasonEntry
 * interfaces, already shaped for that swap).
 */
export function RankingScreen({ onNavigate, onPlay }: RankingScreenProps) {
  const { t } = useLanguage();
  const save = useMemo(() => loadSave(), []);
  const status = useMemo(() => getAscensionStatus(), []);
  const prestigeTier = getPrestigeTier(save.prestigeLevel);
  const prestigeNextCost = getPrestigeUpgradeCost(save.prestigeLevel);
  const prestigeTierLabel =
    t(`prestige.tiers.${prestigeTier.nameKey}` as TranslationKey) + (prestigeTier.cycle > 0 ? ` ${prestigeTier.cycle + 1}` : "");

  return (
    <div style={rootStyle}>
      <TopNav active="RANKING" onNavigate={onNavigate} onPlay={onPlay} />
      <div style={bodyStyle}>
        <div style={headerStyle}>
          <TrophyIcon size={30} color={PALETTE.gold} />
          <h1 style={titleStyle}>{t("ranking.title")}</h1>
          <p style={subtitleStyle}>{t("ranking.subtitle")}</p>
        </div>

        <div style={scoreCardStyle}>
          <div style={scoreLabelStyle}>{t("ranking.yourSeasonScore")}</div>
          <div style={scoreValueStyle}>{status.seasonBestWave}</div>
          <div style={scoreBasisStyle}>{t("ranking.scoreBasis")}</div>
        </div>

        <div style={positionCardStyle}>
          <div style={positionRowStyle}>
            <span style={positionLabelStyle}>{t("ranking.yourPosition")}</span>
            <span style={positionValueUnavailableStyle}>{t("ranking.noBackendYet")}</span>
          </div>
          <p style={honestNoteStyle}>{t("ranking.honestNote")}</p>
        </div>

        <div style={prestigeCardStyle}>
          <div style={prestigeHeaderStyle}>
            <ShieldIcon size={18} color={prestigeTier.color} />
            <span style={{ ...prestigeTierLabelStyle, color: prestigeTier.color }}>{prestigeTierLabel}</span>
          </div>
          <div style={prestigeLevelStyle}>{t("prestige.level", { level: save.prestigeLevel })}</div>
          <p style={prestigeHintStyle}>{t("ranking.prestigeHint", { cost: prestigeNextCost })}</p>
        </div>

        <div style={recordsRowStyle}>
          <Record label={t("ascension.records.seasonsWon")} value={save.ascensionSeasonsWon} />
          <Record label={t("ascension.records.top3")} value={save.ascensionTop3} />
          <Record label={t("ascension.records.top5")} value={save.ascensionTop5} />
        </div>

        <div style={tierLegendStyle}>
          <div style={tierLegendTitleStyle}>{t("ranking.tiersTitle")}</div>
          <div style={tierLegendRowStyle}>
            <TierChip label="#1" />
            <TierChip label="#2-3" />
            <TierChip label="#4-5" />
            <TierChip label="#6-10" />
            <TierChip label="#11-25" />
            <TierChip label="#26-50" />
          </div>
          <p style={tierLegendNoteStyle}>{t("ranking.tiersNote")}</p>
        </div>
      </div>
    </div>
  );
}

function Record({ label, value }: { label: string; value: number }) {
  return (
    <div style={recordStyle}>
      <div style={recordValueStyle}>{value}</div>
      <div style={recordLabelStyle}>{label}</div>
    </div>
  );
}

function TierChip({ label }: { label: string }) {
  return <span style={tierChipStyle}>{label}</span>;
}

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: `linear-gradient(180deg, #241a10, #150f09)`,
  color: PALETTE.uiText,
  overflow: "hidden",
};

const bodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "24px 32px 60px",
  maxWidth: 640,
  margin: "0 auto",
  width: "100%",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 20,
};

const headerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  textAlign: "center",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 26,
  fontWeight: 800,
  color: PALETTE.uiAccentBright,
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontSize: 12,
  color: PALETTE.uiTextDim,
  margin: 0,
  maxWidth: 420,
  lineHeight: 1.5,
};

const scoreCardStyle: CSSProperties = {
  width: "100%",
  textAlign: "center",
  padding: "18px 24px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.gold}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.94), rgba(30,20,12,0.96))",
  boxShadow: `0 0 24px ${PALETTE.gold}22`,
};

const scoreLabelStyle: CSSProperties = {
  fontSize: 10.5,
  letterSpacing: 1.4,
  fontWeight: 800,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const scoreValueStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 42,
  fontWeight: 800,
  color: PALETTE.gold,
  lineHeight: 1.3,
};

const scoreBasisStyle: CSSProperties = {
  fontSize: 10,
  color: PALETTE.uiTextDim,
};

const positionCardStyle: CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(30,20,12,0.6)",
  boxSizing: "border-box",
};

const positionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const positionLabelStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
};

const positionValueUnavailableStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
};

const honestNoteStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
  marginTop: 8,
  marginBottom: 0,
};

const prestigeCardStyle: CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(30,20,12,0.6)",
  boxSizing: "border-box",
};

const prestigeHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const prestigeTierLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const prestigeLevelStyle: CSSProperties = {
  fontSize: 11,
  color: PALETTE.uiTextDim,
  marginTop: 4,
};

const prestigeHintStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
  marginTop: 8,
  marginBottom: 0,
};

const recordsRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-around",
  width: "100%",
  paddingTop: 12,
  borderTop: `1px solid ${PALETTE.uiPanelBorder}`,
};

const recordStyle: CSSProperties = {
  textAlign: "center",
};

const recordValueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: PALETTE.gold,
};

const recordLabelStyle: CSSProperties = {
  fontSize: 9.5,
  color: PALETTE.uiTextDim,
  marginTop: 2,
};

const tierLegendStyle: CSSProperties = {
  width: "100%",
  textAlign: "center",
};

const tierLegendTitleStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
  marginBottom: 8,
};

const tierLegendRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 8,
};

const tierChipStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 999,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  color: PALETTE.uiTextDim,
};

const tierLegendNoteStyle: CSSProperties = {
  fontSize: 10,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
  marginTop: 10,
};
