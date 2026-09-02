import type { CSSProperties, ReactNode } from "react";
import type { TowerInstance } from "@/entities/Tower";
import { getTowerStats, getTowerUpgradeCost } from "@/entities/Tower";
import {
  getMilestoneUnlockForLevel,
  getTowerLevelStats,
  getTowerSpecialAtLevel,
  MAX_TOWER_LEVEL,
  type TowerType,
} from "@/config/towerStats";
import { PALETTE, TOWER_THEME } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { CoinIcon } from "./icons";

interface TowerInfoPanelProps {
  tower: TowerInstance;
  gold: number;
  onUpgrade: () => void;
  onClose: () => void;
}

type Translate = ReturnType<typeof useLanguage>["t"];

/**
 * Upgrade UX — spec section 7. Beyond the current stats, this shows a real
 * "what do I actually get" comparison (current -> next Damage/Attack Speed)
 * and, when the next level is a named unlock (see towerStats.ts
 * MILESTONE_UNLOCKS), a highlighted banner instead of just another number —
 * that's the moment meant to create expectation.
 */
export function TowerInfoPanel({ tower, gold, onUpgrade, onClose }: TowerInfoPanelProps) {
  const { t } = useLanguage();
  const theme = TOWER_THEME[tower.type];
  const stats = getTowerStats(tower);
  const upgradeCost = getTowerUpgradeCost(tower);
  const canAfford = upgradeCost !== null && gold >= upgradeCost;
  const nextLevel = upgradeCost !== null ? tower.level + 1 : null;
  const nextStats = nextLevel !== null ? getTowerLevelStats(tower.type, nextLevel) : null;
  const unlock = nextLevel !== null ? getMilestoneUnlockForLevel(tower.type, nextLevel) : null;

  return (
    <div style={{ ...panelStyle, borderColor: theme.primary, boxShadow: `0 0 22px ${theme.glow}, 0 8px 24px rgba(0,0,0,0.5)` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...dotStyle, background: theme.primary, boxShadow: `0 0 8px ${theme.glow}` }} />
          <strong style={{ fontSize: 14, color: PALETTE.uiText, letterSpacing: 0.5 }}>
            {t(`towers.${tower.type}.name`)}
          </strong>
        </div>
        <button onClick={onClose} style={closeButtonStyle}>
          ×
        </button>
      </div>
      <div style={{ fontSize: 11, color: PALETTE.uiTextDim }}>
        {t("towerInfo.level", { level: stats.level, max: MAX_TOWER_LEVEL })}
      </div>
      <div style={{ fontSize: 10.5, color: theme.accent, marginTop: 1 }}>{t(`towers.${tower.type}.role`)}</div>

      <div style={dividerStyle} />
      <Row label={t("towerInfo.damage")} value={stats.damage.toFixed(1)} />
      <Row label={t("towerInfo.attackSpeed")} value={`${stats.attackSpeed.toFixed(2)}/s`} />
      <Row label={t("towerInfo.range")} value={stats.range.toFixed(0)} />

      <div style={{ ...sectionLabelStyle, marginTop: 4 }}>{t("towerInfo.special")}</div>
      {renderSpecialLines(tower.type, tower.level, t).map((line) => (
        <Row key={line.label} label={line.label} value={line.value} dim={line.locked} />
      ))}

      {nextStats && upgradeCost !== null ? (
        <>
          <div style={dividerStyle} />
          <div style={sectionLabelStyle}>{t("towerInfo.nextLevel")}</div>
          <ComparisonRow label={t("towerInfo.damage")} from={stats.damage.toFixed(1)} to={nextStats.damage.toFixed(1)} />
          <ComparisonRow
            label={t("towerInfo.attackSpeed")}
            from={`${stats.attackSpeed.toFixed(2)}/s`}
            to={`${nextStats.attackSpeed.toFixed(2)}/s`}
          />

          {unlock && (
            <div style={{ ...unlockBannerStyle, borderColor: theme.primary }}>
              <div style={{ fontSize: 9, letterSpacing: 1, color: theme.accent, fontWeight: 700 }}>
                {t("towerInfo.unlockBanner", { level: unlock.level })}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: PALETTE.uiText, marginTop: 2 }}>
                {t(`towerInfo.unlocks.${unlock.key}.name`)}
              </div>
              <div style={{ fontSize: 10.5, color: PALETTE.uiTextDim, marginTop: 2, lineHeight: 1.35 }}>
                {t(`towerInfo.unlocks.${unlock.key}.description`)}
              </div>
            </div>
          )}

          <button
            onClick={onUpgrade}
            disabled={!canAfford}
            style={{
              ...upgradeButtonStyle,
              borderColor: theme.primary,
              opacity: canAfford ? 1 : 0.5,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {t("towerInfo.upgrade")}
              <span style={{ opacity: 0.6 }}>·</span>
              {t("towerInfo.cost")} <CoinIcon size={11} color={PALETTE.gold} /> {upgradeCost}
            </span>
          </button>
        </>
      ) : (
        <button disabled style={{ ...upgradeButtonStyle, borderColor: theme.primary, opacity: 0.5, marginTop: 10 }}>
          {t("towerInfo.maxLevel")}
        </button>
      )}
    </div>
  );
}

interface SpecialLine {
  label: string;
  value: string;
  locked?: boolean;
}

/** Per-type dynamic specialization readout — real current values, not just the static role blurb. */
function renderSpecialLines(type: TowerType, level: number, t: Translate): SpecialLine[] {
  const special = getTowerSpecialAtLevel(type, level);

  switch (special.type) {
    case "IRONWOOD":
      return [
        { label: t("towerInfo.specialLines.IRONWOOD.critChance"), value: `${Math.round(special.critChance * 100)}%` },
        { label: t("towerInfo.specialLines.IRONWOOD.critMultiplier"), value: `${special.critMultiplier.toFixed(2)}x` },
        special.bossDamageMultiplier > 1
          ? {
              label: t("towerInfo.specialLines.IRONWOOD.bossDamageMultiplier"),
              value: `+${Math.round((special.bossDamageMultiplier - 1) * 100)}%`,
            }
          : { label: t("towerInfo.specialLines.IRONWOOD.bossDamageMultiplier"), value: t("towerInfo.specialLines.IRONWOOD.locked", { level: 15 }), locked: true },
      ];
    case "INFERNO":
      return [
        { label: t("towerInfo.specialLines.INFERNO.burnDamagePerSecond"), value: special.burnDamagePerSecond.toFixed(1) },
        { label: t("towerInfo.specialLines.INFERNO.aoeRadius"), value: special.aoeRadius.toFixed(0) },
        { label: t("towerInfo.specialLines.INFERNO.burnMaxStacks"), value: `x${special.burnMaxStacks}` },
      ];
    case "FROSTBORN":
      return [
        { label: t("towerInfo.specialLines.FROSTBORN.slowPercent"), value: `${Math.round(special.slowPercent * 100)}%` },
        special.freezeChance > 0
          ? { label: t("towerInfo.specialLines.FROSTBORN.freezeChance"), value: `${Math.round(special.freezeChance * 100)}%` }
          : { label: t("towerInfo.specialLines.FROSTBORN.freezeChance"), value: t("towerInfo.specialLines.IRONWOOD.locked", { level: 10 }), locked: true },
      ];
    case "STORMCALLER":
      return [
        { label: t("towerInfo.specialLines.STORMCALLER.chainTargets"), value: String(special.chainTargets) },
        special.armorPenetration > 0
          ? { label: t("towerInfo.specialLines.STORMCALLER.armorPenetration"), value: `${Math.round(special.armorPenetration * 100)}%` }
          : { label: t("towerInfo.specialLines.STORMCALLER.armorPenetration"), value: t("towerInfo.specialLines.IRONWOOD.locked", { level: 10 }), locked: true },
      ];
  }
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: PALETTE.uiTextDim }}>{label}</span>
      <span style={{ color: dim ? PALETTE.uiTextDim : PALETTE.uiText, fontWeight: dim ? 500 : 600, fontStyle: dim ? "italic" : "normal" }}>
        {value}
      </span>
    </div>
  );
}

function ComparisonRow({ label, from, to }: { label: string; from: string; to: string }): ReactNode {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: PALETTE.uiTextDim }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: PALETTE.uiTextDim }}>{from}</span>
        <span style={{ color: PALETTE.uiTextDim }}>→</span>
        <span style={{ color: PALETTE.success, fontWeight: 700 }}>{to}</span>
      </span>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  width: 232,
  padding: 14,
  borderRadius: 10,
  border: "1px solid",
  background: `linear-gradient(160deg, rgba(52,37,22,0.97), rgba(30,20,10,0.97))`,
  color: PALETTE.uiText,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  maxHeight: "calc(100% - 32px)",
  overflowY: "auto",
};

const dotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: PALETTE.uiPanelBorder,
  margin: "4px 0 2px",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.2,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: 2,
};

const closeButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
};

const upgradeButtonStyle: CSSProperties = {
  marginTop: 6,
  padding: "8px 10px",
  borderRadius: 7,
  border: "1px solid",
  background: "rgba(255,255,255,0.04)",
  color: PALETTE.uiText,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: 0.5,
};

const unlockBannerStyle: CSSProperties = {
  marginTop: 6,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid",
  background: "rgba(255,210,87,0.1)",
};
