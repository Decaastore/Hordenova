import type { CSSProperties } from "react";

/**
 * Small hand-drawn SVG glyphs used across the HUD/menu instead of emoji
 * (Phase 2 spec explicitly avoids emoji-as-art) or an icon font dependency.
 */

interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

export function WaveIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path
        d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3 11c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function ShieldIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path
        d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z"
        stroke={color}
        strokeWidth="1.8"
        fill="none"
      />
    </svg>
  );
}

export function CoinIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.8" />
      <path d="M12 8v8M9.5 10c0-1.1 1-2 2.5-2s2.5.7 2.5 1.7c0 2.6-5 1-5 3.6 0 1 1 1.7 2.5 1.7s2.5-.9 2.5-2" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function GemIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M6 4h12l4 6-10 10L2 10Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M2 10h20M9 4l-2 6 5 10 5-10-2-6" stroke={color} strokeWidth="1.2" strokeLinejoin="round" opacity="0.75" />
    </svg>
  );
}

/**
 * Deliberately distinct from GemIcon (a whole, single large gem) — this is
 * a cluster of small broken shards, so the two are never visually
 * confusable even at a glance. See HUD.tsx's Gems/Gem Shards split (P2 UX
 * fix: 10 Gem Shards = 1 Gem, and the two must never look interchangeable).
 */
export function GemShardIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M5 6h6l2.5 4L9 17 3 10Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M15 3h5l3 4.5-4.5 6L14 8Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" opacity="0.75" />
      <path d="M12 15l3 3-2 4-3.5-2.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

export function BoltIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill={color} />
    </svg>
  );
}

export function BagIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 8h12l-1.2 12.4a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6L6 8Z" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

export function SpeakerIcon({ size = 14, color = "currentColor", style, muted = false }: IconProps & { muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill={color} />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d="M16.5 8.5a5 5 0 0 1 0 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}

/** Home screen ambient-music control (see MusicControl.tsx) — a musical note distinct from SpeakerIcon (which is reserved for in-game SFX) so the two audio controls are never visually confused. */
export function NoteIcon({ size = 14, color = "currentColor", style, muted = false }: IconProps & { muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M9 17V5l10-2v12" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.5" cy="17" r="2.5" stroke={color} strokeWidth="1.6" />
      <circle cx="16.5" cy="15" r="2.5" stroke={color} strokeWidth="1.6" />
      {muted && <path d="M3 3l18 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

export function SkullIcon({ size = 14, color = "currentColor", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path
        d="M12 3c-4 0-7 3-7 7 0 2.4 1.2 4.4 3 5.7V18h2v2h4v-2h2v-2.3c1.8-1.3 3-3.3 3-5.7 0-4-3-7-7-7Z"
        stroke={color}
        strokeWidth="1.6"
      />
      <circle cx="9.5" cy="10" r="1.3" fill={color} />
      <circle cx="14.5" cy="10" r="1.3" fill={color} />
    </svg>
  );
}
