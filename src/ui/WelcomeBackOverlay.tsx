import type { CSSProperties } from "react";
import type { OfflineReturnSummary } from "@/engine/GameEngine";
import type { TowerInstance } from "@/entities/Tower";
import { getTowerUpgradeCost } from "@/entities/Tower";
import { MAX_OFFLINE_CAPACITY_MS, OFFLINE_GOLD_SHARE, OFFLINE_PACE } from "@/engine/OfflineDefense";
import { phaseNumberFromWave, waveInPhase } from "@/config/wavePhase";
import { formatDurationShort } from "@/utils/formatDuration";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { CoinIcon, GemShardIcon, WaveIcon } from "./icons";

interface WelcomeBackOverlayProps {
  summary: OfflineReturnSummary;
  gold: number;
  towers: readonly TowerInstance[];
  onUpgrade: (towerId: string) => void;
  onContinue: () => void;
}

const MAX_UPGRADE_ROWS = 4;

/**
 * WELCOME BACK — the idle moment that matters most: what happened while you
 * were away (the game closed, or a tab the browser stopped running), in
 * plain numbers, and the gold ready to spend before the fight resumes.
 */
export function WelcomeBackOverlay({ summary, gold, towers, onUpgrade, onContinue }: WelcomeBackOverlayProps) {
  const { t, language } = useLanguage();
  const num = new Intl.NumberFormat(language === "ptBR" ? "pt-BR" : "en-US");
  const where = (wave: number) => t("hud.phaseWaveValue", { phase: phaseNumberFromWave(Math.max(1, wave)), onda: waveInPhase(Math.max(1, wave)) });
  const waves = summary.endingWave - summary.startingWave;

  const upgrades = towers
    .map((tower) => ({ tower, cost: getTowerUpgradeCost(tower) }))
    .filter((row): row is { tower: TowerInstance; cost: number } => row.cost !== null)
    .sort((a, b) => a.cost - b.cost)
    .slice(0, MAX_UPGRADE_ROWS);

  const stopNote =
    summary.stoppedReason === "BUILD_TOO_WEAK"
      ? t("offlineReturn.stopWeak", { where: where(summary.endingWave + 1) })
      : summary.awayMs >= MAX_OFFLINE_CAPACITY_MS
        ? t("offlineReturn.stopCap", { hours: Math.round(MAX_OFFLINE_CAPACITY_MS / 3_600_000) })
        : null;

  return (
    <div style={overlayStyle}>
      <div style={cardStyle} role="dialog" aria-labelledby="wb-title" data-testid="welcome-back">
        <h1 id="wb-title" style={titleStyle}>
          {t("offlineReturn.title")}
        </h1>
        <div style={subtitleStyle}>
          {t(summary.source === "HIDDEN_TAB" ? "offlineReturn.awayTab" : "offlineReturn.awayClosed", { time: formatDurationShort(summary.awayMs) })}
        </div>

        <div style={journeyStyle}>
          <div>
            <div style={journeyLabelStyle}>{t("offlineReturn.from")}</div>
            <div style={journeyValueStyle}>{where(summary.startingWave)}</div>
          </div>
          <WaveIcon size={18} color={PALETTE.uiAccent} />
          <div style={{ textAlign: "right" }}>
            <div style={journeyLabelStyle}>{t("offlineReturn.to")}</div>
            <div style={{ ...journeyValueStyle, color: PALETTE.uiAccentBright }}>{where(summary.endingWave)}</div>
          </div>
        </div>

        <dl style={gridStyle}>
          <Figure label={t("offlineReturn.wavesCleared")} value={`+${num.format(waves)}`} />
          <Figure label={t("offlineReturn.goldEarned")} value={`+${num.format(summary.goldEarned)}`} icon={<CoinIcon size={12} color={PALETTE.gold} />} color={PALETTE.gold} />
          {summary.bossesCleared + summary.miniBossesCleared > 0 && (
            <Figure label={t("offlineReturn.bosses")} value={`+${summary.bossesCleared + summary.miniBossesCleared}`} />
          )}
          {summary.gemShardsEarned > 0 && (
            <Figure label={t("offlineReturn.shards")} value={`+${summary.gemShardsEarned}`} icon={<GemShardIcon size={12} color={PALETTE.gem} />} color={PALETTE.gem} />
          )}
          {summary.passXpEarned > 0 && <Figure label={t("offlineReturn.passXp")} value={`+${summary.passXpEarned}`} />}
        </dl>

        {summary.missions.length > 0 && (
          <div style={missionsStyle}>
            {summary.missions.map((m) => (
              <div key={m.kind} style={missionRowStyle}>
                <span>{t(`missions.kinds.${m.kind}` as TranslationKey, { n: m.target })}</span>
                <strong style={{ color: m.progress >= m.target ? PALETTE.success : PALETTE.uiText }}>
                  {m.progress >= m.target ? t("offlineReturn.missionDone") : `${m.progress} / ${m.target}`}
                </strong>
              </div>
            ))}
          </div>
        )}

        {stopNote && <p style={noteStyle}>{stopNote}</p>}
        {summary.source === "CLOSED" && <p style={noteStyle}>{t("offlineReturn.paceNote", { pct: Math.round(OFFLINE_PACE * 100), gold: Math.round(OFFLINE_GOLD_SHARE * 100) })}</p>}

        {upgrades.length > 0 && (
          <div style={upgradesStyle}>
            <div style={sectionLabelStyle}>
              {t("offlineReturn.spendTitle")}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: PALETTE.gold }}>
                <CoinIcon size={11} color={PALETTE.gold} /> {num.format(gold)}
              </span>
            </div>
            {upgrades.map(({ tower, cost }) => (
              <div key={tower.id} style={upgradeRowStyle}>
                <span>
                  {t(`towers.${tower.type}.name` as TranslationKey)} <span style={{ color: PALETTE.uiTextDim }}>{t("offlineReturn.levelUp", { from: tower.level, to: tower.level + 1 })}</span>
                </span>
                <button onClick={() => onUpgrade(tower.id)} disabled={gold < cost} style={{ ...upgradeButtonStyle, opacity: gold < cost ? 0.45 : 1, cursor: gold < cost ? "default" : "pointer" }}>
                  <CoinIcon size={11} color={PALETTE.gold} /> {num.format(cost)}
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={onContinue} style={primaryButtonStyle} data-testid="welcome-continue">
          {t("offlineReturn.continueButton")}
        </button>
      </div>
    </div>
  );
}

function Figure({ label, value, icon, color }: { label: string; value: string; icon?: React.ReactNode; color?: string }) {
  return (
    <div style={figureStyle}>
      <dt style={{ fontSize: 10.5, color: PALETTE.uiTextDim }}>{label}</dt>
      <dd style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 800, color: color ?? PALETTE.uiText, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontVariantNumeric: "tabular-nums" }}>
        {icon}
        {value}
      </dd>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  overflowY: "auto",
  background: "radial-gradient(circle at 50% 40%, rgba(60,90,120,0.35), rgba(28,18,10,0.92) 70%)",
  zIndex: 5,
};

const cardStyle: CSSProperties = {
  width: 420,
  maxWidth: "100%",
  maxHeight: "100%",
  overflowY: "auto",
  boxSizing: "border-box",
  padding: "26px 26px 22px",
  borderRadius: 14,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.97), rgba(30,20,12,0.98))",
  boxShadow: "0 0 60px rgba(120,180,255,0.15), 0 20px 50px rgba(0,0,0,0.6)",
  color: PALETTE.uiText,
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 24,
  letterSpacing: 3,
  color: PALETTE.uiAccentBright,
  textShadow: `0 0 18px ${PALETTE.uiAccent}77`,
};

const subtitleStyle: CSSProperties = { fontSize: 12.5, color: PALETTE.uiTextDim, marginTop: -8 };

const journeyStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.25)",
  textAlign: "left",
};
const journeyLabelStyle: CSSProperties = { fontSize: 10, color: PALETTE.uiTextDim };
const journeyValueStyle: CSSProperties = { fontSize: 13.5, fontWeight: 800, color: PALETTE.uiText, marginTop: 2 };

const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, margin: 0 };
const figureStyle: CSSProperties = { padding: "8px 6px", borderRadius: 9, background: "rgba(0,0,0,0.2)" };

const missionsStyle: CSSProperties = { display: "grid", gap: 4, textAlign: "left" };
const missionRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: PALETTE.uiTextDim };

const noteStyle: CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.45, color: PALETTE.uiTextDim };

const upgradesStyle: CSSProperties = { display: "grid", gap: 6, textAlign: "left", paddingTop: 12, borderTop: `1px solid ${PALETTE.uiPanelBorder}` };
const sectionLabelStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 700, color: PALETTE.uiText };
const upgradeRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 12.5 };
const upgradeButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.14)",
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

const primaryButtonStyle: CSSProperties = {
  padding: "11px 32px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.18)",
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: 1,
  boxShadow: `0 0 16px ${PALETTE.uiAccent}55`,
  cursor: "pointer",
};
