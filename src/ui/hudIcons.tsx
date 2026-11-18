import type { CSSProperties, ReactNode } from "react";

/**
 * TOP BAR EMBLEMS — every button in the in-game top bar carries a small
 * round emblem: a coloured enamel disc (each function has its own colour:
 * ember Forge, violet Rift, forest Expeditions…) set in a bronze rim, with a
 * solid, two-tone icon on it. The icon has a moving part tagged with a
 * class (hni-*) that HUD.tsx's CSS animates on hover and keeps animating
 * while the button has something waiting (a free talent, a ready item…);
 * a waiting button also gets a turning ring of light around its emblem.
 */

export type EmblemTone = "missions" | "expeditions" | "forge" | "talents" | "rift" | "eternal" | "city" | "bestiary" | "inventory";

export const EMBLEM_COLOR: Record<EmblemTone, string> = {
  missions: "#e8b45a",
  expeditions: "#62b85a",
  forge: "#ff6a22",
  talents: "#ffc93a",
  rift: "#a96bff",
  eternal: "#58d2c8",
  city: "#6aa6ff",
  bestiary: "#ff3f35",
  inventory: "#c98a4e",
};

export function HudEmblem({ tone, children }: { tone: EmblemTone; children: ReactNode }) {
  return (
    <span className={`hh-emb hh-emb-${tone}`} style={{ ["--emb" as string]: EMBLEM_COLOR[tone] } as CSSProperties} aria-hidden="true">
      <span className="hh-emb-disc">{children}</span>
    </span>
  );
}

const INK = "#fff4dc";
const SHADE = "rgba(28,14,4,0.55)";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="hh-emb-svg">
      {children}
    </svg>
  );
}

export function MissionsGlyph() {
  return (
    <Svg>
      <g className="hni-scroll">
        <path d="M6 3.5h11.5a2 2 0 0 1 2 2V18a2.5 2.5 0 0 1-2.5 2.5H7.5A2.5 2.5 0 0 1 5 18V5a1.5 1.5 0 0 1 1-1.5Z" fill={INK} />
        <path d="M8.5 8h8M8.5 11h8M8.5 14h5" stroke={SHADE} strokeWidth="1.4" strokeLinecap="round" />
        <circle className="hni-seal" cx="16.8" cy="17.2" r="3" fill="#d4372b" stroke="#7a140c" strokeWidth="0.8" />
        <path d="M15.6 17.2h2.4" stroke="#ffb3a8" strokeWidth="0.9" strokeLinecap="round" />
      </g>
    </Svg>
  );
}

export function ExpeditionGlyph() {
  return (
    <Svg>
      <rect x="5" y="2.5" width="2" height="19" rx="1" fill={INK} />
      <path className="hni-flag" d="M7 3.5h11.5l-2.8 4 2.8 4H7Z" fill={INK} />
      <path className="hni-flag" d="M7 7.5h8.7l1 1.3H7Z" fill={SHADE} />
      <ellipse cx="6" cy="21" rx="4" ry="1.2" fill={SHADE} />
    </Svg>
  );
}

export function ForgeGlyph() {
  return (
    <Svg>
      <path d="M2.5 11.5h14c0 2.3-1.8 3.8-4 4v2.5h2.6v3H6v-3h2.6v-2.6C5.6 15 3.6 13.6 2.5 11.5Z" fill={INK} />
      <path d="M2.5 11.5h14l-.4 1.4H3.4Z" fill={SHADE} />
      <g className="hni-hammer">
        <rect x="15.2" y="2.2" width="7.4" height="3.6" rx="0.8" transform="rotate(45 18.9 4)" fill={INK} />
        <path d="M17 6.4 12.6 10.8" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="hni-sparks" fill="#ffe08a">
        <circle cx="10" cy="8.6" r="1" />
        <circle cx="7.2" cy="9.4" r="0.8" />
        <circle cx="12.4" cy="8" r="0.7" />
      </g>
    </Svg>
  );
}

export function TalentGlyph() {
  return (
    <Svg>
      <path className="hni-star hni-star-a" d="M12 1.5 14 8.2 20.8 10 14 11.8 12 18.5 10 11.8 3.2 10 10 8.2Z" fill={INK} />
      <path d="M12 6.2 12.9 9.1 15.8 10 12.9 10.9 12 13.8 11.1 10.9 8.2 10 11.1 9.1Z" fill="#ffd257" />
      <path className="hni-star hni-star-b" d="M5 16.5 5.7 18.3 7.5 19 5.7 19.7 5 21.5 4.3 19.7 2.5 19 4.3 18.3Z" fill={INK} />
      <path className="hni-star hni-star-c" d="M19 15.5 19.6 17 21 17.5 19.6 18 19 19.5 18.4 18 17 17.5 18.4 17Z" fill={INK} />
    </Svg>
  );
}

export function RiftGlyph() {
  return (
    <Svg>
      <g className="hni-spin">
        <path d="M12 3a9 9 0 0 1 8.6 6.3c-1.8-2.1-4.6-2.6-6.6-1.4" fill="none" stroke={INK} strokeWidth="2.3" strokeLinecap="round" />
        <path d="M21 12a9 9 0 0 1-6.3 8.6c2.1-1.8 2.6-4.6 1.4-6.6" fill="none" stroke={INK} strokeWidth="2.3" strokeLinecap="round" />
        <path d="M12 21a9 9 0 0 1-8.6-6.3c1.8 2.1 4.6 2.6 6.6 1.4" fill="none" stroke={INK} strokeWidth="2.3" strokeLinecap="round" />
        <path d="M3 12a9 9 0 0 1 6.3-8.6C7.2 5.2 6.7 8 7.9 10" fill="none" stroke={INK} strokeWidth="2.3" strokeLinecap="round" />
      </g>
      <circle className="hni-core" cx="12" cy="12" r="3" fill={INK} />
      <circle cx="12" cy="12" r="1.3" fill="#d9b8ff" />
    </Svg>
  );
}

export function EternalGlyph() {
  return (
    <Svg>
      <g className="hni-flip">
        <rect x="5" y="2" width="14" height="2.4" rx="1" fill={INK} />
        <rect x="5" y="19.6" width="14" height="2.4" rx="1" fill={INK} />
        <path d="M7 4.4h10c0 4-3.4 5.2-3.4 7.6S17 15.6 17 19.6H7c0-4 3.4-5.2 3.4-7.6S7 8.4 7 4.4Z" fill={INK} fillOpacity="0.35" stroke={INK} strokeWidth="1.3" />
        <path d="M9 7h6c-.6 1.6-2.2 2.4-3 3.6C11.2 9.4 9.6 8.6 9 7Z" fill={INK} />
        <path d="M8.6 19.2c.6-1.8 2-2.6 3.4-3 1.4.4 2.8 1.2 3.4 3Z" fill={INK} />
      </g>
    </Svg>
  );
}

export function CityGlyph() {
  return (
    <Svg>
      <path d="M2.5 21V12l4.5-3.5 4.5 3.5v9Z" fill={INK} />
      <path d="M12.5 21V6.5h1.8V4.5h1.8v2h1.8v-2h1.8v2h1.8V21Z" fill={INK} />
      <rect x="5.6" y="16" width="2.8" height="5" rx="1.4" fill={SHADE} />
      <rect x="15.4" y="10" width="2.2" height="3" rx="1.1" fill={SHADE} />
      <path className="hni-pennant" d="M17.2 4.5V1.2l3 1.1-3 1.1" fill="#ff5a4a" stroke="#ff5a4a" strokeWidth="0.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function BestiaryGlyph() {
  return (
    <Svg>
      <path d="M3 2.5c.2 3.4 1.6 5.4 4 6.4M21 2.5c-.2 3.4-1.6 5.4-4 6.4" stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M6.4 9c1.6-1.5 3.4-2.2 5.6-2.2s4 .7 5.6 2.2c.7 3-.1 6.6-2.2 9.2L12 21.8l-3.4-3.6C6.5 15.6 5.7 12 6.4 9Z" fill={INK} />
      <path className="hni-eye" d="M8.4 11.6l2.9 1.2-.6 1.4-2.6-1.1ZM15.6 11.6l-2.9 1.2.6 1.4 2.6-1.1Z" fill="#c4140c" />
      <path d="M10.5 17.4h3l-1.5 1.6Z" fill={SHADE} />
    </Svg>
  );
}

export function InventoryGlyph() {
  return (
    <Svg>
      <g className="hni-bag">
        <path d="M8.5 7.5 7 4.2c-.2-.5.2-1 .7-1h8.6c.5 0 .9.5.7 1L15.5 7.5Z" fill={INK} />
        <path d="M8 7.5h8c3.4 2.4 5 5.6 5 8.6 0 3.3-2.6 5.4-5.6 5.4H8.6C5.6 21.5 3 19.4 3 16.1c0-3 1.6-6.2 5-8.6Z" fill={INK} />
        <path d="M7.6 7.6h8.8" stroke={SHADE} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="14.4" r="2.2" fill="#e8b04b" stroke={SHADE} strokeWidth="0.8" />
      </g>
    </Svg>
  );
}
