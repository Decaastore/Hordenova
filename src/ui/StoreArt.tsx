import type { CSSProperties } from "react";

/**
 * STORE ART — drawn pictures for the Store: faceted gems (amber for Free
 * Gems, ice-blue for Purchased Gems), gem piles that grow with the pack, a
 * treasure chest for the daily gift, the VIP crown, and the small perk
 * icons. All vector, so they stay sharp from a 16px pill to a hero card.
 */

type GemTone = "FREE" | "PURCHASED";

const TONES: Record<GemTone, { hi: string; mid: string; lo: string; edge: string }> = {
  FREE: { hi: "#fff2c4", mid: "#f2b53c", lo: "#8a4f0c", edge: "#5a3206" },
  PURCHASED: { hi: "#e8f8ff", mid: "#5cc0ff", lo: "#1a4f9a", edge: "#0d2a5c" },
};

/** One faceted gem, as a group placed at (x, y) with size s (for piles). */
function GemShape({ tone, x = 0, y = 0, s = 24, id }: { tone: GemTone; x?: number; y?: number; s?: number; id: string }) {
  const c = TONES[tone];
  const k = s / 24;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.hi} />
          <stop offset="1" stopColor={c.mid} />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.mid} />
          <stop offset="1" stopColor={c.lo} />
        </linearGradient>
      </defs>
      {/* crown + pavilion */}
      <path d="M6 3h12l5 6-11 13L1 9Z" fill={`url(#${id}-b)`} stroke={c.edge} strokeWidth="1" strokeLinejoin="round" />
      <path d="M6 3h12l5 6H1Z" fill={`url(#${id}-a)`} />
      <path d="M1 9h22L12 22Z" fill={`url(#${id}-b)`} opacity="0.9" />
      <path d="M8 9l4 13 4-13M6 3l2 6 4-6 4 6 2-6" fill="none" stroke={c.hi} strokeWidth="0.8" strokeOpacity="0.7" strokeLinejoin="round" />
      <path d="M7.5 4.5 9 7.8" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
    </g>
  );
}

export function StoreGem({ tone, size = 20, style, className }: { tone: GemTone; size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} className={className} aria-hidden="true">
      <GemShape tone={tone} id={`g-${tone}`} />
    </svg>
  );
}

/** A pile of purchased gems that grows with the pack tier (0 = smallest). */
export function GemPile({ tier }: { tier: number }) {
  // positions (x, y, size) — later entries sit in front
  const layout: [number, number, number][][] = [
    [[38, 34, 44]],
    [[22, 40, 36], [50, 34, 42]],
    [[14, 46, 32], [62, 46, 32], [36, 30, 44]],
    [[8, 52, 30], [70, 52, 30], [24, 34, 36], [54, 30, 40]],
    [[4, 58, 28], [80, 58, 28], [20, 44, 32], [64, 42, 34], [38, 24, 44]],
    [[0, 62, 26], [92, 62, 26], [14, 48, 30], [76, 48, 30], [30, 34, 36], [58, 30, 40], [42, 52, 34]],
  ];
  const gems = layout[Math.max(0, Math.min(layout.length - 1, tier))]!;
  return (
    <svg className="st-pile" viewBox="0 0 120 92" aria-hidden="true">
      <defs>
        <radialGradient id="pile-glow" cx="0.5" cy="0.62" r="0.5">
          <stop offset="0" stopColor="#7fd0ff" stopOpacity={0.25 + tier * 0.07} />
          <stop offset="1" stopColor="#7fd0ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="56" rx="58" ry="36" fill="url(#pile-glow)" />
      <ellipse cx="60" cy="86" rx={22 + tier * 6} ry="4" fill="rgba(0,0,0,0.45)" />
      {gems.map(([x, y, s], i) => (
        <GemShape key={i} tone="PURCHASED" x={x} y={y} s={s} id={`p${tier}-${i}`} />
      ))}
    </svg>
  );
}

export function ChestArt({ open }: { open: boolean }) {
  return (
    <svg className={`st-chest${open ? " is-open" : ""}`} viewBox="0 0 96 80" aria-hidden="true">
      <defs>
        <linearGradient id="ch-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5530" />
          <stop offset="1" stopColor="#4a2a12" />
        </linearGradient>
        <linearGradient id="ch-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0b8" />
          <stop offset="0.5" stopColor="#e0a43a" />
          <stop offset="1" stopColor="#7a4a10" />
        </linearGradient>
        <radialGradient id="ch-light" cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor="#ffe6a0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffb340" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="48" cy="76" rx="36" ry="4" fill="rgba(0,0,0,0.5)" />
      <g className="st-chest-light">
        <path d="M18 38 L4 2 H92 L78 38Z" fill="url(#ch-light)" />
      </g>
      {/* body */}
      <rect x="14" y="38" width="68" height="36" rx="4" fill="url(#ch-wood)" stroke="#2a1608" strokeWidth="2" />
      <path d="M14 50h68M14 62h68" stroke="#2a1608" strokeWidth="1.2" opacity="0.6" />
      <rect x="12" y="36" width="72" height="6" rx="2" fill="url(#ch-gold)" />
      <rect x="20" y="38" width="6" height="36" fill="url(#ch-gold)" />
      <rect x="70" y="38" width="6" height="36" fill="url(#ch-gold)" />
      {/* lid */}
      <g className="st-chest-lid">
        <path d="M14 38V26c0-10 15-16 34-16s34 6 34 16v12Z" fill="url(#ch-wood)" stroke="#2a1608" strokeWidth="2" />
        <path d="M20 37V24c1-7 10-11 10-11M76 37V24c-1-7-10-11-10-11" stroke="url(#ch-gold)" strokeWidth="6" fill="none" />
        <path d="M14 36h68" stroke="url(#ch-gold)" strokeWidth="4" />
      </g>
      {/* lock */}
      <rect x="41" y="36" width="14" height="16" rx="3" fill="url(#ch-gold)" stroke="#5a3206" strokeWidth="1.2" />
      <circle cx="48" cy="43" r="2.2" fill="#3a1e06" />
      <path d="M48 44v4" stroke="#3a1e06" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CrownArt() {
  return (
    <svg className="st-crown" viewBox="0 0 64 52" aria-hidden="true">
      <defs>
        <linearGradient id="cr-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.45" stopColor="#f0be52" />
          <stop offset="1" stopColor="#8a5410" />
        </linearGradient>
      </defs>
      <path d="M6 40 2 12l16 12L32 4l14 20 16-12-4 28Z" fill="url(#cr-g)" stroke="#5a3206" strokeWidth="2" strokeLinejoin="round" />
      <rect x="6" y="40" width="52" height="8" rx="2" fill="url(#cr-g)" stroke="#5a3206" strokeWidth="2" />
      <circle cx="32" cy="30" r="4.5" fill="#c86bff" stroke="#fff0ff" strokeWidth="1.2" />
      <circle cx="17" cy="33" r="3" fill="#5cc0ff" stroke="#e8f8ff" strokeWidth="1" />
      <circle cx="47" cy="33" r="3" fill="#5cc0ff" stroke="#e8f8ff" strokeWidth="1" />
      <circle cx="2" cy="12" r="2.6" fill="#fff3c4" />
      <circle cx="32" cy="4" r="2.8" fill="#fff3c4" />
      <circle cx="62" cy="12" r="2.6" fill="#fff3c4" />
      <path d="M12 44h40" stroke="#fff3c4" strokeWidth="1.2" opacity="0.6" />
    </svg>
  );
}

/** Small perk icons for the VIP and starter cards. */
export function PerkIcon({ kind }: { kind: "GEMS" | "SCOUT" | "FAIR" | "SKIN" | "ITEM" | "SLOTS" | "CLOCK" }) {
  const s = { width: 18, height: 18, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (kind) {
    case "GEMS":
      return <StoreGem tone="PURCHASED" size={18} />;
    case "SCOUT":
      return (
        <svg {...s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 21V3" />
          <path d="M5 4h12l-3 4 3 4H5" fill="currentColor" fillOpacity="0.3" />
          <path d="M14 21l2-5 3 5" />
        </svg>
      );
    case "FAIR":
      return (
        <svg {...s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6Z" fill="currentColor" fillOpacity="0.18" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
      );
    case "SKIN":
      return (
        <svg {...s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M8 21h8M9 21l1-10h4l1 10M7 11h10M8 11V7l4-4 4 4v4" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
    case "ITEM":
      return (
        <svg {...s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 2.5 20 7v10l-8 4.5L4 17V7Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 7.5 15.5 12 12 16.5 8.5 12Z" fill="currentColor" />
        </svg>
      );
    case "SLOTS":
      return (
        <svg {...s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <path d="M17 14v6M14 17h6" strokeLinecap="round" />
        </svg>
      );
    case "CLOCK":
      return (
        <svg {...s} width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
  }
}
