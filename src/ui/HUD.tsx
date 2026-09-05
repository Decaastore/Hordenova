import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GAME_SPEEDS, type GameSpeed } from "@/config/gameBalance";
import type { HudSnapshot } from "@/engine/GameEngine";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getSfxVolume, isSfxMuted, setSfxVolume, SFX_VOLUME_STEPS, toggleSfxMuted } from "@/audio/audioSettings";
import { BagIcon, BoltIcon, CoinIcon, GemIcon, GemShardIcon, ShieldIcon, SpeakerIcon, WaveIcon } from "./icons";

interface HUDProps {
  hud: HudSnapshot;
  onSetSpeed: (speed: GameSpeed) => void;
  onOpenInventory: () => void;
}

export function HUD({ hud, onSetSpeed, onOpenInventory }: HUDProps) {
  const { t } = useLanguage();
  const hpRatio = hud.baseHp / hud.maxBaseHp;
  const hpColor = hpRatio > 0.5 ? PALETTE.success : hpRatio > 0.2 ? PALETTE.gold : PALETTE.danger;

  return (
    <div style={barStyle}>
      <div style={brandStyle}>HORDENOVA</div>

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
        <div style={{ position: "relative" }}>
          <Stat
            icon={<CoinIcon color={PALETTE.gold} />}
            label={t("hud.gold")}
            value={String(hud.gold)}
            valueColor={PALETTE.gold}
          />
          <GoldGainIndicator gold={hud.gold} />
        </div>
        {/*
         * P2 UX fix — Gems and Gem Shards used to share ONE stat (`${gems}
         * (+${shards})`), so a "+5" that was actually 5 Gem Shards (see
         * config/gemSinks.ts's GEM_SHARDS_PER_GEM = 10) read as if 5 more
         * Gems had just been granted. Two separate stats, two separate
         * icons/labels, and a tooltip stating the real conversion rate make
         * the two currencies impossible to conflate at a glance.
         */}
        <Stat
          icon={<GemIcon color={PALETTE.gem} />}
          label={t("hud.gems")}
          value={String(hud.gems)}
          valueColor={PALETTE.gem}
        />
        {hud.gemShards > 0 && (
          <Stat
            icon={<GemShardIcon color={PALETTE.gem} style={{ opacity: 0.8 }} />}
            label={t("hud.gemShards")}
            value={`+${hud.gemShards}`}
            valueColor={PALETTE.uiTextDim}
            title={t("hud.gemShardsTooltip")}
          />
        )}
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

const GOLD_GAIN_DISPLAY_MS = 900;

/**
 * CORREÇÃO DE REQUISITOS (SEASON COMPETITIVA) — Gold feedback fix. Previously,
 * a Gold gain spawned a world-space canvas popup (rendering/vfx.ts's old
 * spawnGoldPopup) anchored to an enemy's death position or the castle gate —
 * exactly why it read as "behind/near the castle" instead of a clean HUD
 * readout. This replaces that entirely with a small, fixed, HUD-anchored
 * indicator: no canvas, no world-space coordinates, no camera shake, and the
 * exact same "aggregate into one +N instead of many simultaneous texts"
 * behavior (every gain within GOLD_GAIN_DISPLAY_MS of the last one adds onto
 * the same pending total and resets the timer, rather than stacking separate
 * badges). Purely presentational — reads hud.gold, never touches it.
 */
function GoldGainIndicator({ gold }: { gold: number }) {
  const prevGoldRef = useRef(gold);
  const [pending, setPending] = useState(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const delta = gold - prevGoldRef.current;
    prevGoldRef.current = gold;
    if (delta > 0) {
      setPending((prev) => prev + delta);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setPending(0), GOLD_GAIN_DISPLAY_MS);
    }
  }, [gold]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  if (pending <= 0) return null;
  return (
    <div style={goldGainStyle} aria-live="polite">
      +{pending}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  valueColor,
  sublabel,
  title,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  /** Small caption under the value — used for the current phase/biome name under the wave counter. */
  sublabel?: string;
  /** Native browser tooltip on hover — used to spell out the Gem Shard conversion rate without cluttering the stat itself. */
  title?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 92 }} title={title}>
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

const goldGainStyle: CSSProperties = {
  position: "absolute",
  top: -4,
  left: "calc(100% - 6px)",
  padding: "1px 6px",
  borderRadius: 8,
  background: "rgba(232,193,90,0.16)",
  border: `1px solid ${PALETTE.gold}`,
  color: PALETTE.gold,
  fontSize: 10.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  pointerEvents: "none",
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
