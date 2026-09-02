import type { CSSProperties } from "react";
import type { HudSnapshot } from "@/engine/GameEngine";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";

interface BossBannerProps {
  hud: HudSnapshot;
}

/** Below this HP fraction the boss is enraged (see BossManager) — the banner flags it so the escalation reads as intentional, not a glitch. */
const ENRAGE_HP_RATIO = 0.3;

/**
 * Boss structure per spec section 9: name + HP bar during the fight, a
 * "boss approaching" beat during BOSS_INTRO before it has even spawned,
 * an ENRAGED tag once it crosses the low-HP threshold, and a defeated +
 * reward beat during the VICTORY pause — the full entrance-to-reward arc
 * in one small always-present readout instead of leaving VICTORY silent.
 */
export function BossBanner({ hud }: BossBannerProps) {
  const { t } = useLanguage();
  const victoryReward = hud.phase === "VICTORY" ? hud.bossLastReward : null;
  if (hud.phase !== "BOSS_INTRO" && hud.phase !== "BOSS_BATTLE" && victoryReward === null) return null;
  if (!hud.bossName) return null;

  const hpRatio = hud.bossMaxHp && hud.bossMaxHp > 0 ? Math.max(0, (hud.bossHp ?? 0) / hud.bossMaxHp) : 1;
  const isEnraged = hud.phase === "BOSS_BATTLE" && hpRatio <= ENRAGE_HP_RATIO;

  if (victoryReward !== null) {
    return (
      <div style={containerStyle}>
        <div style={nameStyle}>{t("boss.defeatedLine", { name: hud.bossName })}</div>
        <div style={{ ...subtitleStyle, color: PALETTE.gold }}>{t("boss.rewardLine", { amount: victoryReward })}</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={nameStyle}>{t("boss.introLine", { name: hud.bossName })}</div>
      {hud.phase === "BOSS_BATTLE" ? (
        <>
          {isEnraged && <div style={enragedTagStyle}>{t("boss.enraged")}</div>}
          <div style={barTrackStyle}>
            <div style={{ ...barFillStyle, width: `${hpRatio * 100}%`, background: isEnraged ? enragedGradient : barFillStyle.background }} />
          </div>
        </>
      ) : (
        <div style={subtitleStyle}>{t("boss.getReady")}</div>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: "absolute",
  top: 14,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  zIndex: 4,
  pointerEvents: "none",
};

const nameStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 2,
  color: PALETTE.uiText,
  textShadow: `0 0 16px ${PALETTE.danger}aa, 0 2px 6px rgba(0,0,0,0.8)`,
};

const subtitleStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const barTrackStyle: CSSProperties = {
  width: 320,
  height: 10,
  borderRadius: 6,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.5)",
  overflow: "hidden",
};

const barFillStyle: CSSProperties = {
  height: "100%",
  background: `linear-gradient(90deg, ${PALETTE.danger}, #ff9a6a)`,
  boxShadow: `0 0 10px ${PALETTE.danger}aa`,
  transition: "width 150ms ease",
};

const enragedGradient = "linear-gradient(90deg, #ff2e2e, #ffb347)";

const enragedTagStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1.5,
  color: "#ff6a4a",
  textShadow: "0 0 8px rgba(255,60,30,0.8)",
};
