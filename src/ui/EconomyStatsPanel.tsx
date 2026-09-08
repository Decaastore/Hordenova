import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getGlobalEconomyStats, type LocalEconomySummary } from "@/engine/EconomyStats";
import {
  canUnlockPrestige,
  getPrestigeBonuses,
  getPrestigeTier,
  getPrestigeUpgradeCost,
  PRESTIGE_FUNCTIONAL_CAP_LEVEL,
  PRESTIGE_MIN_BEST_WAVE,
} from "@/config/prestige";
import { GemIcon } from "./icons";

interface EconomyStatsPanelProps {
  summary: LocalEconomySummary;
  /** Master Implementation Pass spec section 7-8 — Profile Prestige. */
  gems: number;
  prestigeLevel: number;
  /** The account's all-time record wave — gates whether Prestige is unlocked at all (see config/prestige.ts's canUnlockPrestige). */
  bestWave: number;
  onUpgradePrestige: () => void;
}

/** (multiplier - 1) * 100, formatted with at most 1 decimal and no trailing ".0" — every Prestige bonus is a multiple of 0.5%, so this never needs more precision than that. */
function formatBonusPercent(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 1000) / 10;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

/** Item System spec sections 18/21/33 — shows exactly what this device can honestly know, and states plainly that anything cross-player is unavailable rather than inventing a number. */
export function EconomyStatsPanel({ summary, gems, prestigeLevel, bestWave, onUpgradePrestige }: EconomyStatsPanelProps) {
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

      <div style={{ ...sectionTitleStyle, marginTop: 18 }}>{t("prestige.title")}</div>
      {canUnlockPrestige(bestWave) ? (
        <PrestigeUnlockedView gems={gems} prestigeLevel={prestigeLevel} onUpgradePrestige={onUpgradePrestige} />
      ) : (
        <PrestigeLockedView bestWave={bestWave} />
      )}

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

function PrestigeLockedView({ bestWave }: { bestWave: number }) {
  const { t } = useLanguage();
  return (
    <div style={prestigeCardStyle}>
      <div style={lockedTitleStyle}>{t("prestige.locked.title")}</div>
      <div style={lockedRequirementStyle}>{t("prestige.locked.requirement", { required: PRESTIGE_MIN_BEST_WAVE, bestWave })}</div>
      <p style={lockedExplainerStyle}>{t("prestige.locked.explainer")}</p>
    </div>
  );
}

function PrestigeUnlockedView({
  gems,
  prestigeLevel,
  onUpgradePrestige,
}: {
  gems: number;
  prestigeLevel: number;
  onUpgradePrestige: () => void;
}) {
  const { t } = useLanguage();
  const tier = getPrestigeTier(prestigeLevel);
  const tierLabel = t(`prestige.tiers.${tier.nameKey}` as TranslationKey) + (tier.cycle > 0 ? ` ${tier.cycle + 1}` : "");
  const current = getPrestigeBonuses(prestigeLevel);
  const next = getPrestigeBonuses(prestigeLevel + 1);
  const nextCost = getPrestigeUpgradeCost(prestigeLevel);
  const affordable = gems >= nextCost;
  const nextGoldGain = next.goldMultiplier - current.goldMultiplier;
  const nextGemShardGain = next.gemShardMultiplier - current.gemShardMultiplier;
  const nextHasEconomicBonus = nextGoldGain > 0 || nextGemShardGain > 0;

  // Progression list — the full 1..PRESTIGE_FUNCTIONAL_CAP_LEVEL range so the
  // "no more economic bonus past this point" cutoff is always visible, plus
  // a short lookahead past the player's own current level for context.
  const listEnd = Math.max(PRESTIGE_FUNCTIONAL_CAP_LEVEL, prestigeLevel + 10);
  const progressionLevels = Array.from({ length: listEnd }, (_, i) => i + 1);

  return (
    <>
      <div style={prestigeCardStyle}>
        <div style={{ fontSize: 15, fontWeight: 800, color: tier.color }}>{tierLabel}</div>
        <div style={levelLineStyle}>{t("prestige.levelPlain", { level: prestigeLevel })}</div>
        <div style={{ ...sectionSubtitleStyle, marginTop: 10 }}>{t("prestige.currentBenefitsTitle")}</div>
        <BenefitLines goldMultiplier={current.goldMultiplier} gemShardMultiplier={current.gemShardMultiplier} />
      </div>

      <div style={{ ...prestigeCardStyle, marginTop: 10, borderColor: PALETTE.gem }}>
        <div style={sectionSubtitleStyle}>{t("prestige.nextLevelTitle")}</div>
        <div style={levelLineStyle}>{t("prestige.levelPlain", { level: prestigeLevel + 1 })}</div>
        <div style={nextCostRowStyle}>
          <GemIcon size={11} color={PALETTE.gem} /> {t("prestige.cost", { cost: nextCost })}
        </div>
        {nextHasEconomicBonus ? (
          <BenefitLines goldMultiplier={1 + nextGoldGain} gemShardMultiplier={1 + nextGemShardGain} />
        ) : (
          <div style={capNoteStyle}>{t("prestige.noAdditionalBonus")}</div>
        )}
        <button onClick={onUpgradePrestige} disabled={!affordable} style={{ ...prestigeButtonStyle, opacity: affordable ? 1 : 0.5 }}>
          {t("prestige.upgrade")}
        </button>
        {!affordable && <div style={insufficientStyle}>{t("prestige.insufficientGems", { amount: nextCost - gems })}</div>}
      </div>

      <p style={permanentHintStyle}>{t("prestige.permanentHint")}</p>
      <p style={permanentHintStyle}>{t("prestige.capNote", { cap: PRESTIGE_FUNCTIONAL_CAP_LEVEL })}</p>

      <div style={{ ...sectionSubtitleStyle, marginTop: 14 }}>{t("prestige.progressionTitle")}</div>
      <div style={progressionListStyle}>
        {progressionLevels.map((level) => {
          const cost = getPrestigeUpgradeCost(level - 1);
          const before = getPrestigeBonuses(level - 1);
          const after = getPrestigeBonuses(level);
          const goldGain = after.goldMultiplier - before.goldMultiplier;
          const gemShardGain = after.gemShardMultiplier - before.gemShardMultiplier;
          const hasGain = goldGain > 0 || gemShardGain > 0;
          return (
            <div key={level} style={{ ...progressionRowStyle, borderColor: level === prestigeLevel ? PALETTE.gold : PALETTE.uiPanelBorder }}>
              <div style={progressionRowHeaderStyle}>
                <span style={progressionLevelStyle}>{t("prestige.levelPlain", { level })}</span>
                <span style={progressionCostStyle}>
                  <GemIcon size={9} color={PALETTE.gem} /> {cost}
                </span>
              </div>
              {hasGain ? (
                <BenefitLines goldMultiplier={after.goldMultiplier} gemShardMultiplier={after.gemShardMultiplier} small />
              ) : (
                <div style={progressionNoGainStyle}>{t("prestige.noAdditionalBonus")}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function BenefitLines({
  goldMultiplier,
  gemShardMultiplier,
  small,
}: {
  goldMultiplier: number;
  gemShardMultiplier: number;
  small?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div style={small ? benefitLinesSmallStyle : benefitLinesStyle}>
      <div style={small ? benefitLineSmallStyle : benefitLineStyle}>{t("prestige.benefitGold", { percent: formatBonusPercent(goldMultiplier) })}</div>
      <div style={small ? benefitLineSmallStyle : benefitLineStyle}>
        {t("prestige.benefitGemShards", { percent: formatBonusPercent(gemShardMultiplier) })}
      </div>
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

const sectionSubtitleStyle: CSSProperties = {
  fontSize: 9.5,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontWeight: 700,
  color: PALETTE.uiTextDim,
  marginBottom: 4,
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

const levelLineStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: PALETTE.uiText,
  marginTop: 2,
};

const benefitLinesStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  marginTop: 2,
};

const benefitLineStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: PALETTE.success,
};

const benefitLinesSmallStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  marginTop: 2,
};

const benefitLineSmallStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: PALETTE.success,
};

const nextCostRowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  color: PALETTE.gem,
  fontWeight: 700,
  marginTop: 4,
};

const capNoteStyle: CSSProperties = {
  fontSize: 10,
  fontStyle: "italic",
  color: PALETTE.uiTextDim,
  marginTop: 4,
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
  width: "100%",
};

const insufficientStyle: CSSProperties = {
  fontSize: 10,
  color: PALETTE.danger,
  marginTop: 5,
  textAlign: "center",
};

const permanentHintStyle: CSSProperties = {
  fontSize: 10,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
  marginTop: 8,
  marginBottom: 0,
};

const lockedTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: PALETTE.uiTextDim,
  letterSpacing: 0.6,
};

const lockedRequirementStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: PALETTE.uiText,
  marginTop: 4,
};

const lockedExplainerStyle: CSSProperties = {
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  lineHeight: 1.5,
  marginTop: 8,
  marginBottom: 0,
};

const progressionListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  maxHeight: 220,
  overflowY: "auto",
  paddingRight: 2,
};

const progressionRowStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 7,
  background: "rgba(0,0,0,0.22)",
  border: "1px solid",
};

const progressionRowHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const progressionLevelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: PALETTE.uiText,
};

const progressionCostStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontSize: 10,
  color: PALETTE.gem,
  fontWeight: 700,
};

const progressionNoGainStyle: CSSProperties = {
  fontSize: 9.5,
  fontStyle: "italic",
  color: PALETTE.uiTextDim,
  marginTop: 2,
};

const unavailableStyle: CSSProperties = {
  fontSize: 12,
  fontStyle: "italic",
  color: PALETTE.uiTextDim,
  padding: "10px 12px",
  borderRadius: 6,
  border: `1px dashed ${PALETTE.uiPanelBorder}`,
};
