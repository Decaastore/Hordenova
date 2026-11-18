import type { ReactNode } from "react";

/**
 * GAME ICONS — one coherent set for the emblems (the game's top bar and the Ranking page):
 * every icon drawn on the same 24-unit grid, as a solid cream silhouette filling about 20 units,
 * with its inner details cut in a dark ink, so they share one weight and read at a glance. Parts
 * that move on hover carry an `hni-*` class (HUD.tsx animates them).
 */
export type GameIconName =
  | "scroll"
  | "compass"
  | "anvil"
  | "sparkle"
  | "vortex"
  | "hourglass"
  | "castle"
  | "skull"
  | "pouch"
  | "trophy"
  | "swords"
  | "eye"
  | "summit"
  | "crown"
  | "medal"
  | "book";

const C = "#fff4dc";
const D = "rgba(30,14,4,0.62)";

const ICONS: Record<GameIconName, ReactNode> = {
  scroll: (
    <g className="hni-scroll">
      <rect x="6" y="4.5" width="12" height="15" fill={C} />
      <rect x="3.5" y="2.5" width="17" height="4.5" rx="2.25" fill={C} />
      <rect x="3.5" y="17" width="17" height="4.5" rx="2.25" fill={C} />
      <path d="M8.5 9.5h7M8.5 12h7M8.5 14.5h4.5" stroke={D} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.5 4.75h13M5.5 19.25h13" stroke={D} strokeWidth="0.9" strokeLinecap="round" />
    </g>
  ),
  compass: (
    <g>
      <path fillRule="evenodd" d="M12 1.5a10.5 10.5 0 1 1 0 21 10.5 10.5 0 0 1 0-21Zm0 2.4a8.1 8.1 0 1 0 0 16.2 8.1 8.1 0 0 0 0-16.2Z" fill={C} />
      <g className="hni-needle">
        <path d="M12 4.6 14.6 12H9.4Z" fill="#ff6a4a" />
        <path d="M12 19.4 9.4 12h5.2Z" fill={C} />
        <circle cx="12" cy="12" r="1.3" fill={D} />
      </g>
    </g>
  ),
  anvil: (
    <g>
      <path d="M1.8 10.2h14.6c2.4 0 4.6.8 5.8 2.3-1.6.4-3.6.6-5.9.6-.7 1.9-2.2 3.2-4.1 3.6v1.8h3.2l1 2.9H5.6l1-2.9h3.2v-1.8c-2.6-.6-4.9-2.4-6.3-5.1-.8 0-1.4-.6-1.7-1.4Z" fill={C} />
      <path d="M3.5 11.6h12.8" stroke={D} strokeWidth="1" strokeLinecap="round" />
      <g className="hni-hammer">
        <rect x="11.5" y="1.2" width="8" height="3.6" rx="0.8" transform="rotate(-28 15.5 3)" fill={C} />
        <path d="M14.6 4.6 12.4 9" stroke={C} strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="hni-sparks" fill="#ffd27a">
        <circle cx="8" cy="7.6" r="1" />
        <circle cx="5.4" cy="8.6" r="0.75" />
        <circle cx="9.8" cy="6.2" r="0.7" />
      </g>
    </g>
  ),
  sparkle: (
    <g>
      <path className="hni-star hni-star-a" d="M10.5 2c.9 5.1 2.8 7 7.9 7.9-5.1.9-7 2.8-7.9 7.9-.9-5.1-2.8-7-7.9-7.9C7.7 9 9.6 7.1 10.5 2Z" fill={C} />
      <path className="hni-star hni-star-b" d="M18.5 14.2c.4 2.3 1.2 3.1 3.5 3.5-2.3.4-3.1 1.2-3.5 3.5-.4-2.3-1.2-3.1-3.5-3.5 2.3-.4 3.1-1.2 3.5-3.5Z" fill={C} />
      <circle className="hni-star hni-star-c" cx="19" cy="4.5" r="1.4" fill={C} />
    </g>
  ),
  vortex: (
    <g>
      <g className="hni-spin">
        <path d="M13.40 12.00 L13.48 12.17 L13.55 12.36 L13.58 12.57 L13.59 12.79 L13.57 13.02 L13.52 13.25 L13.43 13.49 L13.30 13.72 L13.15 13.94 L12.95 14.14 L12.73 14.33 L12.47 14.49 L12.19 14.62 L11.89 14.72 L11.56 14.78 L11.22 14.80 L10.86 14.78 L10.51 14.72 L10.15 14.60 L9.80 14.44 L9.46 14.24 L9.14 13.98 L8.85 13.69 L8.59 13.35 L8.37 12.97 L8.19 12.56 L8.05 12.12 L7.97 11.66 L7.94 11.18 L7.97 10.69 L8.06 10.20 L8.22 9.71 L8.43 9.23 L8.71 8.77 L9.04 8.34 L9.43 7.95 L9.87 7.59 L10.36 7.29 L10.89 7.04 L11.46 6.85 L12.06 6.73 L12.67 6.68 L13.30 6.70 L13.94 6.79 L14.57 6.97 L15.18 7.21 L15.77 7.54 L16.33 7.94 L16.84 8.41 L17.30 8.94 L17.71 9.53 L18.04 10.18 L18.30 10.87 L18.49 11.59 L18.59 12.35 L18.60 13.12 L18.51 13.89 L18.34 14.67 L18.07 15.42 L17.72 16.15 L17.27 16.85 L16.74 17.49 L16.13 18.08 L15.45 18.60 L14.70 19.04 L13.90 19.39 L13.05 19.66 L12.16 19.82 L11.25 19.88 L10.33 19.84 L9.41 19.68 L8.51 19.42 L7.63 19.05 L6.79 18.58 L6.00 18.00 L5.28 17.33 L4.63 16.57 L4.07 15.73 L3.60 14.83 L3.24 13.86 L2.99 12.85 L2.86 11.81 L2.85 10.75 L2.96 9.68 L3.20 8.62 L3.56 7.59 L4.05 6.59 L4.65 5.65 L5.36 4.78 L6.18 3.99" fill="none" stroke={C} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle className="hni-core" cx="12" cy="12" r="1.9" fill="#e6c8ff" />
    </g>
  ),
  hourglass: (
    <g className="hni-flip">
      <rect x="4.5" y="1.8" width="15" height="3" rx="1.2" fill={C} />
      <rect x="4.5" y="19.2" width="15" height="3" rx="1.2" fill={C} />
      <path fillRule="evenodd" d="M6.4 4.8h11.2c0 4.2-3.3 5.4-3.3 7.2s3.3 3 3.3 7.2H6.4c0-4.2 3.3-5.4 3.3-7.2S6.4 9 6.4 4.8Zm2.2 1.8c.4 1.9 2.4 2.9 3.4 4.2 1-1.3 3-2.3 3.4-4.2Zm-.2 10.9h7.2c-.5-1.7-2.4-2.4-3.6-3.2-1.2.8-3.1 1.5-3.6 3.2Z" fill={C} />
    </g>
  ),
  castle: (
    <g>
      <path d="M2.5 21.5V9.5h2.3V7.2h2.1v2.3h2.2V7.2h2.1v2.3h1.6V7.2h2.1v2.3h2.2V7.2h2.1v2.3h2.3v12Z" fill={C} />
      <path d="M9.4 21.5v-4.2a2.6 2.6 0 0 1 5.2 0v4.2Z" fill={D} />
      <rect x="5.4" y="12.4" width="1.8" height="2.6" rx="0.9" fill={D} />
      <rect x="16.8" y="12.4" width="1.8" height="2.6" rx="0.9" fill={D} />
      <path d="M12 7.2V2.2" stroke={C} strokeWidth="1.2" />
      <path className="hni-pennant" d="M12.4 2.2h4.4l-1.2 1.5 1.2 1.5h-4.4Z" fill="#ff5a4a" />
    </g>
  ),
  skull: (
    <g>
      <path d="M2.6 3.2c.6 3 2.2 4.8 4.4 5.6M21.4 3.2c-.6 3-2.2 4.8-4.4 5.6" stroke={C} strokeWidth="2.3" strokeLinecap="round" fill="none" />
      <path d="M12 6c4.4 0 7.4 3 7.4 7 0 2.3-1 4-2.6 5v2.4a1.6 1.6 0 0 1-1.6 1.6H8.8a1.6 1.6 0 0 1-1.6-1.6V18c-1.6-1-2.6-2.7-2.6-5 0-4 3-7 7.4-7Z" fill={C} />
      <path className="hni-eye" d="M7.6 12.4c0-1 .9-1.7 2-1.6 1 .1 1.7.9 1.5 1.9l-.3 1.3c-1.7.1-3.2-.5-3.2-1.6ZM16.4 12.4c0-1-.9-1.7-2-1.6-1 .1-1.7.9-1.5 1.9l.3 1.3c1.7.1 3.2-.5 3.2-1.6Z" fill="#c4140c" />
      <path d="M12 15.2l-1.1 1.8h2.2Z M9.6 19.4v2M12 19.4v2M14.4 19.4v2" stroke={D} strokeWidth="1" fill={D} />
    </g>
  ),
  pouch: (
    <g className="hni-bag">
      <path d="M8.6 7.2 7.2 3.6c-.2-.5.2-1.1.8-1.1h8c.6 0 1 .6.8 1.1l-1.4 3.6Z" fill={C} />
      <path d="M8.2 7.4h7.6c3.5 2.5 5.2 5.7 5.2 8.9 0 3.3-2.6 5.2-5.7 5.2H8.7c-3.1 0-5.7-1.9-5.7-5.2 0-3.2 1.7-6.4 5.2-8.9Z" fill={C} />
      <path d="M7.8 7.5h8.4" stroke={D} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="14.6" r="2.4" fill="#e8b04b" stroke={D} strokeWidth="0.8" />
    </g>
  ),
  trophy: (
    <g>
      <path d="M6.5 2.5h11v5.6a5.5 5.5 0 0 1-11 0Z" fill={C} />
      <path d="M6.6 4.2H3.4c0 3.2 1.4 5.2 4 5.6M17.4 4.2h3.2c0 3.2-1.4 5.2-4 5.6" stroke={C} strokeWidth="1.8" fill="none" />
      <path d="M10.6 13.4h2.8v3.8h-2.8Z" fill={C} />
      <path d="M7 21.5c0-2.2 1.6-3.8 3.4-3.8h3.2c1.8 0 3.4 1.6 3.4 3.8Z" fill={C} />
      <path d="M12 4.6l.8 1.7 1.8.2-1.3 1.2.4 1.8-1.7-.9-1.7.9.4-1.8-1.3-1.2 1.8-.2Z" fill={D} />
    </g>
  ),
  swords: (
    <g fill={C}>
      <g>
      <path d="M2.4 2.4 6.6 3.3 15.4 12.1 12.1 15.4 3.3 6.6Z" />
      <path d="M11.6 17.6 17.6 11.6 19 13 13 19Z" />
      <path d="M15.9 15.9l3.4 3.4" stroke={C} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20.4" cy="20.4" r="1.7" />
      <path d="M4.2 4.2 13.2 13.2" stroke={D} strokeWidth="0.8" />
      </g>
      <g transform="matrix(-1 0 0 1 24 0)">
      <path d="M2.4 2.4 6.6 3.3 15.4 12.1 12.1 15.4 3.3 6.6Z" />
      <path d="M11.6 17.6 17.6 11.6 19 13 13 19Z" />
      <path d="M15.9 15.9l3.4 3.4" stroke={C} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20.4" cy="20.4" r="1.7" />
      <path d="M4.2 4.2 13.2 13.2" stroke={D} strokeWidth="0.8" />
      </g>
    </g>
  ),
  eye: (
    <g>
      <path d="M1.5 12C4.4 6.7 8 4.5 12 4.5s7.6 2.2 10.5 7.5c-2.9 5.3-6.5 7.5-10.5 7.5S4.4 17.3 1.5 12Z" fill={C} />
      <circle className="hni-iris" cx="12" cy="12" r="4.8" fill="#c4140c" />
      <path d="M12 7.6c.9 1.3 1.3 2.8 1.3 4.4s-.4 3.1-1.3 4.4c-.9-1.3-1.3-2.8-1.3-4.4s.4-3.1 1.3-4.4Z" fill="#1a0604" />
      <circle cx="13.9" cy="10" r="1" fill="#fff" opacity="0.8" />
    </g>
  ),
  summit: (
    <g>
      <path d="M1.5 21.5 9 9.2l3 4.6 3.4-5.6 7.1 13.3Z" fill={C} />
      <path d="M9 9.2l-1.9 3.1 1.9-.9 1.6 1.3Z M15.4 8.2l-2 3.4 2-.8 1.8 1Z" fill={D} />
      <path d="M15.4 8.2V1.8" stroke={C} strokeWidth="1.3" />
      <path className="hni-pennant" d="M15.9 1.8h5l-1.4 1.8 1.4 1.8h-5Z" fill="#ff5a4a" />
    </g>
  ),
  crown: (
    <g>
      <path d="M2.5 7.5l4.6 4 4.9-7.4 4.9 7.4 4.6-4-1.8 10H4.3Z" fill={C} />
      <rect x="4.3" y="18.4" width="15.4" height="3" rx="1" fill={C} />
      <circle cx="2.5" cy="7.2" r="1.5" fill={C} />
      <circle cx="12" cy="3.6" r="1.6" fill={C} />
      <circle cx="21.5" cy="7.2" r="1.5" fill={C} />
      <circle cx="12" cy="13.6" r="1.7" fill="#c86bff" />
      <circle cx="7.4" cy="14.6" r="1.1" fill="#5cc0ff" />
      <circle cx="16.6" cy="14.6" r="1.1" fill="#5cc0ff" />
    </g>
  ),
  medal: (
    <g>
      <path d="M6.5 1.8h4l2.6 6.4-3 1.6Z M17.5 1.8h-4l-2.6 6.4 3 1.6Z" fill={C} opacity="0.85" />
      <circle cx="12" cy="15" r="7" fill={C} />
      <circle cx="12" cy="15" r="5" fill="none" stroke={D} strokeWidth="0.9" />
      <path d="M12 11.4l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3Z" fill={D} />
    </g>
  ),
  book: (
    <g>
      <path d="M12 5.4C9.6 3.7 6.4 3.2 2.5 3.6v15.8c3.9-.4 7.1.1 9.5 1.8Z" fill={C} />
      <path d="M12 5.4c2.4-1.7 5.6-2.2 9.5-1.8v15.8c-3.9-.4-7.1.1-9.5 1.8Z" fill={C} opacity="0.9" />
      <path d="M12 5.4v15.8" stroke={D} strokeWidth="1" />
      <path d="M14.6 8.4l1.6 6.8M16.8 7.8l1.6 6.8M19 7.6l1.2 6.2" stroke="#c4140c" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4.8 7.6h4.8M4.8 10.2h4.8M4.8 12.8h3.6" stroke={D} strokeWidth="1" strokeLinecap="round" />
    </g>
  ),
};

export function GameIcon({ name, size = 16 }: { name: GameIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="hh-emb-svg" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
