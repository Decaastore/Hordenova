/**
 * MATERIAL ICONS — the pictures for the new materials and currencies:
 * Splinters, the four Essences, Duel Coins, Gem Shards and Eternal Marks.
 * Drawn as SVG so they stay sharp at any size and match in every panel.
 */
export type MaterialKind = "SPLINTERS" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC" | "DUEL_COINS" | "SHARDS" | "MARKS" | "GOLD";

const ESSENCE: Record<"RARE" | "EPIC" | "LEGENDARY" | "MYTHIC", [string, string, string]> = {
  RARE: ["#bfe0ff", "#3a8aff", "#123a8a"],
  EPIC: ["#ecd0ff", "#a85aff", "#4a1a8a"],
  LEGENDARY: ["#fff0b0", "#ffac2a", "#8a4a0a"],
  MYTHIC: ["#ffd0d0", "#ff3a4a", "#7a0a1a"],
};

export function MaterialIcon({ kind, size = 20, title }: { kind: MaterialKind; size?: number; title?: string }) {
  const id = `mi-${kind}`;
  const common = { width: size, height: size, viewBox: "0 0 32 32", role: title ? "img" : undefined, "aria-hidden": title ? undefined : true, style: { flex: "none", verticalAlign: "-0.25em", filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.6))" } } as const;
  if (kind === "SPLINTERS") {
    // three jagged iron-and-bone shards
    return (
      <svg {...common}>
        {title && <title>{title}</title>}
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f2e6cc" />
            <stop offset="0.55" stopColor="#a8987a" />
            <stop offset="1" stopColor="#4a3e2c" />
          </linearGradient>
        </defs>
        <path d="M6 27 L11 6 L14 14 L12 27 Z" fill={`url(#${id})`} stroke="#1e160c" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M13 28 L18 3 L22 13 L19 28 Z" fill={`url(#${id})`} stroke="#1e160c" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M20 28 L25 11 L28 19 L25 28 Z" fill={`url(#${id})`} stroke="#1e160c" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M18 5 L19.5 13" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
        <path d="M11 8 L12 14" stroke="rgba(255,255,255,0.6)" strokeWidth="0.9" />
      </svg>
    );
  }
  if (kind === "RARE" || kind === "EPIC" || kind === "LEGENDARY" || kind === "MYTHIC") {
    // a glowing crystal flask of essence
    const [hi, mid, lo] = ESSENCE[kind];
    return (
      <svg {...common}>
        {title && <title>{title}</title>}
        <defs>
          <radialGradient id={`${id}-g`} cx="0.5" cy="0.55" r="0.55">
            <stop offset="0" stopColor={mid} stopOpacity="0.55" />
            <stop offset="1" stopColor={mid} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hi} />
            <stop offset="0.5" stopColor={mid} />
            <stop offset="1" stopColor={lo} />
          </linearGradient>
        </defs>
        <circle cx="16" cy="18" r="15" fill={`url(#${id}-g)`} />
        <path d="M16 3 L25 14 L16 29 L7 14 Z" fill={`url(#${id})`} stroke="#140c18" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M7 14 L25 14 M16 3 L12.5 14 L16 29 M16 3 L19.5 14" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" fill="none" />
        <path d="M10 13 L15 5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" strokeLinecap="round" />
        {kind === "MYTHIC" && <circle cx="16" cy="17" r="2.2" fill="#fff" opacity="0.9" />}
      </svg>
    );
  }
  if (kind === "DUEL_COINS") {
    // a bronze coin with two crossed swords
    return (
      <svg {...common}>
        {title && <title>{title}</title>}
        <defs>
          <radialGradient id={id} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffe0a0" />
            <stop offset="0.6" stopColor="#c8823a" />
            <stop offset="1" stopColor="#6a3a14" />
          </radialGradient>
        </defs>
        <circle cx="16" cy="16" r="13" fill={`url(#${id})`} stroke="#2a1608" strokeWidth="1.4" />
        <circle cx="16" cy="16" r="9.8" fill="none" stroke="rgba(60,30,10,0.55)" strokeWidth="1.2" />
        <path d="M10 22 L22 10 M22 22 L10 10" stroke="#3a1e0a" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M10 22 L22 10 M22 22 L10 10" stroke="#fff2d0" strokeWidth="1" strokeLinecap="round" />
        <path d="M8.5 19.5 L12.5 23.5 M23.5 19.5 L19.5 23.5" stroke="#3a1e0a" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "SHARDS") {
    return (
      <svg {...common}>
        {title && <title>{title}</title>}
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0d8ff" />
            <stop offset="0.5" stopColor="#b47cff" />
            <stop offset="1" stopColor="#4a1a8a" />
          </linearGradient>
        </defs>
        <path d="M9 9 L15 4 L19 12 L13 18 Z" fill={`url(#${id})`} stroke="#1a0a2a" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M16 15 L24 11 L27 20 L19 25 Z" fill={`url(#${id})`} stroke="#1a0a2a" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M5 22 L10 18 L13 26 L8 28 Z" fill={`url(#${id})`} stroke="#1a0a2a" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "MARKS") {
    // an eternal rune in a violet hexagon
    return (
      <svg {...common}>
        {title && <title>{title}</title>}
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8b8ff" />
            <stop offset="1" stopColor="#4a1a7a" />
          </linearGradient>
        </defs>
        <path d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z" fill={`url(#${id})`} stroke="#1a0a2a" strokeWidth="1.3" />
        <path d="M16 8 L16 24 M10 12 L22 20 M22 12 L10 20" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
      </svg>
    );
  }
  // GOLD
  return (
    <svg {...common}>
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff6c0" />
          <stop offset="0.6" stopColor="#e8b030" />
          <stop offset="1" stopColor="#8a5a0a" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="12" fill={`url(#${id})`} stroke="#3a2406" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="rgba(90,50,0,0.5)" strokeWidth="1.2" />
    </svg>
  );
}
