import { useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import { audioManager } from "@/audio/AudioManager";
import { getMusicVolume, isMusicMuted, MUSIC_VOLUME_STEPS, setMusicVolume, toggleMusicMuted } from "@/audio/musicSettings";
import { NoteIcon } from "./icons";

/**
 * Home screen's ambient-music control: mute toggle + stepped volume +
 * a visual indicator (the note icon itself reflects muted state, and a
 * small pulsing dot shows when music is actually audible right now) —
 * spec: "mute, controle de volume, indicador visual, preferência
 * persistida". Playback itself (starting/stopping the pad) is driven by
 * the Home screen on mount/unmount; this component only ever adjusts
 * volume/mute on the already-persisted preference (see musicSettings.ts).
 */
export function MusicControl() {
  const { t } = useLanguage();
  const [volume, setVolume] = useState(getMusicVolume);
  const [muted, setMuted] = useState(isMusicMuted);

  const cycleVolume = () => {
    const currentIndex = MUSIC_VOLUME_STEPS.indexOf(volume as (typeof MUSIC_VOLUME_STEPS)[number]);
    const next = MUSIC_VOLUME_STEPS[(currentIndex + 1) % MUSIC_VOLUME_STEPS.length]!;
    setMusicVolume(next);
    setVolume(next);
  };

  const audible = !muted && volume > 0 && audioManager.isMusicPlaying();

  return (
    <div style={rootStyle}>
      <button
        onClick={() => setMuted(toggleMusicMuted())}
        title={t("audio.muteMusic")}
        style={buttonStyle}
        aria-pressed={muted}
      >
        <NoteIcon size={14} muted={muted} color={PALETTE.uiAccentBright} />
        {audible && <span style={indicatorStyle} aria-hidden="true" />}
      </button>
      <button onClick={cycleVolume} title={t("audio.musicVolume")} style={buttonStyle}>
        {Math.round(volume * 100)}%
      </button>
    </div>
  );
}

const rootStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const buttonStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 9px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: "rgba(30,20,10,0.55)",
  color: PALETTE.uiTextDim,
  fontWeight: 700,
  fontSize: 10.5,
  letterSpacing: 0.5,
  cursor: "pointer",
};

/** A small pulsing dot — the "visual indicator" the spec asks for, distinct from the icon's own muted/unmuted state, showing the pad is genuinely audible right now (not just "not muted" — e.g. also off while autoplay is still blocked pending a user gesture). */
const indicatorStyle: CSSProperties = {
  position: "absolute",
  top: 3,
  right: 3,
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: PALETTE.success,
  boxShadow: `0 0 5px ${PALETTE.success}`,
};
