import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { loadSave } from "@/engine/SaveSystem";
import { getAscensionStatus, syncSeasonIfNeeded } from "@/engine/AscensionManager";
import { SEASON_DURATION_MS } from "@/engine/SeasonClock";
import { getPhaseForWave } from "@/config/phaseConfig";
import { getPrestigeTier, getPrestigeUpgradeCost } from "@/config/prestige";
import { formatDurationShort } from "@/utils/formatDuration";
import { TopNav, type NavView } from "@/ui/TopNav";
import { AscensionPanel } from "@/ui/AscensionPanel";
import { TrophyIcon, ShieldIcon, SkullIcon } from "@/ui/icons";

interface SeasonScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

/**
 * PRODUÇÃO VISUAL spec sections 6-9 — the Season Overview is the required
 * pre-game hub (HOME -> JOGAR -> SEASON ATUAL -> INICIAR/CONTINUAR RUN ->
 * GAMEPLAY): it must answer "what's happening now and what do I need to do
 * to compete", not just show a name and a Play button. Everything shown
 * here reads the same permanent save as the game itself — ranking honesty
 * follows the same documented stance as RankingScreen.tsx: no backend yet,
 * so no fabricated other-player position/Score/distance.
 */
export function SeasonScreen({ onNavigate, onPlay }: SeasonScreenProps) {
  const { t } = useLanguage();
  const [panelOpen, setPanelOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    syncSeasonIfNeeded();
    setRefreshTick((n) => n + 1);
  }, []);

  const save = useMemo(() => loadSave(), [refreshTick]);
  const status = useMemo(() => getAscensionStatus(), [refreshTick]);
  const seasonProgress = Math.min(1, Math.max(0, 1 - status.timeRemainingMs / SEASON_DURATION_MS));
  const bestPhase = getPhaseForWave(Math.max(1, status.seasonBestWave));
  const prestigeTier = getPrestigeTier(save.prestigeLevel);
  const prestigeNextCost = getPrestigeUpgradeCost(save.prestigeLevel);
  const prestigeTierLabel =
    t(`prestige.tiers.${prestigeTier.nameKey}` as TranslationKey) + (prestigeTier.cycle > 0 ? ` ${prestigeTier.cycle + 1}` : "");

  return (
    <div style={rootStyle}>
      <TopNav active="SEASON" onNavigate={onNavigate} onPlay={onPlay} />
      <div style={bodyStyle}>
        <div style={heroStyle}>
          <div style={seasonLabelStyle}>{t("season.title", { number: status.seasonNumber })}</div>
          <div style={themeNameStyle}>{t(`ascension.seasonThemes.${status.themeNameKey}` as TranslationKey)}</div>
          <div style={timerStyle}>{t("season.endsIn", { time: formatDurationShort(status.timeRemainingMs) })}</div>
          <div style={progressTrackStyle}>
            <div style={{ ...progressFillStyle, width: `${(seasonProgress * 100).toFixed(1)}%` }} />
          </div>
        </div>

        <div style={statGridStyle}>
          <StatCard
            icon={<TrophyIcon size={18} color={PALETTE.gold} />}
            label={t("season.seasonScore")}
            value={String(status.seasonBestWave)}
            hint={!status.hasParticipated ? t("season.notYetParticipating") : undefined}
          />
          <StatCard
            icon={<SkullIcon size={18} color={PALETTE.danger} />}
            label={t("season.bossesDefeated")}
            value={String(save.bossesDefeatedTotal)}
          />
          <StatCard
            icon={<ShieldIcon size={18} color={PALETTE.uiAccentBright} />}
            label={t("season.bestPhase")}
            value={t(`phases.${bestPhase.i18nKey}.name` as TranslationKey)}
          />
        </div>

        <button onClick={() => onNavigate("RANKING")} style={positionCardStyle}>
          <div style={positionRowStyle}>
            <span style={positionLabelStyle}>{t("season.yourPosition")}</span>
            <span style={positionValueStyle}>{t("ranking.noBackendYet")}</span>
          </div>
          <span style={positionLinkStyle}>{t("season.viewRanking")} →</span>
        </button>

        <div style={prestigeCardStyle}>
          <div style={prestigeHeaderStyle}>
            <ShieldIcon size={18} color={prestigeTier.color} />
            <span style={{ ...prestigeTierLabelStyle, color: prestigeTier.color }}>{prestigeTierLabel}</span>
            <span style={prestigeLevelBadgeStyle}>{t("prestige.level", { level: save.prestigeLevel })}</span>
          </div>
          <p style={prestigeHintStyle}>{t("ranking.prestigeHint", { cost: prestigeNextCost })}</p>
        </div>

        <button onClick={onPlay} style={playButtonStyle}>
          {t("nav.play")}
        </button>
        <button style={collectionLinkStyle} onClick={() => setPanelOpen(true)}>
          {t("season.viewCollection")}
        </button>

        <div style={recordsRowStyle}>
          <Record label={t("ascension.records.seasonsWon")} value={save.ascensionSeasonsWon} />
          <Record label={t("ascension.records.top3")} value={save.ascensionTop3} />
          <Record label={t("ascension.records.top5")} value={save.ascensionTop5} />
        </div>

        <p style={honestNoteStyle}>{t("ascension.topFive.honestNote")}</p>
      </div>

      {panelOpen && <AscensionPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statCardHeaderStyle}>
        {icon}
        <span style={statCardLabelStyle}>{label}</span>
      </div>
      <div style={statCardValueStyle}>{value}</div>
      {hint && <div style={statCardHintStyle}>{hint}</div>}
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
  gap: 18,
};

const heroStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  textAlign: "center",
  width: "100%",
};

const seasonLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 2,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const themeNameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 26,
  fontWeight: 700,
  color: PALETTE.gem,
};

const timerStyle: CSSProperties = {
  fontSize: 12,
  color: PALETTE.uiTextDim,
};

const progressTrackStyle: CSSProperties = {
  width: "min(320px, 80%)",
  height: 6,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
  marginTop: 4,
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  background: `linear-gradient(90deg, ${PALETTE.gem}, ${PALETTE.gold})`,
  transition: "width 300ms ease",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  width: "100%",
};

const statCardStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(30,20,12,0.6)",
  boxSizing: "border-box",
};

const statCardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginBottom: 6,
};

const statCardLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
};

const statCardValueStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 20,
  fontWeight: 800,
  color: PALETTE.uiAccentBright,
};

const statCardHintStyle: CSSProperties = {
  fontSize: 9,
  color: PALETTE.uiTextDim,
  marginTop: 2,
};

const positionCardStyle: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(30,20,12,0.6)",
  boxSizing: "border-box",
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const positionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const positionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: PALETTE.uiTextDim,
};

const positionValueStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: PALETTE.uiTextDim,
  fontStyle: "italic",
};

const positionLinkStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: PALETTE.gold,
  letterSpacing: 0.6,
};

const prestigeCardStyle: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
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
  fontSize: 12.5,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const prestigeLevelBadgeStyle: CSSProperties = {
  marginLeft: "auto",
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
};

const prestigeHintStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
  marginTop: 8,
  marginBottom: 0,
};

const playButtonStyle: CSSProperties = {
  marginTop: 4,
  padding: "12px 40px",
  borderRadius: 10,
  border: `2px solid ${PALETTE.gold}`,
  background: `linear-gradient(180deg, #ffe9a0, ${PALETTE.gold} 60%, #d98a2a)`,
  color: "#3a2408",
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: 1,
  cursor: "pointer",
};

const collectionLinkStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 11,
  letterSpacing: 0.6,
  textDecoration: "underline",
  cursor: "pointer",
};

const recordsRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-around",
  width: "100%",
  paddingTop: 14,
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

const honestNoteStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
  textAlign: "center",
};
