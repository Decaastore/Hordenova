import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GAME_SPEEDS, type GameSpeed } from "@/config/gameBalance";
import type { HudSnapshot } from "@/engine/GameEngine";
import { PALETTE } from "@/rendering/theme";
import { counterOf, type WaveElement } from "@/config/waveElements";
import { ELEMENT_GLYPH } from "./BlessingCard";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";
import { getSfxVolume, isSfxMuted, setSfxVolume, SFX_VOLUME_STEPS, toggleSfxMuted } from "@/audio/audioSettings";
import { phaseNumberFromWave, waveInPhase, WAVES_PER_PHASE } from "@/config/wavePhase";
import { getPhaseForWave, isMainBossWave, isMiniBossWaveInPhase } from "@/config/phaseConfig";
import { riftRewardPct } from "@/config/rifts";
import { romanDepth } from "@/config/eternal";
import { BrandLogo } from "./BrandLogo";
import { BestiaryIcon, EternalIcon, ExpeditionIcon, ForgeIcon, RiftIcon, TalentIcon } from "./hudIcons";
import { cycleMapBrightness, getMapBrightness } from "@/rendering/mapBrightness";
import { BagIcon, BoltIcon, CastleIcon, ScrollIcon, CoinIcon, GemIcon, GemShardIcon, ShieldIcon, SpeakerIcon } from "./icons";

interface HUDProps {
  hud: HudSnapshot;
  onSetSpeed: (speed: GameSpeed) => void;
  onOpenInventory: () => void;
  /** The HORDENOVA logo takes the player back to the Home page — same as the defeat screen's Main Menu button (a wave in progress restarts on return). */
  onExitToHome?: () => void;
  /** Clicking either Gem balance opens the Store. */
  onOpenStore?: () => void;
  /** Opens/closes the daily missions panel. */
  onToggleMissions?: () => void;
  /** Opens/closes the city panel (config/city.ts). */
  onToggleCity?: () => void;
  /** FENDAS — opens the Rift panel. */
  onToggleRift?: () => void;
  /** ÁRVORE DE TALENTOS — opens the talent panel. */
  onToggleTalents?: () => void;
  /** BESTIÁRIO E CONQUISTAS — opens the bestiary panel. */
  onToggleBestiary?: () => void;
  /** MODO ETERNO — opens the Eternal panel (only shown in the Eternal castle). */
  onToggleEternal?: () => void;
  /** EXPEDIÇÕES E FORJA — opens the Expeditions and Forge panel. */
  onToggleExpeditions?: () => void;
  /** FORJA — opens the Forge panel (its own button so players see it exists). */
  onToggleForge?: () => void;
}

export function HUD({ hud, onSetSpeed, onOpenInventory, onExitToHome, onOpenStore, onToggleMissions, onToggleCity, onToggleRift, onToggleTalents, onToggleBestiary, onToggleEternal, onToggleExpeditions, onToggleForge }: HUDProps) {
  const { t } = useLanguage();
  const hpRatio = Math.max(0, Math.min(1, hud.baseHp / Math.max(1, hud.maxBaseHp)));
  const hpColor = hpRatio > 0.5 ? PALETTE.success : hpRatio > 0.2 ? PALETTE.gold : PALETTE.danger;
  const onda = waveInPhase(hud.wave);
  const status = statusLine(hud, t);
  const threat = threatLine(hud, t);

  return (
    <div className="hh" data-testid="hud">
      <style>{HUD_CSS}</style>

      {/* ── row 1: where you are and what you have ── */}
      <div className="hh-main">
        {onExitToHome ? (
          <button type="button" onClick={onExitToHome} className="hh-brand" title={t("hud.backToHome")} aria-label={t("hud.backToHome")} data-testid="hud-home">
            <BrandLogo height={22} decorative />
          </button>
        ) : (
          <div className="hh-brand">
            <BrandLogo height={22} />
          </div>
        )}

        <div className="hh-wave" title={t("hud.checkpointTooltip", { onda, total: WAVES_PER_PHASE })}>
          <div className="hh-wave-top">
            {hud.eternal.active && (
              <span className="hh-eternal" title={t("eternal.tooltip")}>
                {t("eternal.badge")}
                {hud.eternal.depth > 0 ? ` · ${romanDepth(hud.eternal.depth)}` : ""}
              </span>
            )}
            <span className="hh-wave-phase">{t("hud.phaseLabel", { phase: phaseNumberFromWave(hud.wave) })}</span>
            <span className="hh-wave-onda">{t("hud.waveOfPhase", { onda, total: WAVES_PER_PHASE })}</span>
          </div>
          <PhaseWaveProgress onda={onda} />
          <div className="hh-wave-place">
            {t(`phases.${hud.phaseI18nKey}.name` as TranslationKey)} · {t("hud.globalWaveSublabel", { wave: hud.wave })}
            {hud.seasonBestWave > 0 && (
              <span className="hh-record" title={t("hud.recordTooltip")}>
                {" · "}
                {t("hud.record", { wave: hud.seasonBestWave })}
              </span>
            )}
          </div>
        </div>

        <div className="hh-castle" title={t("hud.castleTooltip")}>
          <div className="hh-castle-head">
            <ShieldIcon color={hpColor} size={14} />
            <span className="hh-lbl">{t("hud.baseHp")}</span>
            <span className="hh-castle-num" style={{ color: hpColor }}>
              {Math.ceil(hud.baseHp)} / {hud.maxBaseHp}
            </span>
          </div>
          <div className="hh-castle-bar" role="meter" aria-valuemin={0} aria-valuemax={hud.maxBaseHp} aria-valuenow={Math.ceil(hud.baseHp)} aria-label={t("hud.baseHp")}>
            <div className="hh-castle-fill" style={{ width: `${hpRatio * 100}%`, background: `linear-gradient(180deg, ${hpColor}, ${hpColor}aa)` }} />
          </div>
        </div>

        <div className="hh-wallet">
          <div style={{ position: "relative" }} title={t("hud.goldTooltip")}>
            <Stat icon={<CoinIcon color={PALETTE.gold} />} label={t("hud.gold")} value={String(hud.gold)} valueColor={PALETTE.gold} />
            <GoldGainIndicator gold={hud.gold} />
          </div>
          {/*
           * P2 UX fix — Gems and Gem Shards are always separate stats with
           * separate labels (never "<gems> (+<shards>)"), so a Shards gain can
           * never read as Gems. See config/gemSinks.ts for the conversion.
           */}
          <GemsLink onOpenStore={onOpenStore} title={t("hud.openStore")}>
            <Stat
              icon={<GemIcon color={PALETTE.gem} />}
              label={t("hud.freeGems")}
              value={String(hud.freeGems)}
              valueColor={PALETTE.gem}
              title={onOpenStore ? undefined : t("gems.freeExplainer")}
            />
            <Stat
              icon={<GemIcon color={PALETTE.gem} />}
              label={t("hud.purchasedGems")}
              value={String(hud.purchasedGems)}
              valueColor={PALETTE.gem}
              title={onOpenStore ? undefined : t("gems.purchasedExplainer")}
            />
          </GemsLink>
          {hud.gemShards > 0 && (
            <Stat
              icon={<GemShardIcon color={PALETTE.gem} style={{ opacity: 0.8 }} />}
              label={t("hud.gemShards")}
              value={`+${hud.gemShards}`}
              valueColor={PALETTE.uiTextDim}
              title={t("hud.gemShardsTooltip")}
            />
          )}
        </div>
      </div>

      {/* ── row 2: what is happening now, and the controls ── */}
      <div className="hh-sub">
        <div className="hh-status" aria-live="polite">
          <span className="hh-dot" style={{ background: status.color, boxShadow: `0 0 8px ${status.color}` }} />
          <span className="hh-status-text">{status.text}</span>
          {threat && (
            <>
              <span className="hh-sep" aria-hidden="true" />
              <span className="hh-threat" style={{ color: threat.color }}>
                {threat.text}
              </span>
            </>
          )}
          {(hud.waveElement || hud.nextWaveElement || hud.blessing) && (
            <>
              <span className="hh-sep" aria-hidden="true" />
              <ElementLine hud={hud} t={t} />
            </>
          )}
        </div>

        <div className="hh-controls">
          <div className="hh-speed" role="group" aria-label={t("hud.speedLabel")} title={t("hud.speedTooltip")}>
            <BoltIcon color={PALETTE.uiTextDim} size={12} />
            {GAME_SPEEDS.map((speed) => (
              <button key={speed} data-tutorial={`speed-${speed}`} onClick={() => onSetSpeed(speed)} className={`hh-speed-btn${hud.speed === speed ? " is-on" : ""}`} aria-pressed={hud.speed === speed}>
                {speed}x
              </button>
            ))}
          </div>
          {onToggleMissions && (
            <button onClick={onToggleMissions} className={`hh-btn${hud.missionsClaimable > 0 ? " is-live" : ""}`} data-testid="missions-button" title={t("hud.missionsTooltip")}>
              <span className="hh-ico hh-ico-scroll"><ScrollIcon size={14} /></span>
              <span className="hh-btn-txt">{t("missions.button")}</span>
              {hud.missionsClaimable > 0 && <span className="hh-badge">{hud.missionsClaimable}</span>}
            </button>
          )}
          {onToggleExpeditions && (
            <button onClick={onToggleExpeditions} className={`hh-btn${hud.expeditions.ready > 0 ? " is-live" : ""}`} data-testid="expeditions-button" title={t("expeditions.tooltip")}>
              <span className="hh-ico"><ExpeditionIcon size={14} color={PALETTE.uiAccentBright} /></span>
              <span className="hh-btn-txt">{t("expeditions.button")}</span>
              {hud.expeditions.ready > 0 && <span className="hh-badge">{hud.expeditions.ready}</span>}
            </button>
          )}
          {onToggleForge && (
            <button onClick={onToggleForge} className={`hh-btn${hud.expeditions.forgeReady ? " is-live" : ""}`} data-testid="forge-button" title={t("expeditions.forgeTooltip")}>
              <span className="hh-ico"><ForgeIcon size={14} color={PALETTE.uiAccentBright} /></span>
              <span className="hh-btn-txt">{t("expeditions.forgeButton")}</span>
              {hud.expeditions.forgeReady && <span className="hh-badge">1</span>}
            </button>
          )}
          {onToggleEternal && hud.eternal.active && (
            <button onClick={onToggleEternal} className="hh-btn hh-rift hh-eternal-btn" data-testid="eternal-button" title={t("eternal.tooltip")}>
              <span className="hh-ico"><EternalIcon size={14} color="#c99cff" /></span>
              <span className="hh-btn-txt">{t("eternal.button")}</span>
              {hud.eternal.contractsReady > 0 && <span className="hh-badge is-rift">{hud.eternal.contractsReady}</span>}
            </button>
          )}
          {onToggleTalents && (
            <button onClick={onToggleTalents} className={`hh-btn${hud.talents.free > 0 ? " is-live" : ""}`} data-testid="talents-button" title={t("talents.tooltip")}>
              <span className="hh-ico"><TalentIcon size={14} color={PALETTE.uiAccentBright} /></span>
              <span className="hh-btn-txt">{t("talents.button")}</span>
              {hud.talents.free > 0 && <span className="hh-badge">{hud.talents.free}</span>}
            </button>
          )}
          {onToggleRift && (
            <button onClick={onToggleRift} className={`hh-btn hh-rift${hud.rift.charges > 0 && !hud.rift.armed && !hud.rift.active ? " is-ready is-live" : ""}`} data-testid="rift-button" title={t("rift.tooltip")}>
              <span className="hh-ico"><RiftIcon size={14} color="#c99cff" /></span>
              <span className="hh-btn-txt">{t("rift.button")}</span>
              {hud.rift.charges > 0 && <span className="hh-badge is-rift">{hud.rift.charges}</span>}
            </button>
          )}
          {onToggleCity && (
            <button onClick={onToggleCity} className="hh-btn" data-testid="city-button" title={t("hud.cityTooltip")}>
              <span className="hh-ico hh-ico-castle"><CastleIcon size={14} /></span>
              <span className="hh-btn-txt">{t("city.button")}</span>
              {Object.keys(hud.city.burning).length > 0 && <span className="hh-badge is-fire">{Object.keys(hud.city.burning).length}</span>}
            </button>
          )}
          {onToggleBestiary && (
            <button onClick={onToggleBestiary} className="hh-btn" data-testid="bestiary-button" title={t("bestiary.tooltip")}>
              <span className="hh-ico"><BestiaryIcon size={14} color={PALETTE.uiAccentBright} /></span>
              <span className="hh-btn-txt">{t("bestiary.button")}</span>
            </button>
          )}
          <button onClick={onOpenInventory} className="hh-btn" title={t("hud.inventoryTooltip")}>
            <span className="hh-ico hh-ico-bag"><BagIcon size={14} /></span>
            <span className="hh-btn-txt">{t("inventory.button")}</span>
          </button>
          <span className="hh-divider" aria-hidden="true" />
          <MapBrightnessControl />
          <SfxControl />
        </div>
      </div>
    </div>
  );
}

type Translate = ReturnType<typeof useLanguage>["t"];

/** The plain-language line that says what is happening right now. */
function statusLine(hud: HudSnapshot, t: Translate): { text: string; color: string } {
  switch (hud.phase) {
    case "RUNNING":
      return {
        text: hud.enemiesLeft === 1 ? t("hud.status.runningOne") : t("hud.status.running", { n: hud.enemiesLeft }),
        color: PALETTE.success,
      };
    case "WAVE_TRANSITION":
      return { text: hud.nextWaveInS !== null ? t("hud.status.transition", { s: Math.max(1, hud.nextWaveInS) }) : t("hud.phase.WAVE_TRANSITION"), color: PALETTE.gold };
    case "BOSS_INTRO":
      return { text: t("hud.status.bossIntro"), color: PALETTE.danger };
    case "BOSS_BATTLE":
      return { text: t("hud.status.bossBattle"), color: PALETTE.danger };
    case "VICTORY":
      return { text: t("hud.status.victory"), color: PALETTE.gold };
    case "PROGRESSION_STOPPED":
      return { text: t("hud.status.stopped"), color: PALETTE.danger };
    case "DEPLOY":
      return { text: t("hud.status.deploy"), color: "#7fb6ff" };
    default:
      return { text: t(`hud.phase.${hud.phase}`), color: PALETTE.uiTextDim };
  }
}

/** What is coming: the mini-boss or the region's boss, with how many waves are left. */
const ELEMENT_COLORS: Record<WaveElement, string> = { FIRE: "#ff7a2a", ICE: "#8fe6ff", STORM: "#c49bff", NATURE: "#9adf6a" };
const ELEMENT_TOWER_NAME: Record<WaveElement, string> = { FIRE: "Inferno", ICE: "Frostborn", STORM: "Stormcaller", NATURE: "Ironwood" };

/** ELEMENTO DA ONDA — this wave's element and which tower it favours, the next wave's, and any blessing. */
/** The element's symbol in a small glowing coin, before its name in the HUD. */
function ElementDot({ el }: { el: WaveElement }) {
  return (
    <span
      aria-hidden="true"
      className="hn-glow"
      style={{ display: "inline-block", marginRight: 4, fontSize: 11, ["--hn-glow" as string]: ELEMENT_COLORS[el] }}
    >
      {ELEMENT_GLYPH[el]}
    </span>
  );
}

function ElementLine({ hud, t }: { hud: HudSnapshot; t: Translate }) {
  const name = (el: WaveElement) => t(`hud.element.names.${el}` as TranslationKey);
  return (
    <span className="hh-threat" style={{ display: "inline-flex", gap: 10 }}>
      {hud.waveElement && (
        <span key={`w${hud.wave}`} className="hn-pop" style={{ color: ELEMENT_COLORS[hud.waveElement] }}>
          <ElementDot el={hud.waveElement} />
          {t("hud.element.wave", { el: name(hud.waveElement), tower: ELEMENT_TOWER_NAME[counterOf(hud.waveElement)] })}
        </span>
      )}
      {!hud.waveElement && hud.nextWaveElement && <span key={`n${hud.wave}`} className="hn-pop" style={{ color: ELEMENT_COLORS[hud.nextWaveElement] }}><ElementDot el={hud.nextWaveElement} />{t("hud.element.next", { el: name(hud.nextWaveElement) })}</span>}
      {hud.blessing && <span key={`b${hud.blessing.element}${hud.blessing.untilWave}`} className="hn-pop" style={{ color: ELEMENT_COLORS[hud.blessing.element] }}><span className="hn-glow" style={{ display: "inline-block", ["--hn-glow" as string]: ELEMENT_COLORS[hud.blessing.element] }}>✦</span> {t("hud.element.blessed", { el: name(hud.blessing.element), wave: hud.blessing.untilWave })}</span>}
    </span>
  );
}

function threatLine(hud: HudSnapshot, t: Translate): { text: string; color: string } | null {
  if (hud.rift.active && hud.rift.active.wave === hud.wave) {
    return { text: t("rift.threat", { pct: riftRewardPct(hud.rift.active.mods) }), color: "#d5b3ff" };
  }
  if (hud.rift.armed) return { text: t("rift.threatArmed"), color: "#d5b3ff" };
  if (hud.bossSiege && hud.bossSiege.wavesUntilBoss > 0) {
    return { text: t("hud.threat.bossReturns", { wave: hud.bossSiege.wave, n: hud.bossSiege.wavesUntilBoss }), color: "#ff8a7a" };
  }
  const phase = getPhaseForWave(hud.wave);
  if (isMainBossWave(hud.wave)) return { text: t("hud.threat.bossNow"), color: "#ff8a7a" };
  if (isMiniBossWaveInPhase(hud.wave)) return { text: t("hud.threat.miniNow"), color: "#ffb36b" };
  const nextMini = phase.miniBossWaves.find((w) => w > hud.wave);
  const bossIn = phase.endWave - hud.wave;
  if (nextMini !== undefined && nextMini - hud.wave <= 3) {
    return { text: t("hud.threat.miniIn", { wave: nextMini, n: nextMini - hud.wave }), color: "#ffb36b" };
  }
  return { text: bossIn === 1 ? t("hud.threat.bossNext") : t("hud.threat.bossIn", { wave: phase.endWave, n: bossIn }), color: PALETTE.uiAccent };
}

/** Map brightness: Sombrio / Normal / Claro, a per-device display choice (rendering/mapBrightness.ts). */
function MapBrightnessControl() {
  const [level, setLevel] = useState(getMapBrightness);
  const { t } = useLanguage();
  return (
    <button
      onClick={() => setLevel(cycleMapBrightness())}
      title={t("mapBrightness.title")}
      aria-label={`${t("mapBrightness.title")}: ${t(`mapBrightness.${level}`)}`}
      className="hh-btn"
      data-testid="map-brightness"
    >
      <span className="hh-btn-txt">{t("mapBrightness.label")}:</span>{t(`mapBrightness.${level}`)}
    </button>
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
    <div className="hh-pair">
      <button onClick={() => setMuted(toggleSfxMuted())} title={t("audio.muteSfx")} aria-label={t("audio.muteSfx")} className="hh-btn hh-btn-icon">
        <SpeakerIcon size={13} muted={muted} />
      </button>
      <button onClick={cycleVolume} title={t("audio.sfxVolume")} className="hh-btn">
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

/**
 * SISTEMA DE FASES — "a UI deve deixar claro... progresso dentro das 10
 * ondas". Ten small ticks, filled up to the current onda-within-the-fase;
 * the last tick reads as the fase's own closing beat (onda 10). Purely
 * presentational — reads only `waveInPhase`'s already-computed value.
 */
function PhaseWaveProgress({ onda }: { onda: number }) {
  return (
    <div className="hh-ticks" aria-hidden="true">
      {Array.from({ length: WAVES_PER_PHASE }, (_, i) => {
        const step = i + 1;
        return <span key={step} className={`hh-tick${step < onda ? " is-done" : step === onda ? " is-now" : ""}`} />;
      })}
    </div>
  );
}

/** Wraps the two Gem balances in one button to the Store (or renders them plainly when there's no Store link). */
function GemsLink({ onOpenStore, title, children }: { onOpenStore?: () => void; title: string; children: ReactNode }) {
  if (!onOpenStore) return <>{children}</>;
  return (
    <button type="button" onClick={onOpenStore} title={title} aria-label={title} style={gemsLinkStyle} data-testid="hud-gems">
      {children}
    </button>
  );
}

function Stat({
  icon,
  label,
  value,
  valueColor,
  title,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  /** Native browser tooltip on hover — used to spell out the Gem Shard conversion rate without cluttering the stat itself. */
  title?: string;
}) {
  return (
    <div className="hh-stat" title={title}>
      <span className="hh-stat-icon">{icon}</span>
      <div>
        <div className="hh-lbl">{label}</div>
        <div className="hh-val" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      </div>
    </div>
  );
}

const goldGainStyle: CSSProperties = {
  position: "absolute",
  top: -6,
  left: "calc(100% - 4px)",
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

const gemsLinkStyle: CSSProperties = {
  display: "flex",
  gap: 18,
  alignItems: "center",
  padding: "2px 6px",
  margin: "-2px -6px",
  borderRadius: 8,
  border: "1px solid transparent",
  background: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

/*
 * The in-game top bar. Same family as the site's top bar (nav.tn): dark
 * leather-brown ground, a gold hairline with a small diamond at its centre,
 * gold for what you own, the castle's life as a filled bar, and a thinner
 * second strip that says in words what is happening. Scoped under .hh.
 */
const HUD_CSS = `
.hh { position: relative; z-index: 2; color: ${PALETTE.uiText};
  background: linear-gradient(180deg, #2b1d11 0%, #1f150c 100%);
  box-shadow: 0 3px 16px rgba(0,0,0,0.55); }
.hh::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
  background: linear-gradient(90deg, transparent, ${PALETTE.uiAccent}99 18%, ${PALETTE.uiAccent} 50%, ${PALETTE.uiAccent}99 82%, transparent); }
.hh::before { content: ""; position: absolute; left: 50%; bottom: -4px; width: 7px; height: 7px; margin-left: -3.5px;
  transform: rotate(45deg); background: ${PALETTE.uiAccent}; box-shadow: 0 0 8px ${PALETTE.uiAccent}; z-index: 1; }
.hh button { font-family: inherit; }
.hh-main { display: flex; align-items: center; gap: 26px; padding: 9px 22px 8px; flex-wrap: wrap; row-gap: 8px; }
.hh-brand { display: flex; align-items: center; background: none; border: none; padding: 0; cursor: pointer; }
div.hh-brand { cursor: default; }
.hh-lbl { font-size: 9.5px; letter-spacing: 1.2px; color: ${PALETTE.uiTextDim}; text-transform: uppercase; line-height: 1.2; }
.hh-val { font-size: 16px; font-weight: 700; color: ${PALETTE.uiText}; line-height: 1.25; font-variant-numeric: tabular-nums; }
.hh-stat { display: flex; align-items: center; gap: 7px; min-width: 70px; }
.hh-stat-icon { opacity: 0.9; display: flex; }

.hh-wave { min-width: 190px; cursor: help; }
.hh-wave-top { display: flex; align-items: baseline; gap: 8px; white-space: nowrap; }
.hh-eternal { align-self: center; padding: 1px 6px; border-radius: 4px; border: 1px solid #8a5cc8; background: rgba(140,90,210,0.22); color: #e3cdff; font-size: 10px; font-weight: 800; letter-spacing: 0.8px; }
.hh-wave-phase { font-family: Georgia, 'Times New Roman', serif; font-size: 17px; font-weight: 700; color: ${PALETTE.uiAccentBright}; letter-spacing: 0.4px; }
.hh-wave-onda { font-size: 13px; font-weight: 700; color: ${PALETTE.uiText}; }
.hh-wave-place { font-size: 10px; color: ${PALETTE.uiTextDim}; margin-top: 3px; white-space: nowrap; }
.hh-ticks { display: flex; gap: 3px; margin-top: 4px; }
.hh-tick { width: 15px; height: 4px; border-radius: 1px; background: rgba(255,255,255,0.13); transition: background 150ms ease; }
.hh-tick.is-done { background: ${PALETTE.uiAccent}; }
.hh-tick.is-now { background: ${PALETTE.uiAccentBright}; box-shadow: 0 0 6px ${PALETTE.uiAccent}; }

.hh-castle { min-width: 190px; cursor: help; }
.hh-castle-head { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.hh-castle-num { margin-left: auto; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hh-castle-bar { margin-top: 5px; height: 8px; border-radius: 2px; background: rgba(0,0,0,0.45);
  border: 1px solid rgba(255,214,140,0.22); overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.6); }
.hh-castle-fill { height: 100%; transition: width 250ms ease; box-shadow: inset 0 1px 0 rgba(255,255,255,0.25); }

.hh-wallet { display: flex; align-items: center; gap: 18px; margin-left: auto; }

.hh-sub { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 6px 22px 7px;
  background: rgba(0,0,0,0.28); border-top: 1px solid rgba(255,214,140,0.08); flex-wrap: wrap; row-gap: 6px; }
.hh-status { display: flex; align-items: center; gap: 9px; min-width: 0; font-size: 12.5px; flex-wrap: wrap; row-gap: 2px; }
.hh-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.hh-status-text { font-weight: 700; color: ${PALETTE.uiText}; white-space: nowrap; }
.hh-threat { font-weight: 600; white-space: nowrap; }
.hh-record { white-space: nowrap; cursor: help; }
.hh-sep { width: 1px; height: 12px; background: rgba(255,214,140,0.22); }

.hh-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; row-gap: 6px; }
.hh-speed { display: flex; align-items: center; gap: 2px; padding: 2px 3px 2px 7px; border-radius: 7px;
  border: 1px solid ${PALETTE.uiPanelBorder}; background: rgba(0,0,0,0.3); margin-right: 4px; }
.hh-speed-btn { padding: 3px 9px; border-radius: 5px; border: 1px solid transparent; background: none;
  color: ${PALETTE.uiTextDim}; font-weight: 700; font-size: 11.5px; cursor: pointer; transition: background 120ms ease, color 120ms ease; }
.hh-speed-btn:hover { color: ${PALETTE.uiText}; }
.hh-speed-btn.is-on { background: rgba(255,210,87,0.18); border-color: ${PALETTE.uiAccent}; color: ${PALETTE.uiAccentBright}; }
.hh-btn { position: relative; display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 6px;
  border: 1px solid ${PALETTE.uiPanelBorder}; background: linear-gradient(180deg, #3d2c1a, #2e2013);
  color: ${PALETTE.uiText}; font-weight: 700; font-size: 10.5px; letter-spacing: 0.5px; cursor: pointer; white-space: nowrap;
  transition: border-color 140ms ease, color 140ms ease, transform 160ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease; }
.hh-btn:hover { border-color: ${PALETTE.uiAccent}; color: ${PALETTE.uiAccentBright}; transform: translateY(-1.5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.35), 0 0 10px rgba(255,200,90,0.18); }
.hh-btn:active { transform: translateY(0) scale(0.96); transition-duration: 60ms; }
.hh-btn::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(255,235,190,0.22) 50%, transparent 70%); background-size: 250% 100%; background-position: 120% 0; }
.hh-btn:hover::after { opacity: 1; animation: hh-sweep 650ms ease-out; }
@keyframes hh-sweep { from { background-position: 120% 0; } to { background-position: -40% 0; } }

/* the drawn icons: each has a part that moves on hover, and keeps moving while something is ready */
.hh-ico { display: inline-flex; line-height: 0; transition: transform 200ms cubic-bezier(.34,1.56,.64,1); }
.hh-btn:hover .hh-ico { transform: scale(1.18) rotate(-4deg); }
.hh-ico svg * { transform-box: fill-box; }
.hni-flag { transform-origin: 0% 50%; }
.hh-btn:hover .hni-flag, .hh-btn.is-live .hni-flag { animation: hni-wave 0.9s ease-in-out infinite; }
@keyframes hni-wave { 0%,100% { transform: skewY(0) scaleX(1); } 50% { transform: skewY(-7deg) scaleX(0.9); } }
.hni-hammer { transform-origin: 100% 0%; }
.hh-btn:hover .hni-hammer, .hh-btn.is-live .hni-hammer { animation: hni-strike 0.7s cubic-bezier(.5,0,.75,0) infinite; }
@keyframes hni-strike { 0%,100% { transform: rotate(-22deg); } 55% { transform: rotate(14deg); } 65% { transform: rotate(8deg); } }
.hni-sparks { opacity: 0; transform-origin: 50% 100%; }
.hh-btn:hover .hni-sparks, .hh-btn.is-live .hni-sparks { animation: hni-spark 0.7s ease-out infinite; }
@keyframes hni-spark { 0%,50% { opacity: 0; transform: scale(0.4); } 60% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.4) translateY(-2px); } }
.hni-star { transform-origin: 50% 50%; }
.hh-btn:hover .hni-star, .hh-btn.is-live .hni-star { animation: hni-twinkle 1.2s ease-in-out infinite; }
.hni-star-b { animation-delay: 0.25s !important; }
.hni-star-c { animation-delay: 0.5s !important; }
@keyframes hni-twinkle { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.6); opacity: 0.55; } }
.hni-spin { transform-origin: 50% 50%; transform-box: view-box !important; animation: hni-turn 9s linear infinite; }
.hh-btn:hover .hni-spin, .hh-btn.is-live .hni-spin { animation-duration: 1.6s; }
@keyframes hni-turn { to { transform: rotate(360deg); } }
.hni-core { transform-origin: 50% 50%; }
.hh-btn.is-live .hni-core, .hh-btn:hover .hni-core { animation: hni-twinkle 1.1s ease-in-out infinite; }
.hni-flip { transform-origin: 50% 50%; transform-box: view-box !important; }
.hh-btn:hover .hni-flip { animation: hni-hourglass 1.4s cubic-bezier(.65,0,.35,1) infinite; }
@keyframes hni-hourglass { 0%,40% { transform: rotate(0); } 60%,100% { transform: rotate(180deg); } }
.hh-btn:hover .hni-eye { animation: hni-eyes 0.9s ease-in-out infinite; }
@keyframes hni-eyes { 0%,100% { fill: currentColor; filter: none; } 50% { fill: #ff4a2a; stroke: #ff4a2a; filter: drop-shadow(0 0 2px #ff4a2a); } }
.hh-ico-scroll, .hh-ico-bag, .hh-ico-castle { transform-origin: 50% 100%; }
.hh-btn:hover .hh-ico-scroll, .hh-btn.is-live .hh-ico-scroll { animation: hni-unroll 0.8s ease-in-out infinite; }
@keyframes hni-unroll { 0%,100% { transform: scale(1.15) rotate(-6deg); } 50% { transform: scale(1.15) rotate(6deg); } }
.hh-btn:hover .hh-ico-bag { animation: hni-bounce 0.6s cubic-bezier(.34,1.56,.64,1) infinite alternate; }
@keyframes hni-bounce { from { transform: scale(1.1) translateY(0); } to { transform: scale(1.18, 1.05) translateY(-2px); } }
.hh-btn:hover .hh-ico-castle { animation: hni-bounce 0.7s ease-in-out infinite alternate; }

/* a badge means "something waiting for you": it breathes */
.hh-badge { animation: hh-badge-pulse 1.8s ease-in-out infinite; }
@keyframes hh-badge-pulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,200,90,0.6); } 50% { transform: scale(1.15); box-shadow: 0 0 0 5px rgba(255,200,90,0); } }
.hh-badge.is-rift { animation-name: hh-badge-pulse-rift; }
@keyframes hh-badge-pulse-rift { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(180,124,255,0.6); } 50% { transform: scale(1.15); box-shadow: 0 0 0 5px rgba(180,124,255,0); } }
.hh-rift.is-ready { animation: hh-rift-glow 2.2s ease-in-out infinite; }
@keyframes hh-rift-glow { 0%,100% { box-shadow: 0 0 6px rgba(180,124,255,0.3); } 50% { box-shadow: 0 0 16px rgba(180,124,255,0.65); } }
.hh-btn-icon { padding: 5px 7px; }
.hh-pair { display: flex; gap: 3px; }
.hh-divider { width: 1px; height: 18px; background: rgba(255,214,140,0.18); margin: 0 4px; }
.hh-badge { position: absolute; top: -7px; right: -7px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
  background: ${PALETTE.gold}; color: #2b1906; font-size: 10px; font-weight: 800; line-height: 16px; text-align: center; }
.hh-badge.is-fire { background: ${PALETTE.danger}; color: #fff; }
.hh-badge.is-rift { background: #b47cff; color: #1a0f24; }
.hh-talent-glyph { color: ${PALETTE.uiAccentBright}; font-size: 12px; line-height: 1; }
.hh-rift-glyph { color: #c99cff; font-size: 12px; line-height: 1; }
.hh-rift.is-ready { border-color: #8a5cc8; box-shadow: 0 0 10px rgba(180,124,255,0.35); }
.hh button:focus-visible { outline: 2px solid ${PALETTE.uiAccentBright}; outline-offset: 2px; }

@media (max-width: 1100px) {
  .hh-main { gap: 18px; }
  .hh-wallet { margin-left: 0; }
}
@media (max-width: 720px) {
  .hh-main { padding: 7px 12px 6px; gap: 10px 16px; }
  .hh-brand { flex: 0 0 100%; justify-content: center; }
  .hh-wave, .hh-castle { min-width: 0; flex: 1 1 140px; }
  .hh-wallet { flex: 0 0 100%; gap: 12px; flex-wrap: wrap; }
  .hh-sub { padding: 5px 12px 6px; }
  .hh-status { font-size: 11.5px; }
  .hh-controls { flex-wrap: nowrap; overflow-x: auto; max-width: 100%; padding: 6px 2px 2px; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 85%, transparent); mask-image: linear-gradient(90deg, #000 85%, transparent); }
  /* the row scrolls sideways on phones: in the Eternal castle its own button comes right after the speed */
  .hh-controls > * { order: 1; }
  .hh-controls > :first-child { order: -2; }
  .hh-controls > .hh-eternal-btn { order: -1; }
  .hh-controls::-webkit-scrollbar { display: none; }
  .hh-hide-sm { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .hh-castle-fill, .hh-tick, .hh-speed-btn, .hh-btn { transition: none; }
  .hh-btn, .hh-btn:hover, .hh-ico, .hh-btn:hover .hh-ico { transform: none !important; }
  .hh-btn::after, .hh-badge, .hh-rift.is-ready, .hh-ico, .hh-ico *, .hni-spin { animation: none !important; }
}
`;
