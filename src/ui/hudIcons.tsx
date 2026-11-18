import type { CSSProperties } from "react";

/**
 * Drawn icons for the in-game top bar (Expeditions, Forge, Talents, Rift,
 * Eternal, Bestiary) — they replace the old text glyphs (⚑ ⚒ ✦ ◈ ◆ ♛).
 * Each one has a moving part tagged with a class (hni-*) that HUD.tsx's CSS
 * animates when the button is hovered or has something ready: the flag
 * waves, the hammer strikes the anvil, the stars twinkle, the portal turns,
 * the hourglass flips, the beast's eyes light up.
 */
interface Props {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

export function ExpeditionIcon({ size = 14, color = "currentColor", style }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      <path d="M5 21V3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path className="hni-flag" d="M5.6 4h11.2l-2.6 3.6 2.6 3.6H5.6Z" fill={color} fillOpacity="0.28" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2.5 21h8" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function ForgeIcon({ size = 14, color = "currentColor", style }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      {/* anvil */}
      <path d="M3 12h13c0 2-1.6 3.4-3.6 3.6V18h2.6v2.5H7.5V18h2.6v-2.4C7 15.3 4.6 14 3 12Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={color} fillOpacity="0.18" />
      {/* hammer — pivots on its grip */}
      <g className="hni-hammer">
        <path d="M19.5 3.2 14 8.7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
        <path d="M15.2 2.6 20.6 8l-1.6 1.6-5.4-5.4Z" fill={color} />
      </g>
      <g className="hni-sparks" stroke={color} strokeWidth="1.2" strokeLinecap="round">
        <path d="M11 9.6 10 8.2" />
        <path d="M13.4 9.8 14 8.6" />
        <path d="M8.6 10.2 7.2 9.4" />
      </g>
    </svg>
  );
}

export function TalentIcon({ size = 14, color = "currentColor", style }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      <path d="M12 8v5M12 13l-5.5 5M12 13l5.5 5" stroke={color} strokeWidth="1.3" opacity="0.6" />
      <path className="hni-star hni-star-a" d="M12 1.8l1.6 3.4 3.4.5-2.5 2.4.6 3.4L12 9.9l-3.1 1.6.6-3.4L7 5.7l3.4-.5Z" fill={color} />
      <circle className="hni-star hni-star-b" cx="6" cy="19.2" r="2.1" fill={color} />
      <circle className="hni-star hni-star-c" cx="18" cy="19.2" r="2.1" fill={color} />
    </svg>
  );
}

export function RiftIcon({ size = 14, color = "currentColor", style }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      <g className="hni-spin">
        <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 21.5A9.5 9.5 0 0 1 2.5 12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M18.4 12A6.4 6.4 0 0 1 12 18.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        <path d="M5.6 12A6.4 6.4 0 0 1 12 5.6" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      </g>
      <circle className="hni-core" cx="12" cy="12" r="2.4" fill={color} />
    </svg>
  );
}

export function EternalIcon({ size = 14, color = "currentColor", style }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      <g className="hni-flip">
        <path d="M6 3h12M6 21h12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7.5 3c0 4.5 4.5 5.6 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 5.6-4.5 9s4.5 4.5 4.5 9" stroke={color} strokeWidth="1.5" />
        <path d="M9.6 19.4c.8-1.6 1.6-2.2 2.4-2.6.8.4 1.6 1 2.4 2.6Z" fill={color} />
      </g>
    </svg>
  );
}

export function BestiaryIcon({ size = 14, color = "currentColor", style }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      {/* horned beast head */}
      <path d="M4 3.5c.4 3 1.6 4.6 3.4 5.3M20 3.5c-.4 3-1.6 4.6-3.4 5.3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 9c1.4-1.4 3-2 5-2s3.6.6 5 2c.6 2.6.2 5.8-1.6 8.4L12 21l-3.4-3.6C6.8 14.8 6.4 11.6 7 9Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill={color} fillOpacity="0.15" />
      <path className="hni-eye" d="M8.8 11.6l2 .9-.4.9ZM15.2 11.6l-2 .9.4.9Z" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
