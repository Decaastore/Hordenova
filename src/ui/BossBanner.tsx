import type { CSSProperties } from "react";
import type { HudSnapshot } from "@/engine/GameEngine";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";

interface BossBannerProps {
  hud: HudSnapshot;
}

/**
 * Boss structure per spec section 7: name + HP bar shown while a main boss
 * fight is in progress, plus a brief cinematic "boss approaching" beat
 * during BOSS_INTRO before the boss itself has even spawned.
 */
export function BossBanner({ hud }: BossBannerProps) {
  const { t } = useLanguage();
  if (hud.phase !== "BOSS_INTRO" && hud.phase !== "BOSS_BATTLE") return null;
  if (!hud.bossName) return null;

  const hpRatio = hud.bossMaxHp && hud.bossMaxHp > 0 ? Math.max(0, (hud.bossHp ?? 0) / hud.bossMaxHp) : 1;

  return (
    <div style={containerStyle}>
      <div style={nameStyle}>{t("boss.introLine", { name: hud.bossName })}</div>
      {hud.phase === "BOSS_BATTLE" ? (
        <div style={barTrackStyle}>
          <div style={{ ...barFillStyle, width: `${hpRatio * 100}%` }} />
        </div>
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
