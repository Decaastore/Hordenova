import { useState, type CSSProperties, type ReactNode } from "react";
import { GAME_SPEEDS, type GameSpeed } from "@/config/gameBalance";
import type { HudSnapshot } from "@/engine/GameEngine";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getSfxVolume, isSfxMuted, setSfxVolume, SFX_VOLUME_STEPS, toggleSfxMuted } from "@/audio/audioSettings";
import { BagIcon, BoltIcon, CoinIcon, GemIcon, ShieldIcon, SpeakerIcon, WaveIcon } from "./icons";

interface HUDProps {
  hud: HudSnapshot;
  /** Master Implementation spec section 1 — "a interface deve deixar claro qual modo está sendo jogado". Always visible in the top bar, not just on a transient banner. */
  mode: "INFINITE" | "ASCENSION";
  onSetSpeed: (speed: GameSpeed) => void;
  onOpenInventory: () => void;
}

export function HUD({ hud, mode, onSetSpeed, onOpenInventory }: HUDProps) {
  const { t } = useLanguage();
  const hpRatio = hud.baseHp / hud.maxBaseHp;
  const hpColor = hpRatio > 0.5 ? PALETTE.success : hpRatio > 0.2 ? PALETTE.gold : PALETTE.danger;

  return (
    <div style={barStyle}>
      <div style={brandStyle}>HORDENOVA</div>
      <div style={{ ...modeChipStyle, borderColor: mode === "ASCENSION" ? PALETTE.gem : PALETTE.uiAccent, color: mode === "ASCENSION" ? PALETTE.gem : PALETTE.uiAccent }}>
        {mode === "ASCENSION" ? `🏆 ${t("modeSelect.ascension.label")}` : `♾️ ${t("modeSelect.infinite.label")}`}
      </div>

      <div style={groupStyle}>
        <Stat
          icon={<WaveIcon color={PALETTE.uiAccent} />}
          label={t("hud.wave")}
          value={String(hud.wave)}
          sublabel={t(`phases.${hud.phaseId}.name` as TranslationKey)}
        />
        <Stat
          icon={<ShieldIcon color={hpColor} />}
          label={t("hud.baseHp")}
          value={`${Math.ceil(hud.baseHp)} / ${hud.maxBaseHp}`}
          valueColor={hpColor}
        />
        <Stat
          icon={<CoinIcon color={PALETTE.gold} />}
          label={t("hud.gold")}
          value={String(hud.gold)}
          valueColor={PALETTE.gold}
        />
        <Stat
          icon={<GemIcon color={PALETTE.gem} />}
          label={t("hud.gems")}
          value={hud.gemShards > 0 ? `${hud.gems} (+${hud.gemShards})` : String(hud.gems)}
          valueColor={PALETTE.gem}
        />
        <div style={{ textAlign: "center", minWidth: 100 }}>
          <div style={labelStyle}>{t("hud.state")}</div>
          <div style={{ ...valueStyle, fontSize: 13 }}>{t(`hud.phase.${hud.phase}`)}</div>
        </div>
      </div>

      <div style={groupStyle}>
        <BoltIcon color={PALETTE.uiTextDim} size={13} />
        {GAME_SPEEDS.map((speed) => {
          const active = hud.speed === speed;
          return (
            <button
              key={speed}
              onClick={() => onSetSpeed(speed)}
              style={{
                ...speedButtonStyle,
                borderColor: active ? PALETTE.uiAccent : PALETTE.uiPanelBorder,
                color: active ? PALETTE.uiAccentBright : PALETTE.uiTextDim,
                background: active ? "rgba(255,210,87,0.18)" : "#3a2a18",
                boxShadow: active ? `0 0 10px ${PALETTE.uiAccent}66` : "none",
              }}
            >
              {speed}x
            </button>
          );
        })}
        <button onClick={onOpenInventory} style={inventoryButtonStyle}>
          <BagIcon size={13} />
          {t("inventory.button")}
        </button>
        <SfxControl />
      </div>
    </div>
  );
}

/** Audio spec section 13 — SFX Volume (0/25/50/75/100%) + a separate Mute toggle, persisted via audio/audioSettings.ts. No music control — none exists yet. */
function SfxControl() {
  const [volume, setVolume] = useState(getSfxVolume);
  const [muted, setMuted] = useState(isSfxMuted);
  const { t } = useLanguage();

  const cycleVolume = () => {
    const currentIndex = SFX_VOLUME_STEPS.indexOf(volume as (typeof SFX_VOLUME_STEPS)[number]);
    const next = SFX_VOLUME_STEPS[(currentIndex + 1) % SFX_VOLUME_STEPS.length]!;
    setSfxVolume(next);
    setVolume(next);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button
        onClick={() => setMuted(toggleSfxMuted())}
        title={t("audio.muteSfx")}
        style={{ ...inventoryButtonStyle, marginLeft: 0, padding: "5px 8px" }}
      >
        <SpeakerIcon size={13} muted={muted} />
      </button>
      <button onClick={cycleVolume} title={t("audio.sfxVolume")} style={{ ...inventoryButtonStyle, marginLeft: 0 }}>
        {Math.round(volume * 100)}%
      </button>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  valueColor,
  sublabel,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  /** Small caption under the value — used for the current phase/biome name under the wave counter. */
  sublabel?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 92 }}>
      <span style={{ opacity: 0.85, display: "flex" }}>{icon}</span>
      <div>
        <div style={labelStyle}>{label}</div>
        <div style={{ ...valueStyle, color: valueColor ?? valueStyle.color }}>{value}</div>
        {sublabel && <div style={sublabelStyle}>{sublabel}</div>}
      </div>
    </div>
  );
}

const barStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "9px 22px",
  background: `linear-gradient(180deg, ${PALETTE.uiPanelBg}, rgba(28,18,10,0.97))`,
  borderBottom: `1px solid ${PALETTE.uiPanelBorder}`,
  boxShadow: "0 2px 14px rgba(0,0,0,0.5)",
  gap: 18,
  flexWrap: "wrap",
  position: "relative",
  zIndex: 2,
};

const brandStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 3,
  color: PALETTE.uiAccentBright,
  textShadow: `0 0 12px ${PALETTE.uiAccent}88`,
  whiteSpace: "nowrap",
};

const modeChipStyle: CSSProperties = {
  padding: "3px 9px",
  borderRadius: 6,
  border: "1px solid",
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: 0.6,
  whiteSpace: "nowrap",
};

const groupStyle: CSSProperties = {
  display: "flex",
  gap: 20,
  alignItems: "center",
  flexWrap: "wrap",
  rowGap: 6,
};

const labelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.4,
  color: PALETTE.uiTextDim,
  textTransform: "uppercase",
};

const sublabelStyle: CSSProperties = {
  fontSize: 9.5,
  color: PALETTE.uiAccent,
  letterSpacing: 0.3,
  marginTop: 1,
  whiteSpace: "nowrap",
};

const valueStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: PALETTE.uiText,
  lineHeight: 1.3,
};

const inventoryButtonStyle: CSSProperties = {
  marginLeft: 6,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 11px",
  borderRadius: 6,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "#3a2a18",
  color: PALETTE.uiTextDim,
  fontWeight: 700,
  fontSize: 10.5,
  letterSpacing: 0.6,
  cursor: "pointer",
};

const speedButtonStyle: CSSProperties = {
  padding: "5px 11px",
  borderRadius: 6,
  border: "1px solid",
  fontWeight: 700,
  fontSize: 12,
  transition: "background 120ms ease, box-shadow 120ms ease",
};
