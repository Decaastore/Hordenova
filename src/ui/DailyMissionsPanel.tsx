import type { CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import type { DailyMissionView } from "@/engine/GameEngine";
import { CoinIcon, GemShardIcon } from "./icons";

interface DailyMissionsPanelProps {
  missions: readonly DailyMissionView[];
  onClaim: (index: number) => void;
  onClose: () => void;
}

/** Today's three missions (config/dailyMissions.ts): progress, reward, and a claim button once done. The game keeps running behind it. */
export function DailyMissionsPanel({ missions, onClaim, onClose }: DailyMissionsPanelProps) {
  const { t } = useLanguage();
  return (
    <div style={panelStyle} role="dialog" aria-label={t("missions.title")} data-testid="missions-panel">
      <button onClick={onClose} style={closeStyle} aria-label={t("missions.close")}>
        ×
      </button>
      <div style={titleStyle}>{t("missions.title")}</div>
      <div style={subStyle}>{t("missions.resets")}</div>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {missions.map((m, i) => {
          const done = m.progress >= m.target;
          return (
            <div key={`${m.kind}-${i}`} style={{ ...rowStyle, opacity: m.claimed ? 0.6 : 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: PALETTE.uiText }}>{t(`missions.kinds.${m.kind}` as TranslationKey, { n: m.target })}</div>
              <div style={trackStyle}>
                <div style={{ ...fillStyle, width: `${Math.round((m.progress / m.target) * 100)}%`, background: done ? PALETTE.success : PALETTE.uiAccent }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 11, color: PALETTE.uiTextDim, fontVariantNumeric: "tabular-nums" }}>
                  {m.progress} / {m.target}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: PALETTE.uiTextDim }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <GemShardIcon size={11} color={PALETTE.gem} /> {m.rewardShards}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <CoinIcon size={11} color={PALETTE.gold} /> {m.rewardGold}
                  </span>
                </span>
              </div>
              {m.claimed ? (
                <div style={{ fontSize: 11, fontWeight: 700, color: PALETTE.success }}>{t("missions.claimed")}</div>
              ) : (
                <button onClick={() => onClaim(i)} disabled={!done} style={{ ...claimStyle, opacity: done ? 1 : 0.45, cursor: done ? "pointer" : "default" }} data-testid={`mission-claim-${i}`}>
                  {done ? t("missions.claim") : t("missions.inProgress")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 280,
  maxWidth: "calc(100% - 24px)",
  maxHeight: "calc(100% - 24px)",
  overflowY: "auto",
  padding: "16px 16px 14px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.98), rgba(30,20,12,0.99))",
  color: PALETTE.uiText,
  boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
  zIndex: 6,
};

const closeStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 10,
  background: "transparent",
  border: "none",
  color: PALETTE.uiTextDim,
  fontSize: 18,
  cursor: "pointer",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 17,
  fontWeight: 700,
  letterSpacing: 1,
  color: PALETTE.uiAccentBright,
};

const subStyle: CSSProperties = { fontSize: 11, color: PALETTE.uiTextDim, marginTop: 2 };

const rowStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "10px 11px",
  borderRadius: 9,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(0,0,0,0.22)",
};

const trackStyle: CSSProperties = { height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" };
const fillStyle: CSSProperties = { height: "100%", borderRadius: 3 };

const claimStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.18)",
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
  fontSize: 11.5,
};
