import type { CSSProperties } from "react";
import { GAME_NAME } from "./BrandLogo";
import { SITE_DISPLAY_FONT } from "./siteFonts";

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

/**
 * The site's wordmark: "Horde Nova" set in the banner blackletter, with the
 * o of Nova replaced by the game's emblem (the rift with a nova bursting out
 * of it). Text, not an image, so it takes its size from `fontSize` and its
 * color from the page. The in-game HUD keeps the original BrandLogo.
 */
export function SiteWordmark({ fontSize, style, decorative = false }: { fontSize?: number | string; style?: CSSProperties; decorative?: boolean }) {
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : GAME_NAME}
      aria-hidden={decorative || undefined}
      style={{ fontFamily: SITE_DISPLAY_FONT, fontWeight: 800, fontSize, lineHeight: 0.9, letterSpacing: "0.005em", whiteSpace: "nowrap", display: "inline-flex", alignItems: "baseline", ...style }}
    >
      <span aria-hidden="true">Horde&nbsp;N</span>
      <img
        src={`${assetBase}brand/hordenova-emblem-ember.svg`}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ height: "0.62em", width: "0.62em", margin: "0 0.02em", alignSelf: "baseline", transform: "translateY(0.06em)" }}
      />
      <span aria-hidden="true">va</span>
    </span>
  );
}
