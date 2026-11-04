import type { CSSProperties, ReactNode } from "react";
import type { HudSnapshot } from "@/engine/GameEngine";
import { PALETTE, STATUS_COLORS, TOWER_THEME } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getEnragedShieldReduction } from "@/config/enrageShield";

interface BossBannerProps {
  hud: HudSnapshot;
}

/** Below this HP fraction the boss is enraged (see BossManager) — the banner flags it so the escalation reads as intentional, not a glitch. */
const ENRAGE_HP_RATIO = 0.3;

/**
 * The boss plate: one solid, fixed-size panel at the top of the map for the
 * whole fight — the approach (BOSS_INTRO), the fight itself (BOSS_BATTLE)
 * and the defeat + reward beat (VICTORY). Its size never changes between
 * those states, so nothing on screen jumps when the boss arrives, enrages
 * or falls. Purely informative: it never takes a click.
 */
export function BossBanner({ hud }: BossBannerProps) {
  const { t } = useLanguage();
  const victoryReward = hud.phase === "VICTORY" ? hud.bossLastReward : null;
  if (hud.phase !== "BOSS_INTRO" && hud.phase !== "BOSS_BATTLE" && victoryReward === null) return null;
  if (!hud.bossNameKey) return null;

  const bossName = t(`bosses.${hud.bossNameKey}.name` as TranslationKey);
  const fight = hud.bossFight;
  const battle = hud.phase === "BOSS_BATTLE";
  const assault = fight?.assault ?? 1;

  if (victoryReward !== null) {
    const first = hud.bossVictoryAssaults === 1;
    return (
      <div style={plateStyle} data-testid="boss-plate">
        <div style={headRowStyle}>
          <div style={nameStyle}>{t("boss.defeatedLine", { name: bossName })}</div>
          <Chip tone="gold">{t("boss.rewardLine", { amount: victoryReward })}</Chip>
        </div>
        <div style={trackStyle}>
          <div style={{ ...fillStyle, width: "100%", background: "linear-gradient(90deg,#c99a2e,#ffe08a)" }} />
        </div>
        <div style={footRowStyle}>
          <span style={{ color: first ? PALETTE.gold : PALETTE.uiTextDim, fontWeight: 700 }}>
            {hud.bossVictoryAssaults === null ? "" : first ? t("boss.firstAssault") : t("boss.fellOnAssault", { n: hud.bossVictoryAssaults })}
          </span>
        </div>
      </div>
    );
  }

  // During the approach the bar already shows the wounds carried over from earlier assaults.
  const hpRatio = battle
    ? hud.bossMaxHp && hud.bossMaxHp > 0 ? Math.max(0, (hud.bossHp ?? 0) / hud.bossMaxHp) : 1
    : hud.bossSiege?.hpFraction ?? 1;
  const enraged = battle && (fight ? fight.enraged : hpRatio <= ENRAGE_HP_RATIO);
  // SHIELD DURANTE O MODO ENFURECIDO — the same reduction applyDamageToEnemy uses.
  const shieldReduction = getEnragedShieldReduction(true, true, enraged);
  const weakness = fight?.weakness ?? null;

  return (
    <div style={{ ...plateStyle, borderColor: enraged ? "rgba(255,90,60,0.55)" : plateStyle.borderColor }} data-testid="boss-plate">
      <div style={headRowStyle}>
        <div style={nameStyle}>{battle ? bossName : t("boss.introLine", { name: bossName })}</div>
        <div style={chipRowStyle}>
          {assault > 1 && <Chip>{t("boss.assault", { n: assault })}</Chip>}
          {fight?.exhausted && <Chip>{t("boss.exhausted")}</Chip>}
          {enraged && <Chip tone="danger">{t("boss.enraged")}</Chip>}
          {enraged && shieldReduction > 0 && <Chip tone="shield">{t("boss.enrageShield", { percent: Math.round(shieldReduction * 100) })}</Chip>}
        </div>
      </div>

      <div style={trackStyle}>
        <div style={{ ...fillStyle, width: `${hpRatio * 100}%`, background: enraged ? "linear-gradient(90deg,#ff2e2e,#ffb347)" : fillStyle.background }} />
        <span style={hpTextStyle}>
          {battle
            ? `${Math.max(0, Math.ceil(hud.bossHp ?? 0)).toLocaleString()} / ${Math.round(hud.bossMaxHp ?? 0).toLocaleString()}`
            : `${Math.round(hpRatio * 100)}%`}
        </span>
      </div>

      <div style={footRowStyle}>
        {weakness ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: TOWER_THEME[weakness].primary, boxShadow: `0 0 6px ${TOWER_THEME[weakness].glow}` }} />
            {t("boss.weakShort", { tower: t(`towers.${weakness}.name` as TranslationKey) })}
          </span>
        ) : (
          <span>{t("boss.compositionHint")}</span>
        )}
        <span style={{ opacity: 0.8 }}>{battle ? t("boss.volleyHint") : assault > 1 ? t("boss.returns", { n: assault, pct: Math.round(hpRatio * 100) }) : t("boss.getReady")}</span>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone?: "gold" | "danger" | "shield" }) {
  const color = tone === "gold" ? PALETTE.gold : tone === "danger" ? "#ff7a5c" : tone === "shield" ? STATUS_COLORS.enrageShield : PALETTE.uiAccentBright;
  return <span style={{ ...chipStyle, color, borderColor: `${color}66` }}>{children}</span>;
}

const plateStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(540px, calc(100% - 32px))",
  boxSizing: "border-box",
  padding: "10px 16px 9px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,214,140,0.3)",
  background: "linear-gradient(180deg, rgba(34,22,12,0.94), rgba(20,13,8,0.94))",
  boxShadow: "0 10px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,235,190,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: 7,
  zIndex: 4,
  pointerEvents: "none",
};

const headRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  minHeight: 22,
};

const nameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: 0.6,
  color: PALETTE.uiText,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexShrink: 0,
};

const chipStyle: CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  background: "rgba(0,0,0,0.35)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  whiteSpace: "nowrap",
};

const trackStyle: CSSProperties = {
  position: "relative",
  height: 14,
  borderRadius: 7,
  border: "1px solid rgba(255,214,140,0.25)",
  background: "rgba(0,0,0,0.55)",
  overflow: "hidden",
};

const fillStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  right: "auto",
  background: `linear-gradient(90deg, ${PALETTE.danger}, #ff9a6a)`,
  transition: "width 150ms ease",
};

const hpTextStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.4,
  color: "#fff6e6",
  textShadow: "0 1px 2px rgba(0,0,0,0.9)",
  fontVariantNumeric: "tabular-nums",
};

const footRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  minHeight: 15,
  fontSize: 10.5,
  color: PALETTE.uiTextDim,
  whiteSpace: "nowrap",
  overflow: "hidden",
};
